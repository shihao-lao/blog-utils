import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dbPath = './data/auto_platform.db';
if (!existsSync(dbPath)) {
  console.error('数据库不存在，请先运行 pnpm run crawl');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const command = process.argv[2] || 'summary';

switch (command) {
  case 'summary':
  case 's': {
    console.log('========== 数据概览 ==========\n');
    const topics = db.prepare('SELECT COUNT(*) as cnt FROM hot_topics').get() as any;
    const processed = db.prepare('SELECT COUNT(*) as cnt FROM hot_topics WHERE is_processed=1').get() as any;
    const contents = db.prepare('SELECT COUNT(*) as cnt FROM ai_contents').get() as any;
    const published = db.prepare("SELECT COUNT(*) as cnt FROM publish_records WHERE status='success'").get() as any;

    console.log(`热点总数: ${topics.cnt} (已处理: ${processed.cnt})`);
    console.log(`AI 内容: ${contents.cnt}`);
    console.log(`已发布: ${published.cnt}`);

    const bySource = db.prepare('SELECT source, COUNT(*) as cnt FROM hot_topics GROUP BY source').all() as any[];
    console.log('\n按来源:');
    bySource.forEach((r: any) => console.log(`  ${r.source}: ${r.cnt}条`));

    const byCategory = db.prepare('SELECT category, COUNT(*) as cnt FROM hot_topics GROUP BY category ORDER BY cnt DESC').all() as any[];
    console.log('\n按分类:');
    byCategory.forEach((r: any) => console.log(`  ${r.category}: ${r.cnt}条`));
    break;
  }

  case 'topics':
  case 't': {
    const limit = parseInt(process.argv[3] || '20', 10);
    const rows = db.prepare('SELECT title, source, heat_score, category, is_processed FROM hot_topics ORDER BY heat_score DESC LIMIT ?').all(limit) as any[];
    console.log(`========== 热点 Top ${limit} ==========\n`);
    rows.forEach((r: any, i: number) => {
      const status = r.is_processed ? '✓' : '○';
      console.log(`${(i+1).toString().padStart(2)}. [${status}] [${r.source}] ${r.title}`);
      console.log(`    热度: ${r.heat_score} | 分类: ${r.category}`);
    });
    break;
  }

  case 'contents':
  case 'c': {
    const limit = parseInt(process.argv[3] || '10', 10);
    const rows = db.prepare(`
      SELECT c.id, c.title, c.status, c.tags, c.emotion_score, c.quality_score, c.ai_provider, t.title as topic_title
      FROM ai_contents c
      LEFT JOIN hot_topics t ON c.topic_id = t.id
      ORDER BY c.created_at DESC LIMIT ?
    `).all(limit) as any[];
    console.log(`========== AI 内容 Top ${limit} ==========\n`);
    if (rows.length === 0) {
      console.log('暂无 AI 内容，请先运行 pnpm run generate');
    }
    rows.forEach((r: any, i: number) => {
      const tags = typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags;
      console.log(`${i+1}. ${r.title}`);
      console.log(`   热点: ${r.topic_title}`);
      console.log(`   状态: ${r.status} | 情绪: ${r.emotion_score} | 质量: ${r.quality_score}`);
      console.log(`   AI: ${r.ai_provider} | 标签: ${tags.join(' ')}`);
      console.log('');
    });
    break;
  }

  case 'detail':
  case 'd': {
    const contentId = process.argv[3];
    if (!contentId) {
      console.error('用法: pnpm run view detail <content_id>');
      console.error('先运行 pnpm run view contents 查看 ID 列表');
      process.exit(1);
    }
    const row = db.prepare(`
      SELECT c.*, t.title as topic_title, t.source as topic_source
      FROM ai_contents c
      LEFT JOIN hot_topics t ON c.topic_id = t.id
      WHERE c.id = ?
    `).get(contentId) as any;
    if (!row) {
      console.error('未找到该内容');
      process.exit(1);
    }
    const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
    console.log('========== 内容详情 ==========\n');
    console.log(`热点: ${row.topic_title} (${row.topic_source})`);
    console.log(`状态: ${row.status}\n`);
    console.log(`--- 标题 ---\n${row.title}\n`);
    console.log(`--- 封面文案 ---\n${row.cover_text}\n`);
    console.log(`--- 正文 ---\n${row.body}\n`);
    console.log(`--- 标签 ---\n${tags.join(' ')}\n`);
    console.log(`--- 评论引导 ---\n${row.comment_guide}\n`);
    console.log(`--- Midjourney Prompt ---\n${row.midjourney_prompt}\n`);
    console.log(`--- Stable Diffusion Prompt ---\n${row.sd_prompt}\n`);
    console.log(`--- Flux Prompt ---\n${row.flux_prompt}\n`);
    break;
  }

  case 'export':
  case 'e': {
    const outDir = './data/exports';
    mkdirSync(outDir, { recursive: true });

    const contents = db.prepare(`
      SELECT c.*, t.title as topic_title
      FROM ai_contents c
      LEFT JOIN hot_topics t ON c.topic_id = t.id
      WHERE c.status = 'draft'
      ORDER BY c.created_at DESC
    `).all() as any[];

    if (contents.length === 0) {
      console.log('没有待导出的内容');
      break;
    }

    for (const row of contents) {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      const safeName = row.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 50);
      const md = `# ${row.title}

## 封面文案
${row.cover_text}

## 正文
${row.body}

## 标签
${tags.join(' ')}

## 评论引导
${row.comment_guide}

## Midjourney Prompt
${row.midjourney_prompt}

## Stable Diffusion Prompt
${row.sd_prompt}

## Flux Prompt
${row.flux_prompt}

---
热点来源: ${row.topic_title}
情绪分数: ${row.emotion_score}
质量分数: ${row.quality_score}
AI: ${row.ai_provider} / ${row.ai_model}
`;
      writeFileSync(join(outDir, `${safeName}.md`), md);
    }

    console.log(`已导出 ${contents.length} 条内容到 ${outDir}/`);
    break;
  }

  default:
    console.log(`用法:
  pnpm run view summary     数据概览
  pnpm run view topics      热点列表
  pnpm run view contents    AI 内容列表
  pnpm run view detail <id> 查看内容详情
  pnpm run view export      导出所有 draft 内容为 Markdown`);
}

db.close();
