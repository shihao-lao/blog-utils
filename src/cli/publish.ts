import { initSchema } from '../database/schema.js';
import { closeDb } from '../database/index.js';
import { PublishManager } from '../publish/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('cli:publish');

async function run() {
  initSchema();

  const manager = new PublishManager();
  await manager.init();

  const limit = parseInt(process.argv[2] || '1', 10);
  log.info(`开始发布，最多 ${limit} 条`);

  const results = await manager.publishDraft(limit);

  for (const result of results) {
    if (result.success) {
      log.info('发布成功');
    } else {
      log.error({ error: result.error }, '发布失败');
    }
  }

  await manager.close();
  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '发布失败');
  process.exit(1);
});
