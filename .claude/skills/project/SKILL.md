# Demo科技 - 项目专属 Skill

## 项目概述

这是一个面向科技/互联网领域的 **AI 内容自动化生产平台**（`auto-platform`），支持热点抓取 → AI 深度文章生成 → 质量审查 → 自动发布全流程。

目标受众：25-40 岁互联网从业者、科技爱好者。

## 技术栈

- **运行时**：Node.js >= 20，TypeScript 5.5+
- **包管理**：pnpm@9.0.0（`packageManager` 字段已锁定）
- **模块系统**：ESM（`"type": "module"`）
- **数据库**：SQLite（`better-sqlite3`），WAL 模式
- **浏览器自动化**：Playwright（Chromium）
- **HTTP 客户端**：Axios
- **日志**：Pino + pino-pretty
- **配置校验**：Zod + dotenv
- **定时任务**：Cron
- **AI SDK**：OpenAI 官方 SDK（兼容 DeepSeek、Gemini）
- **XML 解析**：xml2js
- **HTML 解析**：Cheerio

## 项目结构

```
blog-utils/
├── docker/                    # Docker 部署配置
│   ├── Dockerfile             # 基于 node:20-slim，安装 Playwright 依赖
│   └── docker-compose.yml     # 单服务容器，挂载 data/logs/.env
├── src/
│   ├── index.ts               # 入口：初始化数据库 + 启动调度器
│   ├── config/index.ts        # 环境变量校验（Zod schema）
│   ├── ai/                    # AI 生成模块
│   │   ├── types.ts           # AiProvider 接口、AiGenerationResult 类型
│   │   ├── factory.ts         # Provider 工厂（单例模式）
│   │   ├── generator.ts       # ContentGenerator：生成 + 审查 + 存库
│   │   └── providers/         # AI Provider 实现
│   │       ├── openai.ts      # OpenAI（兼容 DeepSeek 等）
│   │       ├── deepseek.ts    # DeepSeek
│   │       └── gemini.ts      # Gemini
│   ├── crawler/               # 热点爬虫模块
│   │   ├── types.ts           # CrawlerAdapter 接口、CrawlResult、分类/敏感词
│   │   ├── manager.ts         # CrawlerManager：注册适配器、并发抓取、去重排序
│   │   ├── utils.ts           # 分类、敏感词检测、关键词提取、去重、排序
│   │   └── adapters/          # 数据源适配器
│   │       ├── weibo.ts       # 微博热搜 API
│   │       ├── baidu.ts       # 百度热搜（HTML 注释中提取 JSON）
│   │       ├── toutiao.ts     # 今日头条热榜 API
│   │       └── rss.ts         # RSS/Atom 订阅源
│   ├── prompts/               # AI Prompt 模板
│   │   ├── content.ts         # 文章生成 Prompt（SYSTEM + USER）
│   │   └── review.ts          # 质量审查 Prompt + 解析
│   ├── publish/               # 发布模块
│   │   ├── types.ts           # PlatformPublisher 接口、PublishOptions/Result
│   │   ├── manager.ts         # PublishManager：登录检查 + 发布调度
│   │   ├── xhs-publisher.ts   # XhsPublisher：Playwright 驱动小红书发布
│   │   └── risk-control.ts    # RiskController：频率限制、去重、延迟
│   ├── scheduler/index.ts     # 定时调度：CronJob 驱动抓取/生成/发布
│   ├── database/              # 数据库模块
│   │   ├── index.ts           # getDb() 单例、closeDb()
│   │   ├── schema.ts          # 建表 SQL（hot_topics/ai_contents/publish_records/task_queue）
│   │   ├── repositories.ts    # CRUD 操作（topicRepo/contentRepo/publishRepo/taskRepo）
│   │   ├── types.ts           # 数据表 TypeScript 类型
│   │   └── migrate.ts         # 数据库迁移入口
│   ├── cli/                   # CLI 命令入口
│   │   ├── crawl.ts           # pnpm run crawl
│   │   ├── generate.ts        # pnpm run generate [N]
│   │   ├── publish.ts         # pnpm run post:xhs
│   │   ├── input.ts           # pnpm run input（手动输入热点）
│   │   ├── view.ts            # pnpm run view（查看/导出）
│   │   ├── review.ts          # pnpm run review（补审查）
│   │   └── clear.ts           # pnpm run clear（清空数据）
│   └── utils/                 # 工具模块
│       ├── http.ts            # Axios 实例（UA 伪装、拦截器、fetchWithRetry）
│       ├── retry.ts           # withRetry（指数退避）、sleep、randomDelay
│       ├── logger.ts          # Pino 日志工厂
│       └── index.ts           # 工具导出
├── .env.example               # 环境变量模板
├── package.json               # 依赖和脚本
└── tsconfig.json              # TS 配置（ES2022、ESM、bundler 解析）
```

## 代码约定

### 模块系统
- 所有文件使用 **ESM**（`import`/`export`）
- 导入时**必须带 `.js` 后缀**（如 `import { config } from '../config/index.js'`）
- 使用 `tsx` 运行时执行，无需预编译

