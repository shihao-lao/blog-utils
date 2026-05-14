import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
        level: config.LOG_LEVEL,
      },
      {
        target: 'pino/file',
        options: {
          destination: `${config.LOG_DIR}/app.log`,
          mkdir: true,
        },
        level: 'info',
      },
      {
        target: 'pino/file',
        options: {
          destination: `${config.LOG_DIR}/error.log`,
          mkdir: true,
        },
        level: 'error',
      },
    ],
  },
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
