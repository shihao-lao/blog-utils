import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  AI_PROVIDER: z.enum(['openai', 'deepseek', 'gemini']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  CRAWL_INTERVAL: z.coerce.number().default(60),
  CRAWL_MAX_ITEMS: z.coerce.number().default(50),
  CRAWL_PROXY: z.string().optional(),
  RSS_FEEDS: z.string().optional(),

  DB_PATH: z.string().default('./data/auto_platform.db'),

  XHS_COOKIE_PATH: z.string().default('./data/xhs_cookies.json'),
  XHS_HEADLESS: z.coerce.boolean().default(true),
  XHS_PROXY: z.string().optional(),
  XHS_MAX_PUBLISH_PER_DAY: z.coerce.number().default(3),
  XHS_PUBLISH_INTERVAL: z.coerce.number().default(1800),
  XHS_CHROME_USER_DATA: z.string().default('./data/chrome_profile'),

  SCHEDULE_CRON_CRAWL: z.string().default('0 */1 * * *'),
  SCHEDULE_CRON_PUBLISH: z.string().default('0 9,12,18 * * *'),
  SCHEDULE_CRON_GENERATE: z.string().default('30 */1 * * *'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_DIR: z.string().default('./logs'),

  MAX_RETRY: z.coerce.number().default(3),
  RETRY_DELAY: z.coerce.number().default(5000),

  HTTP_PROXY: z.string().optional(),
  HTTPS_PROXY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('环境变量校验失败:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
