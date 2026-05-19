import { httpClient } from '../../utils/http.js';
import { createModuleLogger } from '../../utils/logger.js';
import type { CrawlerAdapter, CrawlResult } from '../types.js';

const log = createModuleLogger('crawler:weibo');

export class WeiboHotAdapter implements CrawlerAdapter {
  name = 'weibo';

  async crawl(): Promise<CrawlResult[]> {
    try {
      const results: CrawlResult[] = [];

      // 微博热搜 API
      const res = await httpClient.get('https://weibo.com/ajax/side/hotSearch', {
        headers: {
          Referer: 'https://weibo.com/',
          Cookie: 'SUB=_2AkMS_example',
        },
      });

      const data = res.data?.data?.realtime;
      if (!Array.isArray(data)) {
        log.warn('微博热搜数据格式异常');
        return [];
      }

      for (const item of data) {
        if (!item.word) continue;
        const images: string[] = [];
        if (Array.isArray(item.pic_urls)) {
          for (const pic of item.pic_urls) {
            const url = pic.thumbnail_pic || pic.bmiddle_pic || pic.original_pic;
            if (url) images.push(url);
          }
        }
        results.push({
          title: item.word,
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}`,
          description: item.note || '',
          heat: item.num || item.raw_hot || 0,
          source: 'weibo',
          images: images.length > 0 ? images : undefined,
        });
      }

      log.info(`微博热搜获取成功，共 ${results.length} 条`);
      return results;
    } catch (err) {
      log.error({ error: (err as Error).message }, '微博热搜抓取失败');
      return [];
    }
  }
}
