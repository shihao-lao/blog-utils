import { httpClient } from '../../utils/http.js';
import { createModuleLogger } from '../../utils/logger.js';
import type { CrawlerAdapter, CrawlResult } from '../types.js';

const log = createModuleLogger('crawler:baidu');

export class BaiduHotAdapter implements CrawlerAdapter {
  name = 'baidu';

  async crawl(): Promise<CrawlResult[]> {
    try {
      const results: CrawlResult[] = [];

      // 百度热搜
      const res = await httpClient.get('https://top.baidu.com/board?tab=realtime', {
        headers: {
          Referer: 'https://www.baidu.com/',
        },
        responseType: 'text',
      });

      // 解析 JSON embedded in HTML
      const html = res.data as string;
      const jsonMatch = html.match(/<!--s-data:(.*?)-->/s);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const cards = data?.data?.cards?.[0]?.content ?? [];
          for (const item of cards) {
            if (!item.word) continue;
            results.push({
              title: item.word,
              url: item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word)}`,
              description: item.desc || '',
              heat: parseInt(item.hotScore || '0', 10),
              source: 'baidu',
            });
          }
        } catch {
          log.warn('百度热搜 JSON 解析失败');
        }
      }

      log.info(`百度热搜获取成功，共 ${results.length} 条`);
      return results;
    } catch (err) {
      log.error({ error: (err as Error).message }, '百度热搜抓取失败');
      return [];
    }
  }
}
