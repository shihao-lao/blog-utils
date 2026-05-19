import { httpClient } from '../../utils/http.js';
import { createModuleLogger } from '../../utils/logger.js';
import { parseStringPromise } from 'xml2js';
import { config } from '../../config/index.js';
import type { CrawlerAdapter, CrawlResult } from '../types.js';

const log = createModuleLogger('crawler:rss');

export class RSSAdapter implements CrawlerAdapter {
  name = 'rss';

  async crawl(): Promise<CrawlResult[]> {
    const feeds = config.RSS_FEEDS?.split(',').map((f) => f.trim()).filter(Boolean) ?? [];
    if (feeds.length === 0) {
      log.debug('未配置 RSS 源');
      return [];
    }

    const results: CrawlResult[] = [];

    for (const feedUrl of feeds) {
      try {
        const res = await httpClient.get(feedUrl, { responseType: 'text', timeout: 15_000 });
        const parsed = await parseStringPromise(res.data, { explicitArray: false });
        const channel = parsed?.rss?.channel ?? parsed?.feed;
        const items = channel?.item ?? channel?.entry ?? [];

        const itemList = Array.isArray(items) ? items : [items];

        for (const item of itemList) {
          const title = item.title?._ ?? item.title ?? '';
          const link = item.link?._ ?? item.link?.href ?? item.link ?? '';
          const desc = item.description?._ ?? item.description ?? item.summary?._ ?? item.summary ?? '';

          if (!title) continue;

          // 提取图片：media:content / media:thumbnail / enclosure
          const images: string[] = [];
          const mediaContent = item['media:content'] ?? item.media?.content;
          if (mediaContent) {
            const items = Array.isArray(mediaContent) ? mediaContent : [mediaContent];
            for (const m of items) {
              if (m.$?.url) images.push(m.$.url);
              else if (typeof m === 'string') images.push(m);
            }
          }
          const mediaThumbnail = item['media:thumbnail'] ?? item.media?.thumbnail;
          if (mediaThumbnail) {
            const items = Array.isArray(mediaThumbnail) ? mediaThumbnail : [mediaThumbnail];
            for (const m of items) {
              if (m.$?.url) images.push(m.$.url);
              else if (typeof m === 'string') images.push(m);
            }
          }
          const enclosure = item.enclosure;
          if (enclosure) {
            const items = Array.isArray(enclosure) ? enclosure : [enclosure];
            for (const e of items) {
              if (e.$?.type?.startsWith('image/') && e.$.url) images.push(e.$.url);
            }
          }

          results.push({
            title: typeof title === 'string' ? title.trim() : String(title).trim(),
            url: typeof link === 'string' ? link : String(link),
            description: typeof desc === 'string' ? desc.slice(0, 200) : String(desc).slice(0, 200),
            heat: 100,
            source: `rss:${new URL(feedUrl).hostname}`,
            images: images.length > 0 ? images : undefined,
          });
        }

        log.info(`RSS 源 ${feedUrl} 获取 ${itemList.length} 条`);
      } catch (err) {
        log.error({ feed: feedUrl, error: (err as Error).message }, 'RSS 抓取失败');
      }
    }

    return results;
  }
}
