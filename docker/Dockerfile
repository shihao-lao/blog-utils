FROM node:20-slim

# 安装 Playwright 依赖
RUN npx playwright install-deps

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 复制源代码
COPY . .

# 构建
RUN pnpm build

# 创建数据目录
RUN mkdir -p /app/data /app/logs

# 暴露端口（如果需要 API）
EXPOSE 3000

# 启动
CMD ["node", "--loader", "tsx", "src/index.ts"]
