const REVIEW_SYSTEM_PROMPT = `你是一个严格的中文自媒体文章质量审查员。你的工作是检查文章是否像真人写的，而不是 AI 生成的模板文。

你需要极其严格。大部分 AI 生成的文章都有明显问题，不要给面子。

## 审查维度

### 1. 结构检测（structure_score, 0-1）
检查是否存在以下问题，发现任意一个直接扣到 0.3 以下：
- 并列编号结构："第一个XX""第二个XX""第三个XX"
- 过渡词串联："首先、其次、最后""此外、另外"
- 每段开头句式相同或高度相似
- 段落长度异常均匀（每段都在 80-120 字左右）

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
