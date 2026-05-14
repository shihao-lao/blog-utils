import { SENSITIVE_KEYWORDS, CATEGORY_KEYWORDS } from './types.js';
import type { CrawlResult } from './types.js';

export function classifyCategory(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) return category;
    }
  }
  return '其他';
}

export function isSensitive(title: string, description?: string): boolean {
  const text = `${title} ${description ?? ''}`;
  return SENSITIVE_KEYWORDS.some((kw) => text.includes(kw));
}

export function extractKeywords(title: string, description?: string): string[] {
  const text = `${title} ${description ?? ''}`;
  const allKeywords: string[] = [];
  for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        allKeywords.push(kw);
      }
    }
  }
  return [...new Set(allKeywords)];
}

export function deduplicateResults(results: CrawlResult[]): CrawlResult[] {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = normalizeTitle(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/[\s　]+/g, '')
    .replace(/[^一-龥a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 50);
}

export function sortByHeat(results: CrawlResult[]): CrawlResult[] {
  return [...results].sort((a, b) => b.heat - a.heat);
}
