import { config } from '../config/index.js';
import { OpenAIProvider } from './providers/openai.js';
import { DeepSeekProvider } from './providers/deepseek.js';
import { GeminiProvider } from './providers/gemini.js';
import type { AiProvider } from './types.js';

let provider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (provider) return provider;

  switch (config.AI_PROVIDER) {
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'deepseek':
      provider = new DeepSeekProvider();
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    default:
      throw new Error(`不支持的 AI 提供商: ${config.AI_PROVIDER}`);
  }

  return provider;
}