### 命名规范
- **文件名**：kebab-case（`risk-control.ts`、`xhs-publisher.ts`）
- **类名**：PascalCase（`CrawlerManager`、`XhsPublisher`、`RiskController`）
- **函数/变量**：camelCase（`crawlAndSave`、`generateForTopic`）
- **常量**：UPPER_SNAKE_CASE（`SENSITIVE_KEYWORDS`、`CATEGORY_KEYWORDS`）
- **接口**：PascalCase，以 `Adapter`/`Provider`/`Publisher` 等后缀区分角色

### 日志规范
- 使用 `createModuleLogger('模块名')` 创建日志实例
- 模块名格式：`父模块:子模块`（如 `'crawler:weibo'`、`'publish:xhs'`）
- 日志方法：`log.info(obj, msg)` 或 `log.error({ error }, msg)`
- 第一个参数是结构化数据对象，第二个是消息字符串

### 错误处理
- 所有异步操作包裹 `try...catch`，失败时记录日志并返回安全默认值
- 爬虫适配器 `catch` 后返回 `[]`（不阻断其他源）
- AI 生成 `catch` 后返回 `null`（不阻断批量处理）
- 使用 `withRetry()` 包裹关键网络请求

### 数据库操作
- 使用 `getDb()` 获取单例数据库实例
- Repository 模式：`topicRepo`、`contentRepo`、`publishRepo`、`taskRepo`
- 每个 repo 方法内部调用 `getDb().prepare().run()/get()/all()`
- JSON 字段（keywords、tags、issues 等）存储前需 `JSON.stringify()`

### 环境变量
- 所有配置通过 `config` 对象访问（`import { config } from '../config/index.js'`）
- 新增配置需在 `config/index.ts` 的 Zod schema 中定义
- 同步更新 `.env.example`

## 核心设计模式

### 1. 适配器模式（Crawler）
所有数据源实现 `CrawlerAdapter` 接口：
```ts
interface CrawlerAdapter {
  name: string;
  crawl(): Promise<CrawlResult[]>;
}
```
新增数据源只需创建新适配器并在 `CrawlerManager` 构造函数中注册。

### 2. 工厂模式（AI Provider）
`getAiProvider()` 根据 `config.AI_PROVIDER` 返回对应实例，单例缓存。

### 3. Repository 模式（Database）
每个表对应一个 repo 对象，封装 CRUD 操作，不暴露 SQL。

### 4. 策略模式（风控）
`RiskController` 封装发布前的各种检查策略（频率、去重、延迟）。

## 数据流

```
CrawlerManager.crawlAndSave()
  → 各 Adapter.crawl()（并发）
  → deduplicateResults() + sortByHeat()
  → classifyCategory() + isSensitive() + extractKeywords()
  → topicRepo.create()
  → topicRepo.markProcessed()

ContentGenerator.generateForTopic()
  → topicRepo.findById()
  → buildContentPrompt()
  → provider.generate()
  → parseResult()（JSON 解析）
  → reviewArticle()（质量审查）
  → contentRepo.create() + contentRepo.saveReview()
  → topicRepo.markProcessed()

PublishManager.publishContent()
  → contentRepo.findById()
  → risk.canPublish()（频率检查）
  → publisher.publish()（Playwright 自动化）
  → publishRepo.create() + updateStatus()
```

## 常见开发任务

### 新增数据源
1. 在 `src/crawler/adapters/` 创建新文件
2. 实现 `CrawlerAdapter` 接口
3. 在 `src/crawler/index.ts` 导出
4. 在 `CrawlerManager` 构造函数中注册

### 新增 AI Provider
1. 在 `src/ai/providers/` 创建新文件
2. 实现 `AiProvider` 接口（`name` + `generate()`）
3. 在 `src/ai/factory.ts` 添加 case 分支
4. 在 `src/config/index.ts` 添加对应的环境变量

### 新增数据库表
1. 在 `src/database/schema.ts` 添加 `CREATE TABLE` 语句
2. 在 `src/database/types.ts` 添加 TypeScript 类型
3. 在 `src/database/repositories.ts` 添加 repo 对象

### 新增 CLI 命令
1. 在 `src/cli/` 创建新文件
2. 在 `package.json` 的 `scripts` 中添加命令

## 注意事项

### 不要做的事
- **不要修改写作风格 Prompt**（`src/prompts/content.ts`），这是核心差异化
- **不要移除质量审查环节**，审查是内容质量保障
- **不要在爬虫适配器中硬编码 Cookie**，应从环境变量读取
- **不要在生产环境关闭 `XHS_HEADLESS`**，会导致浏览器窗口弹出
- **不要直接修改 `config` 对象**，所有配置通过环境变量注入

### 已知限制
- SQLite 不支持并发写入，多实例部署需换 PostgreSQL
- Playwright 浏览器是单例，不支持多用户并行发布
- AI Provider 单例无重置机制，运行时无法切换
- 微博 Cookie 当前是示例值，需配置真实 Cookie
- HTTP 代理配置未实际生效（`http.ts` 中为空实现）

### 安全注意
- `.env` 文件包含 API Key，**绝对不能提交到 Git**
- Cookie 文件（`xhs_cookies.json`）包含登录态，需妥善保管
- 小红书发布频率需严格控制，避免封号