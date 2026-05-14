import { initSchema } from '../database/schema.js';
import { closeDb, getDb } from '../database/index.js';
import { topicRepo } from '../database/repositories.js';
import { ContentGenerator } from '../ai/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { v4 as uuid } from 'uuid';
import * as readline from 'readline';

const log = createModuleLogger('cli:input');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  initSchema();

  console.log('========== 手动输入热点 ==========\n');
  console.log('输入热点信息，AI 会直接生成小红书内容\n');

  const title = await ask('热点标题: ');
  if (!title.trim()) {
    console.error('标题不能为空');
    process.exit(1);
  }

  const description = await ask('补充描述（可选，直接回车跳过）: ');
  const category = await ask('分类（科技/AI/娱乐/财经/体育/社会/生活/职场，直接回车=其他）: ') || '其他';
  const source = await ask('来源（直接回车=手动输入）: ') || '手动输入';

  rl.close();

  // 存入热点表
  const topicId = uuid();
  const db = getDb();
  db.prepare(`
    INSERT INTO hot_topics (id, source, title, description, heat_score, category, keywords, is_sensitive, is_processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(topicId, source, title.trim(), description.trim() || null, 999999, category, '[]', 0, 0);

  console.log(`\n热点已保存，ID: ${topicId}`);
  console.log('开始 AI 创作...\n');

  // AI 生成
  const generator = new ContentGenerator();
  const contentId = await generator.generateForTopic(topicId);

  if (contentId) {
    console.log(`\n生成完成！内容 ID: ${contentId}`);
    console.log(`查看内容: pnpm run view detail ${contentId}`);
    console.log(`导出为 Markdown: pnpm run view export`);
  } else {
    console.error('生成失败，请检查日志');
  }

  closeDb();
}

run().catch((err) => {
  log.error({ error: err.message }, '执行失败');
  process.exit(1);
});
