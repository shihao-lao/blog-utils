const REVIEW_SYSTEM_PROMPT = `你是一个严格的中文自媒体文章质量审查员。你的工作是检查文章是否像真人写的，而不是 AI 生成的模板文。

你需要极其严格。大部分 AI 生成的文章都有明显问题，不要给面子。

## 审查维度

### 1. 结构检测（structure_score, 0-1）
检查是否存在以下问题，发现任意一个直接扣到 0.3 以下：
- 并列编号结构："第一个XX""第二个XX""第三个XX"
- 过渡词串联："首先、其次、最后""此外、另外"
- 每段开头句式相同或高度相似
- 段落长度异常均匀（每段都在 80-120 字左右）
- 正文中出现 Markdown 格式符号：两个星号包裹的加粗（如"**重要**"）、井号标题、下划线、波浪线、反引号等。这些符号在公众号正文里不会被渲染，暴露了 AI 写作痕迹。发现加粗标记直接扣到 0.3 以下

### 2. 内容增量（content_score, 0-1）
检查是否存在"正确的废话"：
- "技术很重要""行业在变化"这类放之四海而皆准的废话
- 没有具体数字、案例、人名、工具名
- 观点都是大众共识，没有任何反直觉的判断
- 案例泛泛："很多人""很多公司""某些场景"

### 3. 语气真实度（tone_score, 0-1）
检查是否像真人说话：
- 有没有口语化表达（说实话、你别笑、这事儿）
- 有没有不确定的语气（我不确定、可能是我多想了）
- 有没有短句和长句的交替
- 有没有破折号、省略号等标点变化
- 读起来像聊天还是像念稿

### 4. 开头吸引力（opening_score, 0-1）
- 前 50 字能不能让人想继续读
- 有没有用场景/反直觉判断/具体事件切入
- "随着XX的发展""最近XX发生了大事"直接给 0

### 5. 结尾质量（ending_score, 0-1）
- 结尾有没有留钩子
- "总之""未来已来""让我们拭目以待"直接给 0
- 好的结尾应该是：一个问题、一个预测、一个争议点

## 输出格式

请严格按以下 JSON 格式输出，不要包含任何其他文字：

\`\`\`json
{
  "structure_score": 0.8,
  "content_score": 0.7,
  "tone_score": 0.6,
  "opening_score": 0.9,
  "ending_score": 0.7,
  "overall_score": 0.74,
  "passed": true,
  "issues": ["第二个信号段落内容偏空洞，缺少具体案例", "有两处'正确的废话'"],
  "suggestions": ["建议将并列结构改为叙事推进", "补充具体数字或案例"]
}
\`\`\`

评分标准：
- overall_score = structure_score * 0.3 + content_score * 0.3 + tone_score * 0.2 + opening_score * 0.1 + ending_score * 0.1
- passed: overall_score >= 0.65 且 structure_score >= 0.5 且 content_score >= 0.5
- 如果 structure_score < 0.5，说明文章有并列模板结构，这是最严重的问题`;

function buildReviewPrompt(body: string): string {
  return `请审查以下文章的质量，严格按照评分标准打分。

## 待审查文章

${body}

请输出 JSON 审查结果：`;
}

export interface ReviewPrompt {
  system: string;
  user: string;
}

