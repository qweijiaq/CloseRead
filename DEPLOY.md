# CloseRead 云服务器部署

CloseRead 有两种运行方式：

| 模式 | 触发条件 | 数据放哪 |
| --- | --- | --- |
| 本地单用户 | 不设置 `LEARN_PUBLIC_HOST` | `data/` 和 `packs/`，和原来完全一样 |
| 公开多访客 | 设置 `LEARN_PUBLIC_HOST` | 每个浏览器一个 `data/users/<id>/`，互不可见 |

公开模式不需要注册和登录：每个浏览器第一次访问拿到一个匿名 cookie，读演示内容；第一次写入时自动创建独立空间。页面左下角显示“多少人用过 / 多少人在线”。

## 1. 准备

服务器需要：

- Docker + Docker Compose
- 一个反向代理（下面以现有的 Caddy 容器为例）
- 一个解析到服务器的域名

## 2. 部署

```bash
git clone https://github.com/qweijiaq/CloseRead.git /opt/closeread
cd /opt/closeread
mkdir -p data packs
```

创建 `.env`：

```bash
cat > .env <<EOF
LEARN_PUBLIC_HOST=closeread.example.com
LEARN_SECRET=$(openssl rand -base64 36 | tr -d '=+/\n')
LEARN_OWNER_KEY=$(openssl rand -base64 18 | tr -d '=+/\n')
TZ=Asia/Shanghai
EOF
chmod 600 .env
```

- `LEARN_SECRET` 用来加密访客填写的模型 Key，**必须设置**；换掉它会让已保存的 Key 失效，请和备份一起保存。
- `LEARN_OWNER_KEY` 可选。用一个 `https://站点/?owner=<这个值>` 打开一次，你的浏览器就会被固定成一个稳定空间，而不是普通访客。

启动：

```bash
docker compose up -d --build
docker compose ps
```

应用只监听容器内 `0.0.0.0:4317`，不发布到宿主机端口。

生成演示内容（新访客会先看到它）：

```bash
docker compose run --rm app pnpm dev demo
```

## 3. 反向代理

把 `deploy/closeread.caddy.example` 的内容写入 Caddy 配置卷。**不要再加 basic_auth**，否则匿名访客进不来。

```bash
sudo tee /var/lib/docker/volumes/folio_caddy-config/_data/sites/closeread.caddy >/dev/null <<'EOF'
closeread.example.com {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	reverse_proxy closeread-app:4317 {
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
EOF

docker exec folio-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

验证：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://closeread.example.com/
curl -sS https://closeread.example.com/api/public/stats
```

## 4. 数据怎么放

```text
data/
  store.json            演示空间（所有人只读）
  packs/                演示文章
  community/visits.json 访问统计：首次、最近一次、是否已创建空间
  users/<id>/data/      某个访客的 store、导入材料、llm.json、tts.json、备份
  users/<id>/packs/     某个访客的学习包、阅读进度、音频
```

- 访客之间不共享任何存储路径，Key、文章、进度、回收站、备份彼此独立。
- 演示空间是只读的：访客第一次写操作（导入、保存 Key、改设置）时才复制一份演示内容到自己的目录。
- 单个空间上限 250 MB，超出后导入会返回 413。
- 同一 IP 每天最多创建 5 个空间，防止脚本刷目录。

## 5. 统计口径

`GET /api/public/stats`

```json
{ "totalUsers": 128, "online": 3, "mode": "public" }
```

- **用过**：曾经打开过页面的匿名身份数量。
- **在线**：最近 5 分钟内有请求的身份数量（页面每 60 秒轮询一次，所以打开着就算在线）。
- 爬虫和命令行工具（无 UA 或含 bot/curl 等）不计入统计。

## 6. 维护

```bash
# 看有哪些访客空间、占多大
docker compose exec app pnpm dev guests

# 预演清理 90 天没来过的空间
docker compose exec app pnpm dev guests --days 90

# 真正删除
docker compose exec app pnpm dev guests --days 90 --force

# 备份整个库
docker compose exec app pnpm dev backup
```

建议把 `data/` 和 `packs/` 一起纳入服务器备份（空间目录也在 `data/users/` 下）。

## 7. 安全说明

公开模式意味着任何人都能用这个站点，因此做了这些限制：

- 每个浏览器独立存储，物理上无法读到别人的文章和 Key。
- 保存的 Key 用 `LEARN_SECRET` 派生的 AES-256-GCM 加密落盘，接口不回显 Key。
- 导入网页链接时会校验每一跳解析出的 IP，拒绝内网、回环和云元数据地址（防 SSRF）。
- 导入和构建受空间大小限制；创建空间受 IP 频率限制。
- 手机访问（`/api/lan`）只在服务器本机回环地址下可用，公网访问会被拒绝。

仍然存在、需要你自己判断的风险：

- 没有登录，就没有“账号被盗”这回事，但也没有“数据可找回”：清 cookie 等于换新空间。
- 访客用自己填的 Key 调用模型，费用由他们自己承担；但导入、构建、朗读仍消耗你的 CPU 和磁盘。
- 恶意访客可以上传大 PDF 反复构建，靠 250 MB 上限和 IP 频率限制兜底，必要时再加反向代理层的限流。

## 8. 更新

```bash
cd /opt/closeread
git pull --ff-only
docker compose up -d --build
```
