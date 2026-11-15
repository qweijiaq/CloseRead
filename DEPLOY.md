# CloseRead 云服务器部署

CloseRead 有两种运行方式：

| 模式 | 触发条件 | 数据放哪 |
| --- | --- | --- |
| 本地单用户 | 不设置 `LEARN_PUBLIC_HOST` | `data/` 和 `packs/`，和原来完全一样 |
| 公开多访客 | 设置 `LEARN_PUBLIC_HOST` | **浏览器本地**，服务器只保留临时运行目录 |

公开模式不需要注册和登录：每个浏览器第一次访问拿到一个匿名 cookie，读演示内容；第一次写入时得到一个独立空间。页面左下角显示“多少人用过 / 多少人在线”。

公开模式下服务器**不是数据存放地**：它只负责发页面、编译导入的内容、统计人数。真正的文章、学习项、阅读进度和批注都存在访客自己的浏览器里（IndexedDB），服务器重启后什么都不会留下，浏览器下次打开会自己把内容推回去。

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
- 一个部署可以服务多个域名，用逗号分隔：`LEARN_PUBLIC_HOST=a.example.com,b.example.com`。

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
数据在访客的浏览器里（IndexedDB）
  store.json、packs/<id>/*、阅读进度、批注、设置

服务器上只有两样东西
  data/                演示内容（只读样例）+ 访问统计 community/visits.json
  /tmp/closeread-run/  临时运行目录，进程每次启动都会清空
```

- 访客第一次写操作（导入、保存 Key、改设置）时，服务器在临时目录里建一个工作区，并通知浏览器把内容存在本地。
- 每次写入后，浏览器会拉取变更的文件存进 IndexedDB；服务器重启、临时目录被清空后，浏览器下次打开会自动把内容推回去。
- 因此服务器上没有任何需要备份、清理或迁移的用户数据。备份、容量、隐私都由访客自己的浏览器承担。
- 导出/导入在「设置 → 设备迁移」里：导出一个 JSON 文件，在新设备上导入即可。

## 4.1 公共库（作者发布，所有人可读）

没有模型 Key 的访客什么也生成不了，但他们可以读你发布的内容。做法是在服务器上导入并生成，放进公共库：

```bash
cd /opt/closeread

# 1. 作者在容器里导入并生成（需要 .env 里有 LEARN_API_KEY）
docker compose exec app pnpm dev add /tmp/article.pdf --build --title "文章标题"

# 2. 预生成「看答案」用的内容，这样没 Key 的访客也能看到答案
docker compose exec app pnpm dev prefetch latest

# 3. 确认公共库里有什么
docker compose exec app pnpm dev list
```

- 公共库就是服务器的 `data/` 和 `packs/`（和演示内容同一个位置）。
- 访客的「文章」页会多出一个「公共库」分组，只显示他还没读过的包。
- 访客第一次打开某个公共包时，服务器会把这份包复制到他的临时空间，之后进度、批注、词卡都按他自己的记录走。
- 访客仍然可以用自己的 Key 导入私有文章；公共库只是额外内容。

不做第 2 步的话，没 Key 的访客点「看答案」会失败——那一步是模型调用。

`prefetch` 默认只生成段落「想一想」的答案，可以再开两项（按量消耗模型调用）：

```bash
# 单词展开 / 词源派生（每篇文章 20-40 次调用）
docker compose exec app pnpm dev prefetch latest --expand

# 逐句翻译（每篇文章约 40-80 次调用）
docker compose exec app pnpm dev prefetch latest --sentences

# 三项一起
docker compose exec app pnpm dev prefetch latest --expand --sentences
```

已生成过的会跳过，中途失败也会继续。生成结果写进 `pack.json`，所以会跟着公共库分发给所有人。

### 访客自己公开

访客不需要命令行：在「文章」页每个学习包旁边有「公开」按钮。点了之后这个包会复制进服务器的公共库，其他访客在「公共库」里就能读到。已经公开的会显示「已公开」标签；同一个包重复公开会被拒绝。

公开的是只读副本，不影响原作者自己的阅读进度。作者本人在「文章」页能看到「取消公开」，取消后其他访客就看不到了；别人公开的内容只有对方能取消，内置示例不能取消。公共库上限 500 个包。

服务器上也可以强制移除：

```bash
docker compose exec app pnpm dev unpublish <id|标题关键词>
```

## 5. 统计口径

`GET /api/public/stats`

```json
{ "totalUsers": 128, "online": 3, "mode": "public" }
```

- **用过**：曾经打开过页面的匿名身份数量。
- **在线**：最近 5 分钟内有请求的身份数量（页面每 60 秒轮询一次，所以打开着就算在线）。
- 爬虫和命令行工具（无 UA 或含 bot/curl 等）不计入统计。

## 6. 维护

公开模式下不需要维护用户数据，只剩三件事：

```bash
# 看当前进程里有多少个临时工作区（诊断用）
docker compose exec app pnpm dev guests

# 备份演示内容和你自己的本地库（公开模式下很小）
docker compose exec app pnpm dev backup
```

- 临时目录 `/tmp/closeread-run` 在每次启动时自动清空，无需手工清理。
- `data/` 里只有演示内容和访问统计，几十 KB 级别。
- 想重置统计：删掉 `data/community/visits.json` 后重启。

## 7. 安全说明

公开模式意味着任何人都能用这个站点，因此做了这些限制：

- 访客内容存在各自浏览器里，服务器上没有可被互相读取的用户数据。
- 浏览器上传/回灌的文件路径经过校验，无法逃出临时工作区。
- 保存的 Key 用 `LEARN_SECRET` 派生的 AES-256-GCM 加密落盘，接口不回显 Key。
- 导入网页链接时会校验每一跳解析出的 IP，拒绝内网、回环和云元数据地址（防 SSRF）。
- 编译接口按 IP 限流，并限制同时处理的数量。
- 手机访问（`/api/lan`）只在服务器本机回环地址下可用，公网访问会被拒绝。

仍然存在、需要你自己判断的风险：

- 没有登录，就没有“账号被盗”这回事；但也没有“数据可找回”：清空浏览器数据等于换新空间，请提醒用户定期导出。
- 访客用自己填的 Key 调用模型，费用由他们自己承担；但导入、构建、朗读仍消耗服务器的 CPU。
- 手机浏览器（尤其 iOS Safari）长期不访问可能清理站点数据，页面上已提示「添加到主屏幕」。

## 8. 更新

```bash
cd /opt/closeread
git pull --ff-only
docker compose up -d --build
```
