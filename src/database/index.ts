import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const log = createModuleLogger('database');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(config.DB_PATH), { recursive: true });
    db = new Database(config.DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    log.info({ path: config.DB_PATH }, '数据库已连接');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    log.info('数据库已关闭');
  }
}
