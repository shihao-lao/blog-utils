import { initSchema } from '../database/schema.js';
import { closeDb } from '../database/index.js';
import { ContentGenerator } from '../ai/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('cli:generate');

async function run() {
  initSchema();

  const generator = new ContentGenerator();
  const limit = parseInt(process.argv[2] || '3', 10);

  log.info(`开始 AI 创作，最多 ${limit} 条`);
  const ids = await generator.generateBatch(limit);

  log.info(`创作完成，生成 ${ids.length} 条内容`);

  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '创作失败');
  process.exit(1);
});
