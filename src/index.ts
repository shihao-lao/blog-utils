import { initSchema } from './database/schema.js';
import { closeDb } from './database/index.js';
import { Scheduler } from './scheduler/index.js';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('main');

async function main() {
  log.info('========================================');
  log.info('  小红书自动化内容生产平台 v1.0.0');
  log.info('========================================');

  // 初始化数据库
  initSchema();

  // 启动调度系统
  const scheduler = new Scheduler();
  scheduler.start();

  // 优雅退出
  const shutdown = async () => {
    log.info('收到退出信号，正在关闭...');
    await scheduler.close();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log.info('平台已启动，等待定时任务触发...');

  // 保持进程运行
  await new Promise(() => {});
}

main().catch((err) => {
  log.error({ error: err.message }, '平台启动失败');
  process.exit(1);
});
