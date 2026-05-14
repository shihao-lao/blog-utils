import { createModuleLogger } from './logger.js';
import { config } from '../config/index.js';

const log = createModuleLogger('retry');

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = config.MAX_RETRY,
    delay = config.RETRY_DELAY,
    backoff = 2,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        log.warn(
          { attempt, maxRetries, waitTime, error: lastError.message },
          `第 ${attempt} 次尝试失败，${waitTime}ms 后重试`,
        );
        if (onRetry) onRetry(lastError, attempt);
        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(ms);
}
