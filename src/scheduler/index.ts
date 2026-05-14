import { CronJob } from 'cron';
import { config } from '../config/index.js';
import { CrawlerManager } from '../crawler/index.js';
import { ContentGenerator } from '../ai/index.js';
import { PublishManager } from '../publish/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('scheduler');

export class Scheduler {
  private jobs: CronJob[] = [];
  private crawler: CrawlerManager;
  private generator: ContentGenerator;
  private publisher: PublishManager | null = null;

  constructor() {
    this.crawler = new CrawlerManager();
    this.generator = new ContentGenerator();
  }

  start(): void {
    log.info('调度系统启动');

    // 每小时抓取热点
    const crawlJob = new CronJob(config.SCHEDULE_CRON_CRAWL, async () => {
      log.info('[定时任务] 开始抓取热点');
      try {
        const saved = await this.crawler.crawlAndSave();
        log.info({ saved }, '[定时任务] 热点抓取完成');
      } catch (err) {
        log.error({ error: (err as Error).message }, '[定时任务] 热点抓取失败');
      }
    });
    crawlJob.start();
    this.jobs.push(crawlJob);
    log.info({ cron: config.SCHEDULE_CRON_CRAWL }, '热点抓取任务已注册');

    // 定时 AI 创作
    const generateJob = new CronJob(config.SCHEDULE_CRON_GENERATE, async () => {
      log.info('[定时任务] 开始 AI 创作');
      try {
        const ids = await this.generator.generateBatch(3);
        log.info({ count: ids.length }, '[定时任务] AI 创作完成');
      } catch (err) {
        log.error({ error: (err as Error).message }, '[定时任务] AI 创作失败');
      }
    });
    generateJob.start();
    this.jobs.push(generateJob);
    log.info({ cron: config.SCHEDULE_CRON_GENERATE }, 'AI 创作任务已注册');

    // 定时发布
    const publishJob = new CronJob(config.SCHEDULE_CRON_PUBLISH, async () => {
      log.info('[定时任务] 开始发布');
      try {
        if (!this.publisher) {
          this.publisher = new PublishManager();
          await this.publisher.init();
        }
        const results = await this.publisher.publishDraft(1);
        const success = results.filter((r) => r.success).length;
        log.info({ total: results.length, success }, '[定时任务] 发布完成');
      } catch (err) {
        log.error({ error: (err as Error).message }, '[定时任务] 发布失败');
      }
    });
    publishJob.start();
    this.jobs.push(publishJob);
    log.info({ cron: config.SCHEDULE_CRON_PUBLISH }, '发布任务已注册');

    log.info('所有定时任务已启动');
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    log.info('调度系统已停止');
  }

  async close(): Promise<void> {
    this.stop();
    if (this.publisher) {
      await this.publisher.close();
    }
  }
}
