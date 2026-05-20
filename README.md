# Demo科技 - AI 内容自动化生产平台

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Platform](https://img.shields.io/badge/platform-Claude%20Code-orange)

面向科技/互联网领域的公众号内容自动化工具，支持热点抓取、AI 深度文章生成、质量审查、自动发布全流程。

目标受众：25-40 岁互联网从业者、科技爱好者。

## 核心特性

### 全自动流水线
- **热点抓取**：微博热搜、百度热搜、今日头条、RSS 订阅，自动去重、分类、敏感词过滤
- **AI 创作**：支持 OpenAI / DeepSeek / Gemini，生成 1500-2500 字深度文章
- **质量审查**：5 维度自动打分（结构/内容/语气/开头/结尾），未通过标记 rejected
- **自动发布**：Playwright 驱动小红书发布，Cookie 持久化、反检测、随机延迟
- **定时调度**：Cron 定时任务，全流程无人值守

### 写作风格
- Demo科技 人设：第一人称，叙事式结构，像懂行的朋友在分享见解
- 禁止并列模板和 AI 腔——不使用"首先/其次/最后"
- 每篇文章至少 2-3 个认知转折，有具体案例和数字
- 输出包含标题、封面文案、正文、标签、评论引导语、AI 绘图提示词

### Claude Code Skill
项目内置 Claude Code Skill，可直接在对话中生成内容：

```
/write AI Agent 如何改变产品经理的工作方式   → 生成完整公众号文章
/comment 某某公司宣布裁员30%                → 生成热点短评（180-250字）
```

## 技术栈

Node.js / TypeScript / Playwright / SQLite / Pino / Axios / Zod / Cron

## 快速开始

```bash
# 1. 安装依赖
pnpm install
npx playwright install chromium

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 AI API Key 和模型名

# 3. 初始化数据库
pnpm run migrate

# 4. 抓取热点
pnpm run crawl

# 5. AI 生成内容（自动审查）
pnpm run generate
pnpm run generate 5          # 最多 5 条

# 6. 查看结果
pnpm run view contents       # 文章列表，带审查分数
pnpm run view detail <id>    # 查看全文 + 审查详情
pnpm run view export         # 导出为 Markdown

# 7. 发布到小红书（首次需手动扫码登录）
pnpm run post:xhs
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `pnpm run crawl` | 抓取全网热点 |
| `pnpm run generate` | AI 生成内容（默认 3 条，自动审查） |
| `pnpm run generate 5` | AI 生成内容（最多 5 条） |
| `pnpm run generate --type article` | 生成长文（默认） |
| `pnpm run generate --type comment` | 生成短评 |
| `pnpm run generate --type philosopher` | 生成哲学本质分析 |
| `pnpm run generate --type jargon` | 生成黑话翻译 |
| `pnpm run input` | 手动输入热点并 AI 生成 |
| `pnpm run post:xhs` | 发布到小红书 |
| `pnpm run review` | 给旧文章补质量审查 |
| `pnpm run view summary` | 数据概览 |
| `pnpm run view topics` | 热点列表 |
| `pnpm run view contents` | AI 内容列表（含审查分数） |
| `pnpm run view detail <id>` | 查看内容详情（含审查维度） |
| `pnpm run view export` | 导出为 Markdown |
| `pnpm run view export --type philosopher` | 仅导出哲学分析 |
| `pnpm run view export --type jargon` | 仅导出黑话翻译 |
| `pnpm run clear contents` | 删除所有 AI 内容和发布记录 |
| `pnpm run clear topics` | 删除所有热点及关联数据 |
| `pnpm run clear all` | 清空全部数据 |
| `pnpm run migrate` | 初始化数据库 |

## 质量审查机制

每篇文章生成后自动进入审查环节，5 个维度打分：

| 维度 | 权重 | 检测内容 |
|------|------|----------|
| 结构 | 30% | 是否存在并列编号、模板化过渡词 |
| 内容 | 30% | 是否有具体案例/数据，有无"正确的废话" |
| 语气 | 20% | 是否像真人聊天，有无口语化表达 |
| 开头 | 10% | 前 50 字吸引力 |
| 结尾 | 10% | 是否留钩子 |

- `reviewed` = 审查通过（总分 >= 0.65，且结构和内容单项 >= 0.5）
- `rejected` = 审查未通过，issues 列出具体问题

## Skill 文件说明

项目内置 Claude Code Skill 系统，位于 `.claude/skills/` 目录：

### write/ — 文章生成器
| 文件 | 说明 |
|------|------|
| `SKILL.md` | 核心指令：Demo科技写作风格、输出格式、认知转折技巧、禁止规则 |
| `skill.json` | Skill 元数据配置 |
| `质量自检.md` | 文章质量自检清单——标题/开头/内容/风格/格式逐项检查 |
| `作者配置模板.md` | 作者人设配置模板，可自定义写作风格 |

### comment/ — 热点短评生成器
| 文件 | 说明 |
|------|------|
| `SKILL.md` | 短评写作指令——理性温和、三段式、180-250字 |
| `skill.json` | Skill 元数据配置 |

### philosopher/ — 哲学本质分析器
通过 CLI 生成：`pnpm run generate --type philosopher`

对热点概念做"本质还原"式分析，不掉书袋，用日常场景展开哲学思考。输出包含标题、本质洞察、完整分析、收束语。

### jargon/ — 黑话翻译官
通过 CLI 生成：`pnpm run generate --type jargon`

将热点话题翻译成互联网黑话，反讽式输出。默认正向模式（大白话→黑话），附带毒舌点评。

### demo/ — 项目技术文档
| 文件 | 说明 |
|------|------|
| `SKILL.md` | 项目架构、代码约定、开发指南 |

## 写作风格

文章遵循「Demo科技」风格：

**核心原则：减少条目式输出，追求流畅自然**

```
❌ 避免：
1. 首先，你要做A
2. 然后，你要做B
3. 最后，你要做C

✅ 采用：
做这件事的时候，大多数人会直接从A开始。但我的建议是，先花点时间
想清楚B，然后再回头做A。为什么？因为[原因]。至于C，那是水到渠成的事。
```

- 叙事式结构，禁止"第一、第二、第三"并列模板
- 第一人称口语化表达，像懂行的朋友在分享见解
- 每篇文章只解决一个问题，把问题说透
- 至少 2-3 个认知转折，让读者停下来想一下
- 具体案例和数字，拒绝"正确的废话"
- 不使用 emoji、不使用 Markdown 格式符号、正文纯文字

## 项目结构

```
src/
├── config/          # 环境变量配置（Zod 校验）
├── crawler/         # 热点爬虫（微博/百度/头条/RSS）
├── ai/              # AI 创作 + 质量审查
├── prompts/         # 写作/短评/哲学/黑话 Prompt + 审查 Prompt
├── publish/         # 小红书发布（Playwright 自动化）
├── scheduler/       # Cron 定时任务
├── database/        # SQLite 数据层（WAL 模式）
├── utils/           # 工具库（日志/重试/HTTP）
├── cli/             # CLI 命令
└── index.ts         # 主入口（定时调度）

.claude/
└── skills/
    ├── write/       # /write 文章生成 Skill（6 个文件）
    ├── comment/     # /comment 短评生成 Skill
    └── demo/        # 项目技术文档 Skill

docker/
├── Dockerfile
└── docker-compose.yml
```

## Docker 部署

```bash
# 构建
cd docker
docker compose build

# 启动定时任务（后台常驻）
docker compose up -d

# 手动执行命令
docker compose run --rm cli pnpm run crawl
docker compose run --rm cli pnpm run generate 5
docker compose run --rm cli pnpm run view contents

# 查看日志
docker compose logs -f auto-platform

# 停止
docker compose down
```

## 环境变量

参见 `.env.example`，主要配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_PROVIDER` | AI 提供商 | `openai` |
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `OPENAI_MODEL` | 模型名 | `gpt-4o` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `GEMINI_API_KEY` | Gemini API Key | - |
| `XHS_MAX_PUBLISH_PER_DAY` | 每日发布上限 | `3` |
| `SCHEDULE_CRON_CRAWL` | 抓取定时 | `0 */1 * * *` |
| `SCHEDULE_CRON_GENERATE` | 生成定时 | `30 */1 * * *` |
| `SCHEDULE_CRON_PUBLISH` | 发布定时 | `0 9,12,18 * * *` |

## 内容方向

以 AI 科技为核心：

**第一梯队：** AI 大模型动态、AI Agent/工作流、AI 产品设计、AI 效率工具、AI 编程、AI 对职业冲击

**第二梯队：** 科技行业趋势、独立开发、产品设计、效率工具

## 风控说明

- 每日发布上限 3 条，发布间隔 30-120 秒随机
- 操作间 1-3 秒随机延迟，模拟阅读 5-15 秒
- 反 webdriver 检测，Cookie 持久化
- 支持代理 IP 配置
- 内容相似度检测，阈值 0.8

## License

MIT
