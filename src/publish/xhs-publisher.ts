import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { withRetry, sleep, randomDelay } from '../utils/retry.js';
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
        waitUntil: 'networkidle',
        timeout: 15_000,
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
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    log.warn('请在浏览器中手动完成登录（扫码/手机号）...');
    log.warn('登录完成后，系统将自动保存 Cookie');

    // 等待登录成功（最多 5 分钟）
    try {
      await this.page.waitForURL('**/creator.xiaohongshu.com/**', {
        timeout: 300_000,
      });

      // 保存 Cookie
      await this.saveCookies();
      log.info('登录成功，Cookie 已保存');
      return true;
    } catch {
      log.error('登录超时');
      return false;
    }
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
            waitUntil: 'networkidle',
            timeout: 30_000,
          });
          await sleep(2000);

          // 上传图片（如果有）
          if (options.imagePaths && options.imagePaths.length > 0) {
            await this.uploadImages(options.imagePaths);
          }

          // 填写标题
          await this.fillTitle(options.title);
          await this.risk.actionDelay();

          // 填写正文
          await this.fillBody(options.body);
          await this.risk.actionDelay();

          // 添加标签
          await this.addTags(options.tags);
          await this.risk.actionDelay();

          // 点击发布
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

    // 小红书发布页标题输入框
    const titleInput = await this.page.$(
      '#title-textarea, [placeholder*="标题"], [class*="title"] input, [class*="title"] textarea',
    );

    if (titleInput) {
      await titleInput.click();
      await sleep(500);
      // 模拟人工输入
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

    // 小红书正文编辑器
    const bodyEditor = await this.page.$(
      '#post-textarea, [placeholder*="正文"], [contenteditable="true"], [class*="content"] [contenteditable]',
    );

    if (bodyEditor) {
      await bodyEditor.click();
      await sleep(500);

      // 分段输入，模拟人工
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

    // 找到标签输入区域
    const tagInput = await this.page.$(
      '[placeholder*="标签"], [placeholder*="话题"], [class*="tag"] input',
    );

    if (tagInput) {
      for (const tag of tags.slice(0, 10)) {
        const tagText = tag.startsWith('#') ? tag.slice(1) : tag;
        await tagInput.click();
        await sleep(300);
        await this.page.keyboard.type(tagText, { delay: 50 });
        await sleep(500);
        // 尝试选择第一个推荐
        const suggestion = await this.page.$('[class*="suggest"] li:first-child, [class*="tag-list"] div:first-child');
        if (suggestion) {
          await suggestion.click();
        } else {
          await this.page.keyboard.press('Enter');
        }
        await sleep(300);
      }
      log.info({ count: tags.length }, '标签已添加');
    } else {
      log.warn('未找到标签输入框');
    }
  }

  private async clickPublish(): Promise<PublishResult> {
    if (!this.page) throw new Error('页面未初始化');

    // 找到发布按钮
    const publishBtn = await this.page.$(
      'button:has-text("发布"), [class*="publish"] button, button[class*="submit"]',
    );

    if (publishBtn) {
      await publishBtn.click();
      log.info('已点击发布按钮');

      // 等待发布完成
      await sleep(5000);

      // 检查是否发布成功
      const url = this.page.url();
      if (url.includes('publish') && !url.includes('login')) {
        log.info('发布成功');
        return { success: true };
      }

      // 检查是否有成功提示
      const successMsg = await this.page.$('[class*="success"], :text("发布成功")');
      if (successMsg) {
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
