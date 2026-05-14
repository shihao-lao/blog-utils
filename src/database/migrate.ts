import { initSchema } from './schema.js';
import { closeDb } from './index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('migrate');

async function run() {
  log.info('开始数据库迁移...');
  initSchema();
  log.info('数据库迁移完成');
  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '迁移失败');
  process.exit(1);
});