export interface ReviewResult {
  structure_score: number;
  content_score: number;
  tone_score: number;
  opening_score: number;
  ending_score: number;
  overall_score: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

export function buildArticleReviewPrompt(body: string): ReviewPrompt {
  return {
    system: REVIEW_SYSTEM_PROMPT,
    user: buildReviewPrompt(body),
  };
}

// ======================== 短评审查 ========================

const COMMENT_REVIEW_SYSTEM_PROMPT = `你是一个严格的中文短评质量审查员。你的工作是检查一条 180-250 字的热点短评是否像真人写的，而不是 AI 生成的模板文。

短评不是长文章，不需要"认知转折"或"深度论证"。它的价值在于：一句话说清事件，一个观察角度，一句轻度收尾。自然、口语、克制。

## 审查维度

### 1. 结构检测（structure_score, 0-1）
- 短评应该是三段式自然过渡：事件概括 → 一个观察 → 轻度收尾
- 发现并列编号结构（第一、第二、第三）直接扣到 0.3 以下
- 发现"首先、其次、最后"过渡词直接扣到 0.3 以下
- 发现分点论述直接扣到 0.2
- 正文中出现 Markdown 格式符号（加粗星号、井号、下划线等）直接扣到 0.3 以下

### 2. 内容增量（content_score, 0-1）
- 不需要深度论证，但不能是"正确的废话"
- "这很正常""大家都不容易"这类空洞表达扣分
- 有一个具体的观察角度即可，不需要多个

### 3. 语气真实度（tone_score, 0-1）
- 检查是否像真人发朋友圈/即刻/小红书
- 有没有口语化表达
- 有没有轻微调侃但不攻击
- 读起来像聊天还是像念稿
- 不能太书面化、太正式

### 4. 字数控制（length_score, 0-1）
- 180-250 字为满分区间
- 低于 120 字或超过 300 字扣分
- 低于 80 字或超过 350 字直接给 0.2

### 5. AI 味检测（ai_score, 0-1）
- "值得深思""这背后反映了""我们不得不承认" → 直接 0
- "时代的一粒灰""雪崩时" → 直接 0
- "未来已来""让我们拭目以待" → 直接 0
- "赋能""底层逻辑""颗粒度" → 直接 0
- 发现 emoji 表情 → 扣到 0.5 以下
- 正文中出现加粗标记（两个星号包裹的文字，如"**重要**"）→ 直接 0.3，这是最明显的 AI 写作痕迹

## 输出格式

请严格按以下 JSON 格式输出，不要包含任何其他文字：

\`\`\`json
{
  "structure_score": 0.8,
  "content_score": 0.7,
  "tone_score": 0.6,
  "length_score": 0.9,
  "ai_score": 0.8,
  "overall_score": 0.74,
  "passed": true,
  "issues": ["结尾偏鸡汤", "中间观察太泛"],
  "suggestions": ["结尾改成轻度反问", "观察角度可以更具体"]
}
\`\`\`

评分标准：
- overall_score = structure_score * 0.2 + content_score * 0.25 + tone_score * 0.25 + length_score * 0.1 + ai_score * 0.2
- passed: overall_score >= 0.6 且 tone_score >= 0.5 且 ai_score >= 0.6
- 短评的审查标准比长文章略宽松，重点看语气和 AI 味`;

function buildCommentReviewPrompt(body: string): string {
  return `请审查以下热点短评的质量，严格按照评分标准打分。

## 待审查短评

${body}

请输出 JSON 审查结果：`;
}

export function buildCommentReviewSystemPrompt(body: string): ReviewPrompt {
  return {
    system: COMMENT_REVIEW_SYSTEM_PROMPT,
    user: buildCommentReviewPrompt(body),
  };
}

// 短评使用不同的评分维度，需要映射回通用 ReviewResult
export interface CommentReviewResult {
  structure_score: number;
  content_score: number;
  tone_score: number;
  length_score: number;
  ai_score: number;
  overall_score: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

export function parseCommentReviewResult(raw: string): CommentReviewResult | null {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const data = JSON.parse(jsonStr);

    return {
      structure_score: data.structure_score ?? 0,
      content_score: data.content_score ?? 0,
      tone_score: data.tone_score ?? 0,
      length_score: data.length_score ?? 0,
      ai_score: data.ai_score ?? 0,
      overall_score: data.overall_score ?? 0,
      passed: data.passed ?? false,
      issues: data.issues ?? [],
      suggestions: data.suggestions ?? [],
    };
  } catch {
    return null;
  }
}

// 将短评审查结果映射到通用 ReviewResult（兼容数据库存储）
export function mapCommentReviewToReviewResult(cr: CommentReviewResult): ReviewResult {
  return {
    structure_score: cr.structure_score,
    content_score: cr.content_score,
    tone_score: cr.tone_score,
    opening_score: cr.length_score,   // length_score → opening_score 列复用
    ending_score: cr.ai_score,        // ai_score → ending_score 列复用
    overall_score: cr.overall_score,
    passed: cr.passed,
    issues: cr.issues,
    suggestions: cr.suggestions,
  };
}

export function parseReviewResult(raw: string): ReviewResult | null {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const data = JSON.parse(jsonStr);

    return {
      structure_score: data.structure_score ?? 0,
      content_score: data.content_score ?? 0,
      tone_score: data.tone_score ?? 0,
      opening_score: data.opening_score ?? 0,
      ending_score: data.ending_score ?? 0,
      overall_score: data.overall_score ?? 0,
      passed: data.passed ?? false,
      issues: data.issues ?? [],
      suggestions: data.suggestions ?? [],
    };
  } catch {
    return null;
  }
}
