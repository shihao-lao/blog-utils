import { createModuleLogger } from '../utils/logger.js';
import { topicRepo } from '../database/repositories.js';
import { WeiboHotAdapter } from './adapters/weibo.js';
import { BaiduHotAdapter } from './adapters/baidu.js';
import { ToutiaoHotAdapter } from './adapters/toutiao.js';
import { RSSAdapter } from './adapters/rss.js';
import { classifyCategory, isSensitive, extractKeywords, deduplicateResults, sortByHeat } from './utils.js';
import type { CrawlerAdapter, CrawlResult } from './types.js';
import { config } from '../config/index.js';

const log = createModuleLogger('crawler:manager');

export class CrawlerManager {
  private adapters: CrawlerAdapter[] = [];

  constructor() {
    this.registerAdapter(new WeiboHotAdapter());
    this.registerAdapter(new BaiduHotAdapter());
    this.registerAdapter(new ToutiaoHotAdapter());
    this.registerAdapter(new RSSAdapter());
  }

  registerAdapter(adapter: CrawlerAdapter): void {
    this.adapters.push(adapter);
    log.info({ source: adapter.name }, '注册爬虫适配器');
  }

  async crawlAll(): Promise<CrawlResult[]> {
    log.info(`开始全量抓取，共 ${this.adapters.length} 个源`);

    let combined: CrawlResult[] = [];

    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];

      try {
        const results = await adapter.crawl();
        combined.push(...results);
        log.info({ source: adapter.name, count: results.length }, '源抓取完成');
      } catch (err) {
        log.error({ source: adapter.name, error: (err as Error).message }, '爬虫任务失败');
      }

      // 源之间随机延迟 2-5 秒，避免并发暴露
      if (i < this.adapters.length - 1) {
        const delay = 2000 + Math.floor(Math.random() * 3000);
        log.debug({ source: adapter.name, nextDelay: delay }, '等待后抓取下一个源');
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // 去重、排序、限制数量
    combined = deduplicateResults(combined);
    combined = sortByHeat(combined);
    combined = combined.slice(0, config.CRAWL_MAX_ITEMS);

    log.info(`抓取完成，去重后共 ${combined.length} 条`);
    return combined;
  }

  async crawlAndSave(): Promise<number> {
    const results = await this.crawlAll();
    let saved = 0;

    for (const item of results) {
      // 检查是否已存在
      const existing = topicRepo.findByTitleAndSource(item.title, item.source);
      if (existing) continue;

      const category = classifyCategory(item.title, item.description);
      const sensitive = isSensitive(item.title, item.description) ? 1 : 0;
      const keywords = extractKeywords(item.title, item.description);

      topicRepo.create({
        source: item.source,
        title: item.title,
        url: item.url,
        description: item.description,
        heat_score: item.heat,
        category,
        keywords,
        is_sensitive: sensitive,
        is_processed: 0,
      });
      saved++;
    }

    log.info({ total: results.length, saved }, '热点保存完成');
    return saved;
  }
}
