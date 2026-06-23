/**
 * 提示词模块 - 爆款内容生成与质量审查
 *
 * 包含以下提示词：
 * - content.ts: 深度文章生成器（1500-2500 字爆款科技文章）
 * - comment.ts: 热点短评生成器（180-250 字爆款短评）
 * - philosopher.ts: 哲学视角分析器（概念本质还原式分析）
 * - jargonExpert.ts: 黑话翻译官（互联网黑话与大白话互译）
 * - review.ts: 质量审查器（文章和短评的质量评分与优化建议）
 */
export { buildContentPrompt } from './content.js';
export { buildCommentPrompt } from './comment.js';
export { buildArticleReviewPrompt, parseReviewResult } from './review.js';
export { buildPhilosopherPrompt } from './philosopher.js';
export { buildJargonExpertPrompt } from './jargonExpert.js';
export type { ReviewPrompt, ReviewResult } from './review.js';
export type { ContentPrompt } from './content.js';
export type { CommentPrompt } from './comment.js';
export type { PhilosopherPrompt } from './philosopher.js';
export type { JargonExpertPrompt } from './jargonExpert.js';
