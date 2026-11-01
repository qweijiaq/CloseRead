# CloseRead · 细读

[![CI](https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml/badge.svg)](https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml)

[English](README.md) | 简体中文

**CloseRead 把一个 PDF、EPUB、MOBI、网页链接、文本文件或演讲转录，做成一份可以逐段精读的学习包：译文、笔记、词卡、句子卡，以及留在本地的复习库。**

它不是聊天外教，也不是一个“碰巧放了几篇文章”的背单词 App。主循环是 **读 → 懂 → 收 → 少量复习**。界面目前为中文。

![CloseRead 精读界面](assets/reader.png)

*实际界面：文章头、逐段译文、精读笔记和折叠的词卡。*

## 为什么不是 ChatGPT / 背单词 App？

| | ChatGPT | 背单词 App | CloseRead |
| --- | --- | --- | --- |
| 真实文章 | 能读，但每次都要重新提问 | 通常没有完整文章 | PDF / EPUB / MOBI / 网页 / 文本 / 转录 |
| 结构化产出 | 需要自己整理 | 只有词表 | 逐段译文、笔记、语法、词卡、句子卡 |
| 保留语境 | 留在对话里 | 卡片离开原文 | 卡片跟着来源段落走 |
| 复习 | 没有内置队列 | 有 | 单词和句子卡的 FSRS 队列，可导出 Anki CSV |
| 数据在哪 | 云端账号 | 通常也在云端 | 原文、学习包、进度和词库都在本机 |

## 快速开始

需要 **Node.js 22+** 和 **pnpm 10+**（仓库通过 `packageManager` 固定 pnpm 11.9）。

```bash
pnpm install
pnpm dev demo          # 用示例文章生成一个学习包
pnpm dev review        # 打开本地阅读界面：http://127.0.0.1:4317
```

`demo` 会对 `samples/sample-article.md` 跑完整流程：生成学习包、把卡片加入复习库；macOS 有 `say` 时会顺带生成音频。`review` 打开「今日」阅读首页，「复习」是单独的卡片标签页。

导入自己的材料：

```bash
pnpm dev add ./article.pdf
pnpm dev add ./book.epub
pnpm dev add https://example.com/article --build --open
pnpm dev add --clipboard --build
```

目前只能从源码运行：还没有 npm 包，也没有一行安装命令。本地界面和 CLI 共用同一套代码。

## 它能做什么

1. **导入**真实材料。带书签的 PDF 或 EPUB 会先拆成文章，目录、广告、漫画和新闻摘要可以过滤掉。
2. **生成**其中一篇。得到双语阅读页、逐段译文、文章结构图和精读笔记。
3. **阅读**时按段落推进。选中一个词或一整句，先看语境译文和注释，再决定要不要加卡。
4. **深入**：词源、词族发散、单句精读、AI 小剧场、微故事和 60 秒小游戏。
5. **复习**你真正想留下的内容。核心卡进入 FSRS，Bonus 卡留在学习包里；需要时导出 Anki 或 Markdown。

## 主要功能

### 阅读

- 支持 PDF（需要文字层）、EPUB、MOBI/AZW/AZW3、网页链接、粘贴文本和时间戳转录。
- 英文标题、中文标题、导语/摘要和逐段译文。
- 文章结构图、每段精读笔记（作用、关键句、语法、背景、想一想）和阅读进度条。
- 可以编辑或删除段落；保存后会重新翻译该段，并同步单词卡和句子卡。

### 理解

- 单句精读：放大原文、按需翻译、发音、前后切换、合并/拆分句子边界、标记本段已读。
- 句子卡保留完整原句、译文、意群、句型和替换表达，适合回译。
- AI 小剧场：三句话采访作者，或反驳 AI；结束后回看用过和漏掉的表达。
- 微故事和 60 秒金句拼图/词根拼装，直接用包里已有的卡片生成。

### 收集

- 选中 1–8 个词或一整句，卡片会留在来源段落，不会全堆到页面底部。
- 添加前就能看到语境译文和简短注释。
- 词卡包含词源、词根词缀、派生图、词族、同反义、易混词、搭配和例句。
- 句子卡保留原句、译文、意群和句型。

### 复习

- 单词卡和句子卡都使用 FSRS 排期。
- 核心卡进入每日队列；Bonus 卡只在学习包中展示。
- 支持 Anki CSV、Obsidian/打印用 Markdown，以及 HTML/EPUB/PDF/PNG 导出；MOBI 导出需要 Calibre。

### 额外

- 阅读护照和 3:4 分享卡。
- 整篇音频和逐句跟读，支持本地录音回放。
- 音频可以使用 macOS `say`、浏览器朗读，或配置神经语音（Edge 在线语音、智谱 GLM-TTS、Gemini TTS、MiniMax、ElevenLabs、OpenAI 兼容接口）。

## 输入与输出

`PDF` `EPUB` `MOBI` `AZW/AZW3` `网页` `文本` `SRT/VTT` · `HTML 阅读页` `Markdown` `Anki CSV` `EPUB` `PDF` `PNG` `MOBI`

| | |
| --- | --- |
| **输入** | 带文字层的 PDF、EPUB/MOBI/AZW/AZW3、文章 URL、粘贴文本/Markdown、演讲转录。音视频需要同时提供转录文本。 |
| **输出** | 交互式 HTML 阅读页、Obsidian/打印用 Markdown、Anki CSV；界面还可以导出 EPUB、PDF、PNG，以及通过 Calibre 导出 MOBI。 |
| **平台** | Node 22+，支持 macOS、Linux、Windows。PDF/PNG 导出使用本机 Chrome；MOBI 导出需要安装 Calibre。 |
| **模型** | 不填模型 Key 也可以使用规则模式；填入 DeepSeek/OpenAI/GLM 等兼容 Key 后，可以使用 AI 笔记、翻译、词卡发散和选词。 |
| **音频** | 可选。macOS `say` 可离线使用；其他系统可以用浏览器朗读或配置神经语音接口。 |

## 适合谁

适合想慢慢读真实英文、并留下有用表达的人：考研、雅思托福、外刊精读、长期积累词汇。只想一键总结、不想配置模型 Key，或者需要扫描版 PDF OCR 的人，可能不适合。

## 限制

- 暂不支持扫描版 PDF 的 OCR。
- DRM 加密的 EPUB、MOBI、AZW 无法解密，请使用无 DRM 的文件。
- 不绕过付费墙、登录墙或机器人验证。
- 不内置音视频转录，需要自带转录文本。
- 规则模式下的中文释义来自词典/翻译接口，不是结合语境的改写；LLM 模式的释义更贴近上下文。
- 复习服务只监听 `127.0.0.1`，没有登录鉴权，不要暴露到公网。
- 版权：仅供个人学习，不要重新分发包含完整原文的学习包。

## 开发

```bash
pnpm typecheck
pnpm test
```

测试使用 Node 内置测试运行器和 `tsx`。CLI 直接从源码运行，没有单独的构建步骤。

## 许可

MIT
