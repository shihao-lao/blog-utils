import { execSync } from 'child_process';

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
let type = '';
if (typeIdx !== -1 && args[typeIdx + 1]) {
  type = args[typeIdx + 1];
  if (type !== 'article' && type !== 'comment' && type !== 'philosopher' && type !== 'jargon') {
    console.error('无效的 --type，支持: article | comment | philosopher | jargon');
    process.exit(1);
  }
}

const steps = [
  { name: 'crawl', cmd: 'pnpm run crawl' },
  {
    name: 'generate',
    cmd: type ? `pnpm run generate --type ${type}` : 'pnpm run generate',
  },
  { name: 'view', cmd: 'pnpm run view' },
  { name: 'export', cmd: 'pnpm run view export' },
];

for (const step of steps) {
  console.log(`\n========== [${step.name}] 开始 ==========\n`);
  try {
    execSync(step.cmd, { stdio: 'inherit' });
    console.log(`\n✅ [${step.name}] 完成\n`);
  } catch (err) {
    console.error(`\n❌ [${step.name}] 失败\n`);
    process.exit(1);
  }
}

console.log('\n🎉 全部流程执行完成');
