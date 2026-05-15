import { getDb } from './index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('schema');

export function initSchema(): void {
  const db = getDb();

  db.exec(`
    -- 热点话题表
    CREATE TABLE IF NOT EXISTS hot_topics (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      heat_score INTEGER DEFAULT 0,
      category TEXT DEFAULT '其他',
      keywords TEXT DEFAULT '[]',
      is_sensitive INTEGER DEFAULT 0,
      is_processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hot_topics_source ON hot_topics(source);
    CREATE INDEX IF NOT EXISTS idx_hot_topics_category ON hot_topics(category);
    CREATE INDEX IF NOT EXISTS idx_hot_topics_created ON hot_topics(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_topics_title_source ON hot_topics(title, source);

    -- AI 生成内容表
    CREATE TABLE IF NOT EXISTS ai_contents (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      cover_text TEXT,
      tags TEXT DEFAULT '[]',
      category TEXT,
      emotion_score REAL DEFAULT 0,
      quality_score REAL DEFAULT 0,
      midjourney_prompt TEXT,
      sd_prompt TEXT,
      flux_prompt TEXT,
      comment_guide TEXT,
      ai_provider TEXT,
      ai_model TEXT,
      status TEXT DEFAULT 'draft',
      review_structure_score REAL,
      review_content_score REAL,
      review_tone_score REAL,
      review_opening_score REAL,
      review_ending_score REAL,
      review_overall_score REAL,
      review_passed INTEGER DEFAULT 0,
      review_issues TEXT DEFAULT '[]',
      review_suggestions TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_contents_status ON ai_contents(status);
    CREATE INDEX IF NOT EXISTS idx_ai_contents_topic ON ai_contents(topic_id);

    -- 发布记录表
    CREATE TABLE IF NOT EXISTS publish_records (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'xiaohongshu',
      status TEXT DEFAULT 'pending',
      platform_post_id TEXT,
      platform_url TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (content_id) REFERENCES ai_contents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_publish_records_status ON publish_records(status);
    CREATE INDEX IF NOT EXISTS idx_publish_records_platform ON publish_records(platform);

    -- 任务队列表
    CREATE TABLE IF NOT EXISTS task_queue (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      result TEXT,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
    CREATE INDEX IF NOT EXISTS idx_task_queue_type ON task_queue(task_type);
    CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority DESC);

    -- 运行日志表
    CREATE TABLE IF NOT EXISTS run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      message TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_run_logs_module ON run_logs(module);
    CREATE INDEX IF NOT EXISTS idx_run_logs_created ON run_logs(created_at);
  `);

  // 迁移：添加审查相关列（已存在则忽略）
  const alterStatements = [
    "ALTER TABLE ai_contents ADD COLUMN review_structure_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_content_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_tone_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_opening_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_ending_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_overall_score REAL",
    "ALTER TABLE ai_contents ADD COLUMN review_passed INTEGER DEFAULT 0",
    "ALTER TABLE ai_contents ADD COLUMN review_issues TEXT DEFAULT '[]'",
    "ALTER TABLE ai_contents ADD COLUMN review_suggestions TEXT DEFAULT '[]'",
  ];

  for (const sql of alterStatements) {
    try { db.exec(sql); } catch { /* 列已存在，忽略 */ }
  }

  log.info('数据库表结构初始化完成');
}
