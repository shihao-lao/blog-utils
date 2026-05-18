import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { withRetry, sleep } from '../utils/retry.js';
import { RiskController } from './risk-control.js';
import type { PlatformPublisher, PublishOptions, PublishResult } from './types.js';

const log = createModuleLogger('publish:xhs');

const XHS_CREATE_URL = 'https://creator.xiaohongshu.com/publish/publish';

export class XhsPublisher implements PlatformPublisher {
  name = 'xiaohongshu';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private risk = new RiskController();

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: config.XHS_HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    // 加载已有的 Cookie / 持久化上下文
    const contextOptions: Parameters<typeof chromium.launch>[0] extends never ? never : Record<string, unknown> = {
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };

    if (config.XHS_PROXY) {
      contextOptions.proxy = { server: config.XHS_PROXY };
    }

    this.context = await this.browser.newContext(contextOptions);

    // 注入反检测脚本
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-expect-error override
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });

    this.page = await this.context.newPage();

    // 尝试加载已保存的 Cookie
    await this.loadCookies();

    log.info('小红书发布器初始化完成');
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto('https://creator.xiaohongshu.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // 检查是否在登录页
      const url = this.page.url();
      if (url.includes('login') || url.includes('passport')) {
        return false;
      }

      // 检查是否有创作者中心的元素
      const creator = await this.page.$('.creator-home, .publish-container, [class*="creator"]');
      return !!creator;
    } catch {
      return false;
    }
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('浏览器未初始化');

    log.info('开始小红书登录流程');

    await this.page.goto('https://creator.xiaohongshu.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    log.warn('请在浏览器中手动完成登录（扫码/手机号）...');
    log.warn('登录完成后，系统将自动保存 Cookie');

    // 轮询检测登录状态（最多 5 分钟，每 3 秒检查一次）
    const maxWait = 300_000;
    const interval = 3_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await sleep(interval);

      // 只靠 URL 跳离登录页判断登录成功
      const url = this.page.url();
      if (!url.includes('/login') && !url.includes('/passport')) {
        log.info('检测到页面跳转，登录成功');
        await sleep(3000);
        await this.saveCookies();
        return true;
      }

      const elapsed = Math.round((Date.now() - start) / 1000);
      log.debug(`等待登录中... (${elapsed}s, 请在浏览器中扫码)`);
    }

    log.error('登录超时（5分钟内未检测到登录）');
    return false;
  }

  async publish(options: PublishOptions): Promise<PublishResult> {
    if (!this.page) throw new Error('浏览器未初始化');

    // 风控检查
    const { allowed, reason } = await this.risk.canPublish();
    if (!allowed) {
      return { success: false, error: reason };
    }

    try {
      return await withRetry(
        async () => {
          // 发布前延迟
          await this.risk.prePublishDelay();

          // 导航到发布页
          await this.page!.goto(XHS_CREATE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });
          await sleep(3000);

          // 第 1 步：切换到"上传图文"tab
          log.info('切换到图文发布模式...');
          const imageTextTab = await this.page!.$('text=上传图文');
          if (imageTextTab) {
            await imageTextTab.click();
            await sleep(2000);
          } else {
            log.warn('未找到"上传图文"tab，可能已在图文模式');
          }

          // 第 2 步：上传图片（如果有）
          if (options.imagePaths && options.imagePaths.length > 0) {
            await this.uploadImages(options.imagePaths);
            // 等待编辑器出现（上传图片后才会显示）
            log.info('等待编辑器加载...');
            await this.page!.waitForSelector(
              'textarea, [contenteditable="true"], [placeholder*="标题"]',
              { timeout: 30_000 },
            ).catch(() => log.warn('等待编辑器超时'));
            await sleep(2000);
          } else {
            log.warn('没有图片，小红书图文笔记需要至少一张图片');
            return { success: false, error: '没有图片文件，无法发布图文笔记' };
          }

          // 第 3 步：填写标题
          await this.fillTitle(options.title);
          await this.risk.actionDelay();

          // 第 4 步：填写正文
          await this.fillBody(options.body);
          await this.risk.actionDelay();

          // 第 5 步：添加标签
          await this.addTags(options.tags);
          await this.risk.actionDelay();

          // 第 6 步：点击发布
          const result = await this.clickPublish();

          return result;
        },
        { maxRetries: 2, delay: 10_000 },
      );
    } catch (err) {
      const error = (err as Error).message;
      log.error({ error }, '小红书发布失败');
      return { success: false, error };
    }
  }

  private async uploadImages(imagePaths: string[]): Promise<void> {
    if (!this.page) return;

    log.info({ count: imagePaths.length }, '开始上传图片');

    // 找到上传按钮
    const fileInput = await this.page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(imagePaths);
      log.info('图片已选择，等待上传完成');

      // 等待上传完成
      await sleep(5000);
      await this.page.waitForSelector('[class*="upload-success"], [class*="uploaded"]', {
        timeout: 60_000,
      }).catch(() => log.warn('未检测到上传完成标识，继续'));
    } else {
      log.warn('未找到文件上传入口');
    }
  }

  private async fillTitle(title: string): Promise<void> {
    if (!this.page) return;

    const titleInput = await this.page.$('input[placeholder*="标题"]');

    if (titleInput) {
      await titleInput.click();
      await sleep(500);
      for (const char of title) {
        await this.page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
      }
      log.info({ title }, '标题已填写');
    } else {
      log.warn('未找到标题输入框');
    }
  }

  private async fillBody(body: string): Promise<void> {
    if (!this.page) return;

    const bodyEditor = await this.page.$('[contenteditable="true"]');

    if (bodyEditor) {
      await bodyEditor.click();
      await sleep(500);

      const paragraphs = body.split('\n');
      for (const para of paragraphs) {
        if (para.trim()) {
          await this.page.keyboard.type(para, { delay: Math.random() * 30 + 20 });
          await this.page.keyboard.press('Enter');
          await sleep(200);
        }
      }
      log.info('正文已填写');
    } else {
      log.warn('未找到正文编辑器');
    }
  }

  private async addTags(tags: string[]): Promise<void> {
    if (!this.page) return;

    for (const tag of tags.slice(0, 10)) {
      const tagText = tag.startsWith('#') ? tag.slice(1) : tag;

      // 点击"话题"按钮打开话题搜索
      const topicBtn = await this.page.$('#topicBtn, button:has-text("话题")');
      if (topicBtn) {
        await topicBtn.click();
        await sleep(1000);
      }

      // 在弹出的搜索框中输入话题
      await this.page.keyboard.type(tagText, { delay: 50 });
      await sleep(1500);

      // 点击第一个推荐结果
      const suggestion = await this.page.$('[class*="suggest"] div:first-child, [class*="topic-item"]:first-child, [class*="drop-list"] div:first-child');
      if (suggestion) {
        await suggestion.click();
        log.info({ tag: tagText }, '话题已添加');
      } else {
        await this.page.keyboard.press('Enter');
        log.info({ tag: tagText }, '话题已输入');
      }
      await sleep(500);
    }
  }

  private async clickPublish(): Promise<PublishResult> {
    if (!this.page) throw new Error('页面未初始化');

    // 发布按钮在页面右下角
    const publishBtn = await this.page.$('button:has-text("发布")');

    if (publishBtn) {
      await publishBtn.click();
      log.info('已点击发布按钮');

      // 等待发布完成
      await sleep(5000);

      // 检查是否有成功提示
      const successMsg = await this.page.$('text=发布成功');
      if (successMsg) {
        return { success: true };
      }

      // 检查 URL 是否跳转到笔记管理页（发布成功的标志）
      const url = this.page.url();
      if (!url.includes('/publish')) {
        log.info('页面已跳转，发布成功');
        return { success: true };
      }

      return { success: false, error: '发布后未检测到成功标识' };
    }

    return { success: false, error: '未找到发布按钮' };
  }

  private async saveCookies(): Promise<void> {
    if (!this.context) return;

    const cookies = await this.context.cookies();
    const path = config.XHS_COOKIE_PATH;

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cookies, null, 2));
    log.info({ path }, 'Cookie 已保存');
  }

  private async loadCookies(): Promise<void> {
    if (!this.context) return;

    const path = config.XHS_COOKIE_PATH;
    if (!existsSync(path)) {
      log.debug('Cookie 文件不存在，跳过');
      return;
    }

    try {
      const cookies = JSON.parse(readFileSync(path, 'utf-8'));
      await this.context.addCookies(cookies);
      log.info('Cookie 已加载');
    } catch (err) {
      log.warn({ error: (err as Error).message }, 'Cookie 加载失败');
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      log.info('浏览器已关闭');
    }
  }
}
