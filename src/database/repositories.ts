import { getDb } from './index.js';
import { v4 as uuid } from 'uuid';
import type { HotTopic, AiContent, PublishRecord, TaskQueueItem } from './types.js';

// ======================== HotTopic ========================

export const topicRepo = {
  create(topic: Omit<HotTopic, 'id' | 'created_at' | 'updated_at'>): string {
    const id = uuid();
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO hot_topics (id, source, title, url, description, heat_score, category, keywords, is_sensitive, is_processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, topic.source, topic.title, topic.url, topic.description, topic.heat_score, topic.category, JSON.stringify(topic.keywords), topic.is_sensitive, topic.is_processed);
    return id;
  },

  findByTitleAndSource(title: string, source: string): HotTopic | undefined {
    return getDb().prepare('SELECT * FROM hot_topics WHERE title = ? AND source = ?').get(title, source) as HotTopic | undefined;
  },

  findUnprocessed(limit = 50): HotTopic[] {
    return getDb().prepare('SELECT * FROM hot_topics WHERE is_processed = 0 AND is_sensitive = 0 ORDER BY heat_score DESC LIMIT ?').all(limit) as HotTopic[];
  },

  markProcessed(id: string): void {
    getDb().prepare("UPDATE hot_topics SET is_processed = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  },

  getRecentBySource(source: string, hours = 24): HotTopic[] {
    return getDb().prepare("SELECT * FROM hot_topics WHERE source = ? AND created_at > datetime('now', ?) ORDER BY heat_score DESC")
      .all(source, `-${hours} hours`) as HotTopic[];
  },
};

// ======================== AiContent ========================

export const contentRepo = {
  create(content: Omit<AiContent, 'id' | 'created_at' | 'updated_at'>): string {
    const id = uuid();
    const db = getDb();
    db.prepare(`
      INSERT INTO ai_contents (id, topic_id, title, body, cover_text, tags, category, emotion_score, quality_score, midjourney_prompt, sd_prompt, flux_prompt, comment_guide, ai_provider, ai_model, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, content.topic_id, content.title, content.body, content.cover_text, JSON.stringify(content.tags), content.category, content.emotion_score, content.quality_score, content.midjourney_prompt, content.sd_prompt, content.flux_prompt, content.comment_guide, content.ai_provider, content.ai_model, content.status);
    return id;
  },

  findById(id: string): AiContent | undefined {
    return getDb().prepare('SELECT * FROM ai_contents WHERE id = ?').get(id) as AiContent | undefined;
  },

  findByStatus(status: string, limit = 20): AiContent[] {
    return getDb().prepare('SELECT * FROM ai_contents WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit) as AiContent[];
  },

  updateStatus(id: string, status: string): void {
    getDb().prepare("UPDATE ai_contents SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  },

  saveReview(id: string, review: {
    structure_score: number;
    content_score: number;
    tone_score: number;
    opening_score: number;
    ending_score: number;
    overall_score: number;
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }): void {
    getDb().prepare(`
      UPDATE ai_contents SET
        review_structure_score = ?,
        review_content_score = ?,
        review_tone_score = ?,
        review_opening_score = ?,
        review_ending_score = ?,
        review_overall_score = ?,
        review_passed = ?,
        review_issues = ?,
        review_suggestions = ?,
        quality_score = ?,
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      review.structure_score,
      review.content_score,
      review.tone_score,
      review.opening_score,
      review.ending_score,
      review.overall_score,
      review.passed ? 1 : 0,
      JSON.stringify(review.issues),
      JSON.stringify(review.suggestions),
      review.overall_score,
      review.passed ? 'reviewed' : 'rejected',
      id,
    );
  },
};

// ======================== PublishRecord ========================

export const publishRepo = {
  create(record: Omit<PublishRecord, 'id' | 'created_at' | 'updated_at'>): string {
    const id = uuid();
    getDb().prepare(`
      INSERT INTO publish_records (id, content_id, platform, status, retry_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, record.content_id, record.platform, record.status, record.retry_count);
    return id;
  },

  findByStatus(status: string, limit = 20): PublishRecord[] {
    return getDb().prepare('SELECT * FROM publish_records WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit) as PublishRecord[];
  },

  updateStatus(id: string, status: string, extra?: Partial<PublishRecord>): void {
    const fields = ["status = ?", "updated_at = datetime('now')"];
    const values: unknown[] = [status];
    if (extra?.platform_post_id) { fields.push('platform_post_id = ?'); values.push(extra.platform_post_id); }
    if (extra?.platform_url) { fields.push('platform_url = ?'); values.push(extra.platform_url); }
    if (extra?.error_message) { fields.push('error_message = ?'); values.push(extra.error_message); }
    if (extra?.published_at) { fields.push('published_at = ?'); values.push(extra.published_at); }
    values.push(id);
    getDb().prepare(`UPDATE publish_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  incrementRetry(id: string): void {
    getDb().prepare("UPDATE publish_records SET retry_count = retry_count + 1, updated_at = datetime('now') WHERE id = ?").run(id);
  },

  getTodayCount(platform = 'xiaohongshu'): number {
    const row = getDb().prepare("SELECT COUNT(*) as cnt FROM publish_records WHERE platform = ? AND published_at > date('now') AND status = 'success'").get(platform) as { cnt: number };
    return row.cnt;
  },
};

// ======================== TaskQueue ========================

export const taskRepo = {
  enqueue(task: Omit<TaskQueueItem, 'id' | 'created_at'>): string {
    const id = uuid();
    getDb().prepare(`
      INSERT INTO task_queue (id, task_type, payload, priority, status, max_retries, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, task.task_type, task.payload, task.priority, task.status, task.max_retries, task.scheduled_at);
    return id;
  },

  dequeue(taskType?: string): TaskQueueItem | undefined {
    const where = taskType
      ? "WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) AND task_type = ?"
      : "WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))";
    const params = taskType ? [taskType] : [];
    const row = getDb().prepare(`SELECT * FROM task_queue ${where} ORDER BY priority DESC, created_at ASC LIMIT 1`).get(...params) as TaskQueueItem | undefined;
    if (row) {
      getDb().prepare("UPDATE task_queue SET status = 'running', started_at = datetime('now') WHERE id = ?").run(row.id);
    }
    return row;
  },

  complete(id: string, result?: string): void {
    getDb().prepare("UPDATE task_queue SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?").run(result ?? null, id);
  },

  fail(id: string, error: string): void {
    getDb().prepare("UPDATE task_queue SET status = 'failed', error = ?, retry_count = retry_count + 1 WHERE id = ?").run(error, id);
  },

  retryFailed(): void {
    getDb().prepare("UPDATE task_queue SET status = 'pending', scheduled_at = datetime('now', '+5 minutes') WHERE status = 'failed' AND retry_count < max_retries").run();
  },
};
