import { getAiProvider } from './factory.js';
import { buildContentPrompt } from '../prompts/content.js';
import { contentRepo, topicRepo } from '../database/repositories.js';
import { createModuleLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { config } from '../config/index.js';
import type { AiGenerationResult } from './types.js';

const log = createModuleLogger('ai:generator');

export class ContentGenerator {
  async generateForTopic(topicId: string): Promise<string | null> {
    const provider = getAiProvider();

    // 查找热点：先按 id 精确查找，再检查是否未处理
    const db = (await import('../database/index.js')).getDb();
    const topic = db.prepare('SELECT * FROM hot_topics WHERE id = ? AND is_processed = 0').get(topicId) as any;
    if (!topic) {
      log.warn({ topicId }, '未找到待处理的热点');
      return null;
    }

    log.info({ title: topic.title, source: topic.source }, '开始 AI 创作');

    // 构建 Prompt
    const prompt = buildContentPrompt({
      title: topic.title,
      description: topic.description,
      category: topic.category,
      keywords: Array.isArray(topic.keywords) ? topic.keywords : JSON.parse(topic.keywords as string),
      source: topic.source,
    });

    // 调用 AI 生成
    const rawResult = await withRetry(() => provider.generate(prompt), {
      maxRetries: 3,
      delay: 3000,
    });

    // 解析 JSON 结果
    const parsed = this.parseResult(rawResult);
    if (!parsed) {
      log.error({ rawResult: rawResult.slice(0, 1000) }, 'AI 返回内容解析失败，原始内容前1000字符');
      return null;
    }

    log.info({ title: parsed.title, bodyLen: parsed.body.length, tags: parsed.tags }, '解析成功，准备保存');

    try {
      // 保存到数据库
      const contentId = contentRepo.create({
        topic_id: topicId,
        title: parsed.title || topic.title,
        body: parsed.body,
        cover_text: parsed.coverText,
        tags: parsed.tags,
        category: topic.category,
        emotion_score: parsed.emotionScore,
        quality_score: parsed.qualityScore,
        midjourney_prompt: parsed.midjourneyPrompt,
        sd_prompt: parsed.sdPrompt,
        flux_prompt: parsed.fluxPrompt,
        comment_guide: parsed.commentGuide,
        ai_provider: config.AI_PROVIDER,
        ai_model: this.getModelName(),
        status: 'draft',
      });

      // 标记热点已处理
      topicRepo.markProcessed(topic.id);

      log.info({ contentId, title: parsed.title }, 'AI 内容生成完成');
      return contentId;
    } catch (saveErr) {
      log.error({ error: (saveErr as Error).message, stack: (saveErr as Error).stack }, '保存到数据库失败');
      throw saveErr;
    }
  }

  async generateBatch(limit = 5): Promise<string[]> {
    const topics = topicRepo.findUnprocessed(limit);
    const contentIds: string[] = [];

    for (const topic of topics) {
      try {
        const id = await this.generateForTopic(topic.id);
        if (id) contentIds.push(id);
      } catch (err) {
        log.error({ topicId: topic.id, error: (err as Error).message }, '批量生成失败');
      }
    }

    log.info({ total: topics.length, generated: contentIds.length }, '批量生成完成');
    return contentIds;
  }

  private parseResult(raw: string): AiGenerationResult | null {
    try {
      // 提取 JSON 块
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      let jsonStr = jsonMatch[1] || jsonMatch[0];

      // 修复常见 JSON 问题：body 字段中的未转义换行和引号
      jsonStr = this.sanitizeJson(jsonStr);

      log.debug({ jsonStr: jsonStr.slice(0, 500) }, '解析前 JSON');

      let data: any;
      try {
        data = JSON.parse(jsonStr);
      } catch (parseErr) {
        // 尝试修复：有些模型返回单引号或尾逗号
        const fixed = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        data = JSON.parse(fixed);
      }

      log.info({ keys: Object.keys(data), sample: JSON.stringify(data).slice(0, 300) }, 'AI 返回数据结构');

      return {
        title: data.titles?.[0] || '',
        body: data.body || '',
        coverText: data.coverText || '',
        tags: data.tags || [],
        commentGuide: data.commentGuide || '',
        midjourneyPrompt: data.midjourneyPrompt || '',
        sdPrompt: data.sdPrompt || '',
        fluxPrompt: data.fluxPrompt || '',
        emotionScore: data.emotionScore || 0.5,
        qualityScore: data.qualityScore || 0.5,
      };
    } catch (err) {
      log.error({ error: (err as Error).message }, 'JSON 解析失败');
      return null;
    }
  }

  private sanitizeJson(str: string): string {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];

      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        result += ch;
        continue;
      }

      if (inString) {
        if (ch === '\n') { result += '\\n'; continue; }
        if (ch === '\r') { result += '\\r'; continue; }
        result += ch;
      } else {
        result += ch;
      }
    }

    return result;
  }

  private getModelName(): string {
    switch (config.AI_PROVIDER) {
      case 'openai': return config.OPENAI_MODEL;
      case 'deepseek': return config.DEEPSEEK_MODEL;
      case 'gemini': return config.GEMINI_MODEL;
      default: return 'unknown';
    }
  }
}
