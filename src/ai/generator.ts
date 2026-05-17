import { getAiProvider } from './factory.js';
import { buildContentPrompt } from '../prompts/content.js';
import { buildCommentPrompt } from '../prompts/comment.js';
import { buildArticleReviewPrompt, parseReviewResult, buildCommentReviewSystemPrompt, parseCommentReviewResult, mapCommentReviewToReviewResult } from '../prompts/review.js';
import { contentRepo, topicRepo } from '../database/repositories.js';
import { createModuleLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { config } from '../config/index.js';
import type { AiGenerationResult } from './types.js';
import type { ReviewResult } from '../prompts/review.js';

export type ContentType = 'article' | 'comment';

const log = createModuleLogger('ai:generator');

export class ContentGenerator {
  async generateForTopic(topicId: string, contentType: ContentType = 'article'): Promise<string | null> {
    const provider = getAiProvider();

    // 查找热点：先按 id 精确查找，再检查是否未处理
    const db = (await import('../database/index.js')).getDb();
    const topic = db.prepare('SELECT * FROM hot_topics WHERE id = ? AND is_processed = 0').get(topicId) as any;
    if (!topic) {
      log.warn({ topicId }, '未找到待处理的热点');
      return null;
    }

    log.info({ title: topic.title, source: topic.source, contentType }, '开始 AI 创作');

    const topicParams = {
      title: topic.title,
      description: topic.description,
      category: topic.category,
      keywords: Array.isArray(topic.keywords) ? topic.keywords : JSON.parse(topic.keywords as string),
      source: topic.source,
    };

    // 根据内容类型构建 Prompt
    const { system, user } = contentType === 'comment'
      ? buildCommentPrompt(topicParams)
      : buildContentPrompt(topicParams);

    // 调用 AI 生成
    const rawResult = await withRetry(() => provider.generate(user, system), {
      maxRetries: 3,
      delay: 3000,
    });

    // 解析 JSON 结果
    const parsed = this.parseResult(rawResult);
    if (!parsed) {
      log.error({ rawResult: rawResult.slice(0, 1000) }, 'AI 返回内容解析失败，原始内容前1000字符');
      return null;
    }

    log.info({ title: parsed.title, bodyLen: parsed.body.length, tags: parsed.tags, contentType }, '内容生成成功，开始质量审查');

    // 质量审查（根据内容类型选择审查 prompt）
    const review = contentType === 'comment'
      ? await this.reviewComment(provider, parsed.body)
      : await this.reviewArticle(provider, parsed.body);
    if (review) {
      log.info({
        overall: review.overall_score,
        structure: review.structure_score,
        content: review.content_score,
        tone: review.tone_score,
        passed: review.passed,
        issues: review.issues,
      }, review.passed ? '审查通过' : '审查未通过');
    }

    try {
      // 保存到数据库
      const contentId = contentRepo.create({
        topic_id: topicId,
        title: parsed.title || topic.title,
        body: parsed.body,
        cover_text: parsed.coverText,
        tags: parsed.tags,
        category: topic.category,
        content_type: contentType,
        emotion_score: parsed.emotionScore,
        quality_score: review?.overall_score ?? parsed.qualityScore,
        midjourney_prompt: parsed.midjourneyPrompt,
        sd_prompt: parsed.sdPrompt,
        flux_prompt: parsed.fluxPrompt,
        comment_guide: parsed.commentGuide,
        ai_provider: config.AI_PROVIDER,
        ai_model: this.getModelName(),
        status: 'draft',
      });

      // 保存审查结果
      if (review) {
        contentRepo.saveReview(contentId, review);
      }

      // 标记热点已处理
      topicRepo.markProcessed(topic.id);

      log.info({ contentId, title: parsed.title, reviewPassed: review?.passed }, 'AI 内容生成完成');
      return contentId;
    } catch (saveErr) {
      log.error({ error: (saveErr as Error).message, stack: (saveErr as Error).stack }, '保存到数据库失败');
      throw saveErr;
    }
  }

  private async reviewArticle(provider: ReturnType<typeof getAiProvider>, body: string): Promise<ReviewResult | null> {
    try {
      const { system, user } = buildArticleReviewPrompt(body);

      const rawReview = await withRetry(() => provider.generate(user, system), {
        maxRetries: 2,
        delay: 2000,
      });

      const review = parseReviewResult(rawReview);
      if (!review) {
        log.warn({ rawReview: rawReview.slice(0, 500) }, '审查结果解析失败');
        return null;
      }

      return review;
    } catch (err) {
      log.error({ error: (err as Error).message }, '质量审查失败，跳过');
      return null;
    }
  }

  private async reviewComment(provider: ReturnType<typeof getAiProvider>, body: string): Promise<ReviewResult | null> {
    try {
      const { system, user } = buildCommentReviewSystemPrompt(body);

      const rawReview = await withRetry(() => provider.generate(user, system), {
        maxRetries: 2,
        delay: 2000,
      });

      const commentReview = parseCommentReviewResult(rawReview);
      if (!commentReview) {
        log.warn({ rawReview: rawReview.slice(0, 500) }, '短评审查结果解析失败');
        return null;
      }

      return mapCommentReviewToReviewResult(commentReview);
    } catch (err) {
      log.error({ error: (err as Error).message }, '短评质量审查失败，跳过');
      return null;
    }
  }

  async generateBatch(limit = 5, contentType: ContentType = 'article'): Promise<string[]> {
    const topics = topicRepo.findUnprocessed(limit);
    const contentIds: string[] = [];

    for (const topic of topics) {
      try {
        const id = await this.generateForTopic(topic.id, contentType);
        if (id) contentIds.push(id);
      } catch (err) {
        log.error({ topicId: topic.id, error: (err as Error).message }, '批量生成失败');
      }
    }

    log.info({ total: topics.length, generated: contentIds.length, contentType }, '批量生成完成');
    return contentIds;
  }

  // 解析 AI 返回的 JSON。长文返回 titles/coverText/imagePrompts 等完整字段，
  // 短评只返回 body/tags/commentGuide/emotionScore/qualityScore，缺失字段由默认值兜底。
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
        body: this.cleanBody(data.body || ''),
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

  private cleanBody(body: string): string {
    // 移除模型元指令泄漏：不含中文字符的纯英文行（文章正文应为中文）
    const lines = body.split('\n');
    const cleaned = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      // 包含中文字符的行保留
      if (/[一-鿿]/.test(trimmed)) return true;
      // 纯英文行（看起来像句子的）移除
      if (/^[A-Za-z][\w\s,.'":;!?()-]{10,}$/.test(trimmed)) return false;
      return true;
    });
    return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
        if (!inString) {
          // Entering a string
          inString = true;
          result += ch;
        } else {
          // Inside a string, found a " — check if it's a real closing quote
          // A closing quote should be followed by :, , } ] or whitespace
          let j = i + 1;
          while (j < str.length && /\s/.test(str[j])) j++;
          const next = j < str.length ? str[j] : '';

          if (next === '' || /[:,\}\]]/.test(next)) {
            // Real closing quote
            inString = false;
            result += ch;
          } else {
            // Unescaped quote inside string content (e.g. Chinese "暂停键")
            result += '\\"';
          }
        }
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

    // 如果遍历结束时还在字符串内，说明 JSON 被截断了，补上闭合引号
    if (inString) {
      result += '"';
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
