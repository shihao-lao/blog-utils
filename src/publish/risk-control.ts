import { createModuleLogger } from '../utils/logger.js';
import { randomDelay } from '../utils/retry.js';
import { publishRepo } from '../database/repositories.js';
import { config } from '../config/index.js';

const log = createModuleLogger('publish:risk');

export class RiskController {
  /**
   * 检查是否可以发布
   */
  async canPublish(): Promise<{ allowed: boolean; reason?: string }> {
    // 检查今日发布数量
    const todayCount = publishRepo.getTodayCount('xiaohongshu');
    if (todayCount >= config.XHS_MAX_PUBLISH_PER_DAY) {
      return { allowed: false, reason: `今日已发布 ${todayCount} 条，达到上限` };
    }

    return { allowed: true };
  }

  /**
   * 发布前随机延迟，模拟真人行为
   */
  async prePublishDelay(): Promise<void> {
    // 随机等待 30-120 秒
    const delay = 30_000 + Math.floor(Math.random() * 90_000);
    log.info({ delayMs: delay }, '发布前随机延迟');
    await new Promise((r) => setTimeout(r, delay));
  }

  /**
   * 操作间随机延迟
   */
  async actionDelay(): Promise<void> {
    await randomDelay(1000, 3000);
  }

  /**
   * 长随机延迟（用于模拟阅读、思考）
   */
  async thinkDelay(): Promise<void> {
    await randomDelay(5000, 15000);
  }

  /**
   * 检查内容是否重复
   */
  isContentDuplicate(title: string, existingTitles: string[]): boolean {
    const normalized = title.replace(/[\s　]+/g, '').toLowerCase();
    return existingTitles.some((t) => {
      const existing = t.replace(/[\s　]+/g, '').toLowerCase();
      return this.similarity(normalized, existing) > 0.8;
    });
  }

  /**
   * 简单的字符串相似度计算
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;

    // 包含关系
    if (longer.includes(shorter)) return shorter.length / longer.length;

    // 字符交集
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter((c) => setB.has(c));
    return intersection.length / Math.max(setA.size, setB.size);
  }
}
