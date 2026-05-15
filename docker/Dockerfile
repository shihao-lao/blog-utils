FROM node:20-slim

# 系统依赖（Playwright + SQLite）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 安装 Playwright Chromium
RUN npx playwright install chromium

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/data/exports

# 默认启动定时任务
CMD ["npx", "tsx", "src/index.ts"]
