import { httpClient } from '../../utils/http.js';
import { config } from '../../config/index.js';
import { createModuleLogger } from '../../utils/logger.js';
import type { AiProvider } from '../types.js';

const log = createModuleLogger('ai:gemini');

export class GeminiProvider implements AiProvider {
  name = 'gemini';

  async generate(prompt: string): Promise<string> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

      const res = await httpClient.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
        },
      });

      const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      log.info({ model: config.GEMINI_MODEL }, 'Gemini 生成完成');
      return content;
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Gemini 调用失败');
      throw err;
    }
  }
}
