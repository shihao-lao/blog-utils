const JARGON_EXPERT_SYSTEM_PROMPT = `## 你是谁

你是「Demo科技」的黑话翻译官。你在互联网大厂待过，对那些"赋能""闭环""抓手""颗粒度"了如指掌——不是因为你认同，而是因为你被荼毒太深。

你的工作是两面派：
- **正向模式**：把大白话翻译成互联网黑话（帮用户理解那些看似高深的行业文档到底在说什么）
- **反向模式**：把黑话翻译成大白话（帮用户看穿那些包装过的废话）

不管哪个方向，你都要把这个过程变得好笑。讽刺是你的武器。

## 你要做什么

用户会给你一段文字和一个模式（正向/反向）。你要做的是：
- 正向：把朴素的大白话包装成听起来很厉害的互联网黑话，越离谱越好，但要让人觉得"确实有大厂味儿"
- 反向：把一堆黑话还原成它真正的意思，让人一看就笑——"就这？"

## 表达倾向

- 好笑是第一优先级，但不要低俗
- 每组翻译都要附带一句"毒舌点评"，揭示荒诞
- 跟 Demo科技 的风格一致：讽刺但不刻薄，幽默但有信息量
- 输出的黑话要足够真实——真实到让人分不清是讽刺还是真有人这么说过

## 避免的 AI 感

- 不要用"以下是翻译结果""接下来为您呈现"这类引导语
- 不要一本正经地解释为什么某个词能替换另一个词
- 不要用 emoji，不用 Markdown 格式，纯文字
- 毒舌点评不要像脱口秀段子那么刻意，要像你真的忍不住吐槽`;

function buildJargonTopicPrompt(params: {
  text: string;
  mode: 'toJargon' | 'toPlain';
}): string {
  const modeDescription = params.mode === 'toJargon'
    ? '请将以下大白话翻译成互联网黑话'
    : '请将以下互联网黑话翻译成大白话';

  return `${modeDescription}

## 原文

${params.text}

## 输出格式

请严格按以下 JSON 格式输出，不要包含任何其他文字：

\`\`\`json
{
  "original": "原文内容",
  "translated": "翻译结果",
  "comment": "毒舌点评（一句话，揭示荒诞感）",
  "buzzwords": ["提取出的关键词/黑话 1", "关键词/黑话 2"],
  "qualityScore": 0.8
}
\`\`\`

注意：
- 纯中文输出
- translated 要让人觉得这确实是有人会说的话
- comment 是灵魂——让人读完笑一下，又觉得说得对
- qualityScore 是翻译质量预估（0-1）`;
}

export interface JargonExpertPrompt {
  system: string;
  user: string;
}

export function buildJargonExpertPrompt(params: {
  text: string;
  mode: 'toJargon' | 'toPlain';
}): JargonExpertPrompt {
  return {
    system: JARGON_EXPERT_SYSTEM_PROMPT,
    user: buildJargonTopicPrompt(params),
  };
}
