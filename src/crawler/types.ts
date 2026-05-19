export interface CrawlResult {
  title: string;
  url?: string;
  description?: string;
  heat: number;
  source: string;
  keywords?: string[];
  images?: string[];
}

export interface CrawlerAdapter {
  name: string;
  crawl(): Promise<CrawlResult[]>;
}

export const SENSITIVE_KEYWORDS = [
  '色情', '赌博', '毒品', '暴力', '恐怖', '政治敏感',
  '裸体', '博彩', '枪支',
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '科技': ['AI', '人工智能', '芯片', '半导体', '机器人', '自动驾驶', '量子计算', '5G', '6G', '大模型', 'GPT', 'ChatGPT', 'Claude', 'Gemini'],
  'AI': ['AI', '人工智能', '机器学习', '深度学习', '大模型', 'LLM', 'AIGC', '生成式AI', 'Sora', 'Midjourney', 'Stable Diffusion'],
  '娱乐': ['明星', '电影', '综艺', '电视剧', '演唱会', '偶像', '演员', '导演', '票房'],
  '财经': ['股市', '基金', '房价', 'GDP', '央行', '降息', '加息', '通胀', '比特币', '加密货币'],
  '体育': ['足球', '篮球', 'NBA', '世界杯', '奥运会', '冠军', '比赛'],
  '社会': ['热搜', '争议', '事件', '事故', '救援', '政策', '法规'],
  '生活': ['美食', '旅游', '穿搭', '护肤', '健身', '减肥', '养生'],
  '职场': ['裁员', '招聘', '薪资', '跳槽', '面试', '副业', '创业'],
};
