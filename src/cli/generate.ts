import { initSchema } from '../database/schema.js';
import { closeDb } from '../database/index.js';
import { ContentGenerator } from '../ai/index.js';
import { createModuleLogger } from '../utils/logger.js';
import type { ContentType } from '../ai/generator.js';

const log = createModuleLogger('cli:generate');

async function run() {
  initSchema();

  const generator = new ContentGenerator();

  // 解析参数：pnpm run generate [N] [--type article|comment]
  const args = process.argv.slice(2);
  const numArg = args.find(a => !isNaN(parseInt(a, 10)));
  const limit = numArg ? parseInt(numArg, 10) : 3;
  let contentType: ContentType = 'article';

  const typeIdx = args.indexOf('--type');
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    const t = args[typeIdx + 1];
    if (t === 'comment' || t === 'article') {
      contentType = t;
    } else {
      log.error(`无效的内容类型: ${t}，支持 article 或 comment`);
      process.exit(1);
    }
  }

  const typeLabel = contentType === 'comment' ? '短评' : '长文';
  log.info(`开始 AI ${typeLabel}创作，最多 ${limit} 条`);
  const ids = await generator.generateBatch(limit, contentType);

  log.info(`${typeLabel}创作完成，生成 ${ids.length} 条内容`);

  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '创作失败');
  process.exit(1);
});
