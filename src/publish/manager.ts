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
      const options: PublishOptions = {
        title: content.title,
        body: content.body,
        tags: Array.isArray(content.tags) ? content.tags : JSON.parse(content.tags as string),
        coverText: content.cover_text,
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
    const drafts = contentRepo.findByStatus('draft', limit);
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

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
