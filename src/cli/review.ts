import { initSchema } from '../database/schema.js';
import { getDb, closeDb } from '../database/index.js';
import { contentRepo } from '../database/repositories.js';
import { getAiProvider } from '../ai/factory.js';
import { buildArticleReviewPrompt, parseReviewResult, buildCommentReviewSystemPrompt, parseCommentReviewResult, mapCommentReviewToReviewResult } from '../prompts/review.js';
import { createModuleLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

const log = createModuleLogger('cli:review');

async function run() {
  initSchema();
  const db = getDb();
  const provider = getAiProvider();

  const limit = parseInt(process.argv[2] || '999', 10);

  // 查找所有没有审查结果的内容
  const rows = db.prepare(`
    SELECT id, title, body, content_type FROM ai_contents
    WHERE review_overall_score IS NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  if (rows.length === 0) {
    console.log('没有需要审查的内容');
    closeDb();
    return;
  }

  console.log(`找到 ${rows.length} 条待审查内容，开始审查...\n`);

  let passed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      log.info({ title: row.title }, '开始审查');

      const isComment = row.content_type === 'comment';

      const { system, user } = isComment
        ? buildCommentReviewSystemPrompt(row.body)
        : buildArticleReviewPrompt(row.body);
      const rawReview = await withRetry(() => provider.generate(user, system), {
        maxRetries: 2,
        delay: 2000,
      });

      let review;
      if (isComment) {
        const commentReview = parseCommentReviewResult(rawReview);
        review = commentReview ? mapCommentReviewToReviewResult(commentReview) : null;
      } else {
        review = parseReviewResult(rawReview);
      }
      if (!review) {
        log.warn({ title: row.title }, '审查结果解析失败，跳过');
        continue;
      }

      contentRepo.saveReview(row.id, review);

      const status = review.passed ? 'PASS' : 'FAIL';
      if (review.passed) passed++; else failed++;

      console.log(`  [${status}] ${review.overall_score.toFixed(2)} | ${row.title}`);
      if (review.issues.length > 0) {
        review.issues.forEach((issue: string) => console.log(`         ! ${issue}`));
      }
    } catch (err) {
      log.error({ title: row.title, error: (err as Error).message }, '审查失败');
      console.log(`  [ERR]  ${row.title} - ${(err as Error).message}`);
    }
  }

  console.log(`\n审查完成: ${passed} 通过, ${failed} 未通过`);
  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '审查任务失败');
  process.exit(1);
});
