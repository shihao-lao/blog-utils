import { initSchema } from '../database/schema.js';
import { closeDb } from '../database/index.js';
import { CrawlerManager } from '../crawler/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('cli:crawl');

async function run() {
  initSchema();

  const crawler = new CrawlerManager();
  const saved = await crawler.crawlAndSave();

  log.info(`抓取完成，新增 ${saved} 条热点`);

  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '抓取失败');
  process.exit(1);
});
