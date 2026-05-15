# Demo科技 - AI 内容自动化生产平台

面向科技/互联网领域的公众号内容自动化工具，支持热点抓取、AI 深度文章生成、自动发布全流程。

目标受众：25-40 岁互联网从业者、科技爱好者。

## 功能特性

- **热点抓取**：微博热搜、百度热搜、今日头条、RSS 订阅，自动去重、分类、敏感词过滤
- **AI 创作**：支持 OpenAI / DeepSeek / Gemini，生成 1500-2500 字深度文章，附带标题、摘要、标签、AI 绘图提示词
- **质量审查**：生成后自动二次审查，5 维度打分（结构/内容/语气/开头/结尾），未通过标记为 rejected
- **写作风格**：midnight-friend 人格，第一人称，叙事式结构，禁止并列模板和 AI 腔
- **自动发布**：Playwright 驱动小红书自动化发布，Cookie 持久化、反检测、随机延迟
- **风控系统**：发布频率限制、内容去重、模拟真人操作
- **定时调度**：Cron 定时任务，支持抓取、创作、发布全流程自动化
- **数据管理**：SQLite 存储，支持 CLI 查看、导出 Markdown、清空数据

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
| `pnpm run input` | 手动输入热点并 AI 生成 |
| `pnpm run post:xhs` | 发布到小红书 |
| `pnpm run review` | 给旧文章补质量审查 |
| `pnpm run view summary` | 数据概览 |
| `pnpm run view topics` | 热点列表 |
| `pnpm run view contents` | AI 内容列表（含审查分数） |
| `pnpm run view detail <id>` | 查看内容详情（含审查维度） |
| `pnpm run view export` | 导出为 Markdown |
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

## 写作风格

文章遵循「Demo科技」风格：

- 叙事式结构，禁止"第一、第二、第三"并列模板
- 第一人称口语化表达，像懂行的朋友在分享见解
- 每篇文章只解决一个问题，把问题说透
- 至少 2-3 个认知转折，让读者停下来想一下
- 具体案例和数字，拒绝"正确的废话"

## Claude Code Skill

项目内置 `/write` 命令，可在 Claude Code 中直接生成公众号文章：

```
/write AI Agent 如何改变产品经理的工作方式
```

输入主题即可按 Demo科技 的风格配置输出完整文章（标题、摘要、正文、互动问题）。

## 项目结构

```
src/
├── config/          # 环境变量配置
├── crawler/         # 热点爬虫（微博/百度/头条/RSS）
├── ai/              # AI 创作 + 质量审查
├── prompts/         # 写作 Prompt + 审查 Prompt
├── publish/         # 小红书发布（Playwright 自动化）
├── scheduler/       # Cron 定时任务
├── database/        # SQLite 数据层
├── utils/           # 工具库（日志/重试/HTTP）
├── cli/             # CLI 命令
└── index.ts         # 主入口（定时调度）

.claude/
└── skills/
    └── write/       # /write skill

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

- `AI_PROVIDER`：AI 提供商（openai / deepseek / gemini）
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `GEMINI_API_KEY`：API Key
- `OPENAI_MODEL` / `DEEPSEEK_MODEL` / `GEMINI_MODEL`：模型名
- `OPENAI_BASE_URL` / `DEEPSEEK_BASE_URL`：API 地址（支持第三方兼容 API）
- `XHS_MAX_PUBLISH_PER_DAY`：每日发布上限
- `SCHEDULE_CRON_CRAWL`：抓取定时规则（默认每小时）
- `SCHEDULE_CRON_GENERATE`：生成定时规则（默认每小时）
- `SCHEDULE_CRON_PUBLISH`：发布定时规则（默认 9/12/18 点）

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
