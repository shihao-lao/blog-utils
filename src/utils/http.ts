import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '../config/index.js';
import { createModuleLogger } from './logger.js';
import { withRetry } from './retry.js';

const log = createModuleLogger('http');

const defaultConfig: AxiosRequestConfig = {
  timeout: 30_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json, text/html, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
};

if (config.HTTP_PROXY || config.HTTPS_PROXY) {
  // proxy support via env
}

export function createHttpClient(extraConfig?: AxiosRequestConfig): AxiosInstance {
  const instance = axios.create({ ...defaultConfig, ...extraConfig });

  instance.interceptors.request.use((req) => {
    log.debug({ url: req.url, method: req.method }, 'HTTP 请求');
    return req;
  });

  instance.interceptors.response.use(
    (res) => {
      log.debug({ url: res.config.url, status: res.status }, 'HTTP 响应');
      return res;
    },
    (err) => {
      log.error(
        { url: err.config?.url, status: err.response?.status, message: err.message },
        'HTTP 错误',
      );
      return Promise.reject(err);
    },
  );

  return instance;
}

export const httpClient = createHttpClient();

export async function fetchWithRetry<T>(
  url: string,
  options?: AxiosRequestConfig,
): Promise<T> {
  return withRetry(async () => {
    const res = await httpClient.get<T>(url, options);
    return res.data;
  });
}
