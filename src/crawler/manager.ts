import { createModuleLogger } from '../utils/logger.js';
import { topicRepo } from '../database/repositories.js';
import { v4 as uuid } from 'uuid';
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

    const allResults = await Promise.allSettled(
      this.adapters.map((adapter) => adapter.crawl()),
    );

    let combined: CrawlResult[] = [];
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        combined.push(...result.value);
      } else {
        log.error({ error: result.reason }, '爬虫任务失败');
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
