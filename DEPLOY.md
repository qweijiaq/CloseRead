# CloseRead 云服务器部署

CloseRead 是单用户、本地优先的应用，没有账号系统。**不要直接暴露到公网**；云部署必须放在反向代理的 HTTP Basic Auth 或 Zero Trust 之后。

下面以 Folio 正在使用的 Caddy 服务器为例。

## 1. 准备

服务器需要：

- Docker + Docker Compose
- 已有 Caddy 容器和外部网络 `folio_default`
- 一个指向服务器的域名；没有 DNS 时可用 `sslip.io`，例如 `closeread.114-215-193-207.sslip.io`

```bash
git clone https://github.com/qweijiaq/CloseRead.git /opt/closeread
cd /opt/closeread
mkdir -p data packs
```

## 2. 配置

创建 `.env`：

```bash
cat > .env <<'EOF'
LEARN_PUBLIC_HOST=closeread.example.com
TZ=Asia/Shanghai
EOF
chmod 600 .env
```

启动：

```bash
docker compose up -d --build
docker compose ps
```

应用只监听容器内 `0.0.0.0:4317`，不会发布到宿主机端口。

首次可选：生成演示数据。

```bash
docker compose run --rm app pnpm dev demo
```

## 3. Caddy

把 `deploy/closeread.caddy.example` 复制到 Caddy 配置卷：

```bash
# 生成密码哈希
HASH=$(docker exec folio-caddy-1 caddy hash-password --plaintext 'your-password')
sudo tee /var/lib/docker/volumes/folio_caddy-config/_data/sites/closeread.caddy >/dev/null <<EOF
closeread.example.com {
	encode zstd gzip
	basic_auth {
		weijia $HASH
	}
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
curl -u weijia:your-password -I https://closeread.example.com
```

## 4. 数据

- `data/`：store、导入材料、模型/语音设置、备份、回收站
- `packs/`：学习包、阅读进度和缓存音频

备份：

```bash
docker compose exec app pnpm dev backup
```

或者直接在设置中心下载完整备份。

## 5. 更新

```bash
cd /opt/closeread
git pull --ff-only
docker compose up -d --build
```
