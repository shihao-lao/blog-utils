import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { createInterface } from 'readline';

const dbPath = './data/auto_platform.db';
if (!existsSync(dbPath)) {
  console.error('数据库不存在');
  process.exit(1);
}

const target = process.argv[2] || 'contents';
const force = process.argv.includes('--yes') || process.argv.includes('-y');

const db = new Database(dbPath);

function countAll() {
  const topics = (db.prepare('SELECT COUNT(*) as cnt FROM hot_topics').get() as any).cnt;
  const contents = (db.prepare('SELECT COUNT(*) as cnt FROM ai_contents').get() as any).cnt;
  const publishes = (db.prepare('SELECT COUNT(*) as cnt FROM publish_records').get() as any).cnt;
  const tasks = (db.prepare('SELECT COUNT(*) as cnt FROM task_queue').get() as any).cnt;
  return { topics, contents, publishes, tasks };
}

async function confirm(message: string): Promise<boolean> {
  if (force) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

const before = countAll();

switch (target) {
  case 'contents':
  case 'c': {
    console.log(`\n当前数据: AI 内容 ${before.contents} 条, 发布记录 ${before.publishes} 条\n`);
    if (before.contents === 0) {
      console.log('没有可删除的 AI 内容');
      break;
    }
    const ok = await confirm(`确认删除全部 ${before.contents} 条 AI 内容？（关联的发布记录也会删除）`);
    if (!ok) { console.log('已取消'); break; }
    db.prepare('DELETE FROM publish_records').run();
    db.prepare('DELETE FROM ai_contents').run();
    const after = countAll();
    console.log(`\n已删除: AI 内容 ${before.contents - after.contents} 条, 发布记录 ${before.publishes - after.publishes} 条`);
    console.log(`剩余: 热点 ${after.topics}, AI 内容 ${after.contents}, 发布记录 ${after.publishes}`);
    break;
  }

  case 'topics':
  case 't': {
    console.log(`\n当前数据: 热点 ${before.topics} 条, AI 内容 ${before.contents} 条, 发布记录 ${before.publishes} 条\n`);
    if (before.topics === 0) {
      console.log('没有可删除的热点');
      break;
    }
    const ok = await confirm(`确认删除全部 ${before.topics} 条热点？（关联的 AI 内容和发布记录也会删除）`);
    if (!ok) { console.log('已取消'); break; }
    db.prepare('DELETE FROM publish_records').run();
    db.prepare('DELETE FROM ai_contents').run();
    db.prepare('DELETE FROM hot_topics').run();
    const after = countAll();
    console.log(`\n已删除: 热点 ${before.topics - after.topics}, AI 内容 ${before.contents - after.contents}, 发布记录 ${before.publishes - after.publishes}`);
    console.log(`剩余: 热点 ${after.topics}, AI 内容 ${after.contents}, 发布记录 ${after.publishes}`);
    break;
  }

  case 'all':
  case 'a': {
    console.log(`\n当前数据: 热点 ${before.topics}, AI 内容 ${before.contents}, 发布记录 ${before.publishes}, 任务 ${before.tasks}\n`);
    const ok = await confirm('确认清空全部数据？（所有热点、AI 内容、发布记录、任务队列都会删除）');
    if (!ok) { console.log('已取消'); break; }
    db.prepare('DELETE FROM publish_records').run();
    db.prepare('DELETE FROM task_queue').run();
    db.prepare('DELETE FROM ai_contents').run();
    db.prepare('DELETE FROM hot_topics').run();
    db.prepare('DELETE FROM run_logs').run();
    console.log('\n已清空全部数据');
    break;
  }

  default:
    console.log(`用法:
  pnpm run clear contents   删除所有 AI 内容和发布记录
  pnpm run clear topics     删除所有热点及关联数据
  pnpm run clear all        清空全部数据

选项:
  -y, --yes    跳过确认`);
}

db.close();
