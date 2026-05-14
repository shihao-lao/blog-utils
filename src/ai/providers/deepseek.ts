import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { createModuleLogger } from '../../utils/logger.js';
import type { AiProvider } from '../types.js';

const log = createModuleLogger('ai:deepseek');

export class DeepSeekProvider implements AiProvider {
  name = 'deepseek';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.DEEPSEEK_API_KEY,
      baseURL: config.DEEPSEEK_BASE_URL,
    });
  }

  async generate(prompt: string): Promise<string> {
    try {
      const res = await this.client.chat.completions.create({
        model: config.DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 4096,
      });

      const content = res.choices[0]?.message?.content ?? '';
      log.info({ model: config.DEEPSEEK_MODEL, tokens: res.usage?.total_tokens }, 'DeepSeek 生成完成');
      return content;
    } catch (err) {
      log.error({ error: (err as Error).message }, 'DeepSeek 调用失败');
      throw err;
    }
  }
}
