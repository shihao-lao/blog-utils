import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { httpClient } from './http.js';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('utils:image-downloader');

/**
 * 下载图片到本地目录
 * @param urls 图片 URL 列表
 * @param outputDir 输出目录
 * @param maxCount 最大下载数量（默认 5）
 * @returns 本地文件路径列表
 */
export async function downloadImages(
  urls: string[],
  outputDir: string,
  maxCount = 5,
): Promise<string[]> {
  if (!urls || urls.length === 0) return [];

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const localPaths: string[] = [];
  const limited = urls.slice(0, maxCount);

  for (let i = 0; i < limited.length; i++) {
    const url = limited[i];
    try {
      const res = await httpClient.get(url, {
        responseType: 'arraybuffer',
        timeout: 15_000,
      });

      // 根据 Content-Type 确定扩展名
      const contentType = String(res.headers['content-type'] || '');
      let ext = '.jpg';
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('gif')) ext = '.gif';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
      else {
        // 从 URL 尝试提取扩展名
        const urlExt = extname(new URL(url).pathname);
        if (urlExt && ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(urlExt.toLowerCase())) {
          ext = urlExt.toLowerCase();
        }
      }

      const filename = `img_${i}${ext}`;
      const filepath = join(outputDir, filename);
      writeFileSync(filepath, Buffer.from(res.data));
      localPaths.push(filepath);

      log.debug({ url, filepath }, '图片下载成功');
    } catch (err) {
      log.warn({ url, error: (err as Error).message }, '图片下载失败，跳过');
    }
  }

  log.info({ total: urls.length, downloaded: localPaths.length }, '图片下载完成');
  return localPaths;
}
