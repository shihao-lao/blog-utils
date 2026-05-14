import { httpClient } from '../../utils/http.js';
import { createModuleLogger } from '../../utils/logger.js';
import type { CrawlerAdapter, CrawlResult } from '../types.js';

const log = createModuleLogger('crawler:toutiao');

export class ToutiaoHotAdapter implements CrawlerAdapter {
  name = 'toutiao';

  async crawl(): Promise<CrawlResult[]> {
    try {
      const results: CrawlResult[] = [];

      const res = await httpClient.get(
        'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
        {
          headers: {
            Referer: 'https://www.toutiao.com/',
          },
        },
      );

      const data = res.data?.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item.Title) continue;
          results.push({
            title: item.Title,
            url: item.Url || '',
            description: item.Abstract || '',
            heat: parseInt(item.HotValue || '0', 10),
            source: 'toutiao',
          });
        }
      }

      log.info(`今日头条热榜获取成功，共 ${results.length} 条`);
      return results;
    } catch (err) {
      log.error({ error: (err as Error).message }, '今日头条热榜抓取失败');
      return [];
    }
  }
}
