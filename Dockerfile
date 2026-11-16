FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# PDF / PNG export shells out to headless Chromium. It is a ~600 MB download from
# the Debian mirror, so it is opt-in: build with --build-arg WITH_CHROMIUM=1 when
# export has to work in production.
ARG WITH_CHROMIUM=0
RUN if [ "$WITH_CHROMIUM" = "1" ]; then \
      apt-get update && \
      apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates && \
      rm -rf /var/lib/apt/lists/*; \
    fi
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN pnpm config set registry "$NPM_REGISTRY" && pnpm install --prod --frozen-lockfile

COPY . .
ENV NODE_ENV=production
EXPOSE 4317
CMD ["pnpm", "dev", "review", "--port", "4317"]
