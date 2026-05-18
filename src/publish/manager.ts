import { contentRepo, publishRepo } from '../database/repositories.js';
import { createModuleLogger } from '../utils/logger.js';
import { XhsPublisher } from './xhs-publisher.js';
import { RiskController } from './risk-control.js';
import type { PublishOptions, PublishResult } from './types.js';

const log = createModuleLogger('publish:manager');

export class PublishManager {
  private publisher: XhsPublisher;
  private risk: RiskController;

  constructor() {
    this.publisher = new XhsPublisher();
    this.risk = new RiskController();
  }

  async init(): Promise<void> {
    await this.publisher.init();

    // 检查登录状态
    const loggedIn = await this.publisher.isLoggedIn();
    if (!loggedIn) {
      log.warn('未登录小红书，尝试登录...');
      const success = await this.publisher.login();
      if (!success) {
        throw new Error('小红书登录失败');
      }
    } else {
      log.info('小红书已登录');
    }
  }

  async publishContent(contentId: string): Promise<PublishResult> {
    const content = contentRepo.findById(contentId);
    if (!content) {
      return { success: false, error: '内容不存在' };
    }

    // 风控检查
    const { allowed, reason } = await this.risk.canPublish();
    if (!allowed) {
      return { success: false, error: reason };
    }

    // 创建发布记录
    const recordId = publishRepo.create({
      content_id: contentId,
      platform: 'xiaohongshu',
      status: 'publishing',
      retry_count: 0,
    });

    try {
      // 查找可用的图片文件
      const imagePaths = this.findImages(content.id);

      const options: PublishOptions = {
        title: content.title,
        body: content.body,
        tags: Array.isArray(content.tags) ? content.tags : JSON.parse(content.tags as string),
        coverText: content.cover_text,
        imagePaths,
      };

      const result = await this.publisher.publish(options);

      if (result.success) {
        publishRepo.updateStatus(recordId, 'success', {
          platform_post_id: result.postId,
          platform_url: result.postUrl,
          published_at: new Date().toISOString(),
        });
        contentRepo.updateStatus(contentId, 'published');
        log.info({ contentId, recordId }, '发布成功');
      } else {
        publishRepo.updateStatus(recordId, 'failed', {
          error_message: result.error,
        });
        log.error({ contentId, error: result.error }, '发布失败');
      }

      return result;
    } catch (err) {
      const error = (err as Error).message;
      publishRepo.updateStatus(recordId, 'failed', { error_message: error });
      log.error({ contentId, error }, '发布异常');
      return { success: false, error };
    }
  }

  async publishDraft(limit = 1): Promise<PublishResult[]> {
    // 查询 draft 和 reviewed 状态的文章（reviewed = 审核通过，可发布）
    const drafts = [
      ...contentRepo.findByStatus('draft', limit),
      ...contentRepo.findByStatus('reviewed', limit),
    ].slice(0, limit);

    if (drafts.length === 0) {
      log.warn('没有可发布的文章（draft/reviewed）');
    }

    const results: PublishResult[] = [];

    for (const content of drafts) {
      const result = await this.publishContent(content.id);
      results.push(result);

      // 发布间隔
      if (drafts.indexOf(content) < drafts.length - 1) {
        log.info('等待发布间隔...');
        await this.risk.prePublishDelay();
      }
    }

    return results;
  }

  private findImages(contentId: string): string[] {
    const { readdirSync, existsSync } = require('fs') as typeof import('fs');

    // 按 contentId 查找图片目录
    const imageDir = `./data/images/${contentId}`;
    if (existsSync(imageDir)) {
      return readdirSync(imageDir)
        .filter((f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map((f: string) => `${imageDir}/${f}`);
    }

    // 兜底：使用 data/images 下的所有图片
    const fallbackDir = './data/images';
    if (existsSync(fallbackDir)) {
      return readdirSync(fallbackDir)
        .filter((f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map((f: string) => `${fallbackDir}/${f}`);
    }

    return [];
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
