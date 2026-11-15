FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN pnpm config set registry "$NPM_REGISTRY" && pnpm install --prod --frozen-lockfile

COPY . .
ENV NODE_ENV=production
EXPOSE 4317
CMD ["pnpm", "dev", "review", "--port", "4317"]
