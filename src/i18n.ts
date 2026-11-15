/**
 * Lightweight UI translation for the Chinese-first interface. This is a beta
 * layer: it translates interface labels, not article text or AI-generated notes.
 */
const REVIEW_EN: Record<string, string> = {
  '天': 'days',
  '篇': 'articles',
  '段': 'paragraphs',
  '张': '',
  '词': 'words',
  '今天读：': 'Today: ',
  '当前使用': 'Using',
  '分析，生成通常需要 1–3 分钟。': 'analysis; generation usually takes 1–3 minutes.',
  '未配置 LLM，将使用': 'No LLM configured; using ',
  '启发式模式': 'heuristic mode',
  '，还没有生成学习包。': ', no pack yet.',
  '今天已复习': 'Reviewed today',
  '词库共': 'Library',
  '其中句子卡': 'including sentence cards',
  '开始复习': 'Start review',
  '只复习句子卡': 'Sentence cards only',
  '今日': 'Today',
  '精读': 'Reading',
  '背单词': 'Vocabulary',
  '更多': 'More',
  '复习': 'Review',
  '词库': 'Library',
  '学习包': 'Packs',
  '护照': 'Passport',
  '复盘': 'Insights',
  '词网': 'Word web',
  '导入': 'Import',
  '导入文章': 'Import article',
  '添加生词': 'Add words',
  '相关词': 'Related words',
  '+ 导入材料': '+ Import',
  '连续': 'Streak',
  '已精读': 'Finished',
  '已读': 'Read',
  '句子卡': 'Sentence cards',
  '待复习': 'Due',
  '今日三件事': 'Today’s three steps',
  '今天读什么': 'What to read today',
  '今天读这篇': 'Read this today',
  '继续精读': 'Continue reading',
  '开始精读': 'Start reading',
  '单句精读': 'Sentence focus',
  '打开学习包': 'Open pack',
  '重读': 'Read again',
  '去复习': 'Go to review',
  '去背这篇的词': 'Review this article’s words',
  '看学习包': 'View packs',
  '导入新材料': 'Import material',
  '导入材料': 'Import material',
  '返回文章列表': 'Back to articles',
  '复习这篇': 'Review this pack',
  '隐藏译文': 'Hide translation',
  '显示译文': 'Show translation',
  '大字': 'Larger text',
  '音频跟读': 'Audio shadowing',
  '词太多': 'Too many words',
  '词太少': 'Too few words',
  '编辑标题': 'Edit title',
  '编辑导语': 'Edit standfirst',
  '精读完成': 'Finish reading',
  '重新开始': 'Start over',
  '粘贴文本': 'Paste text',
  '网页链接': 'Article URL',
  'PDF 文件': 'PDF file',
  'EPUB / MOBI': 'EPUB / MOBI',
  '标题（可选）': 'Title (optional)',
  '导入文本': 'Import text',
  '抓取并导入': 'Fetch and import',
  '上传并导入': 'Upload and import',
  '最近导入': 'Recent imports',
  '模型设置': 'Model settings',
  '服务商': 'Provider',
  '模型': 'Model',
  '保存模型设置': 'Save model settings',
  '选词量': 'Word count',
  '自动（按精读节奏）': 'Auto (reading pace)',
  '生成音频（macOS）': 'Generate audio (macOS)',
  '只选生词（已在词库的词不进入本包）': 'Only new words',
  '从浏览器书签导入当前网页：': 'Import the current page from a bookmark:',
  '安装书签': 'Install bookmark',
  '目标记忆率': 'Target retention',
  '保存': 'Save',
  '首次正确率': 'First-attempt accuracy',
  '还没有首次作答记录': 'No first attempts yet',
  '已保存': 'Saved',
  '保存中…': 'Saving…',
  '显示答案': 'Show answer',
  '隐藏答案': 'Hide answer',
  '标记已掌握': 'Mark known',
  '暂停': 'Suspend',
  '收藏': 'Star',
  '阅读护照': 'Reading passport',
  '连续天数': 'Streak',
  '读完文章': 'Articles finished',
  '在读文章': 'In progress',
  '精读段落': 'Paragraphs read',
  '读完词数': 'Words finished',
  '精读分钟': 'Minutes',
  '分享卡': 'Share card',
  '下载 PNG': 'Download PNG',
  '关闭': 'Close',
  '加载中…': 'Loading…',
  '最近精读': 'Recent reading',
  '最近输出': 'Recent output',
  '自动': 'Auto',
  '日间': 'Light',
  '夜间': 'Dark',
  '语境侦探': 'Usage Detective',
  '下一题': 'Next',
  '连对': 'Combo',
  '撤销上一次': 'Undo last review',
  '易忘': 'Leech',
  '未来 7 天': 'Next 7 days',
  '词汇诊断': 'Vocabulary check',
  '最近 7 天': 'Last 7 days',
  '保存诊断': 'Save check',
  '设置': 'Settings',
  '数据与词库': 'Data & library',
  '数据目录': 'Data folder',
  '学习包目录': 'Pack folder',
  '词条 / 学习包': 'Items / packs',
  '提醒': 'Warnings',
  '状态': 'Status',
  '未配置': 'Not configured',
  'Key 来源': 'Key source',
  '本机设置': 'Local settings',
  '环境变量': 'Environment',
  '测试连接': 'Test connection',
  '连接成功': 'Connected',
  '返回异常': 'Unexpected reply',
  '语音': 'Voice',
  '音色': 'Voice',
  '说明': 'Details',
  '备份与恢复': 'Backup & restore',
  '下载完整备份': 'Download full backup',
  '从备份恢复': 'Restore from backup',
  '恢复': 'Restore',
  '彻底删除': 'Delete permanently',
  '回收站': 'Trash',
  '本次运行用量': 'Session usage',
  '模型调用': 'Model calls',
  'Token（输入 / 输出）': 'Tokens (in / out)',
  '去词库': 'Open library',
  '跳到主要内容': 'Skip to content',
  'CloseRead 首页': 'CloseRead home',
  '切换主题': 'Switch theme',
  '学习': 'Study',
  '导入来源': 'Import source',
  '移动导航': 'Mobile navigation',
  '词汇关联图': 'Word graph',
  '阅读分享卡': 'Reading share card',
  '＋ 导入': '+ Import',
  '＋ 导入文章': '+ Import article',
  '← 精读': '← Reading',
  '全部文章': 'All articles',
  '搜索词…': 'Search words…',
  '模型 ID': 'Model ID',
  '文章': 'Articles',
  '全部标签': 'All tags',
  '隐藏标签': 'Hide tags',
  '标签：自动': 'Tag: auto',
  '网络': 'Network',
  '聚类': 'Clusters',
  '词族树': 'Word families',
  '词根': 'Root',
  '词根边': 'Root edges',
  '上下文': 'Context',
  '正关联': 'Positive link',
  '负关联': 'Negative link',
  '阈值': 'Threshold',
  '隐藏孤立词': 'Hide isolated words',
  '隐藏已掌握': 'Hide known',
  '重新布局': 'Re-layout',
  '重生成': 'Regenerate',
  '刷新可用模型': 'Refresh models',
  '上一代旗舰': 'Previous flagship',
  '快速档': 'Fast',
  '深度推理': 'Deep reasoning',
  '通用对话与写作': 'General chat & writing',
  '通义千问 Qwen': 'Qwen (Alibaba)',
  '阿里云百炼 Qwen-TTS': 'Alibaba Bailian Qwen-TTS',
  '智谱 GLM': 'Zhipu GLM',
  '智谱 GLM-TTS': 'Zhipu GLM-TTS',
  'Microsoft Edge 在线语音': 'Microsoft Edge online voice',
  '本地系统语音': 'Local system voice',
  '自定义 OpenAI 兼容': 'Custom OpenAI-compatible',
  '自定义兼容': 'Custom compatible',
  '设置语音模型': 'Voice model settings',
  '保存语音设置': 'Save voice settings',
  '改回本地语音': 'Use local voice',
  '清理正文': 'Clean text',
  '去导航、订阅、相关推荐；需要模型': 'Removes nav, subscribe prompts and related links; needs a model',
  'Key 只保存在本机 data/llm.json，不会上传。': 'The key is stored only on this machine and never uploaded.',
  '已配置，留空保持不变': 'Configured; leave blank to keep',
  '从网页、Word 或笔记里复制英文正文，粘贴到这里。标题留空时会从首行或 Markdown 标题推断。':
    'Paste English text copied from the web, Word or notes. Leave the title blank to infer it from the first line or a Markdown heading.',
  '使用 styles/ 下的风格 profile；留空时用默认 unified 风格。':
    'Use a style profile from styles/; leave blank for the default unified style.',
  '免 Key，在线调用 Microsoft Edge 朗读服务；需要联网，文本会发送到 Microsoft。':
    'No key needed; uses Microsoft Edge online speech. Requires internet; text is sent to Microsoft.',
  '保存目标': 'Save goals',
  '每周文章': 'Articles per week',
  '每周阅读天数': 'Reading days per week',
  '每周目标用于阅读复盘和成长页的进度，不影响文章内容。':
    'Weekly goals drive recaps and growth progress; they do not change content.',
  '阅读目标': 'Reading goals',
  '阅读日历': 'Reading calendar',
  '阅读天数': 'Reading days',
  '阅读复盘': 'Recap',
  '本周阅读': 'This week',
  '查看本周复盘': 'View weekly recap',
  '查看完整复盘': 'View full recap',
  '导出周报': 'Export weekly report',
  '下周建议': 'Next week',
  '写作输出': 'Outputs',
  '写作风格': 'Writing style',
  '连续阅读天数': 'Reading streak',
  '正在精读': 'Reading now',
  '在读': 'In progress',
  '已读完文章': 'Articles finished',
  '累计精读段落': 'Paragraphs read',
  '累计复习 100 次': '100 reviews total',
  '累计读完 5 篇文章': '5 articles finished',
  '掌握 50 个词或表达': 'Master 50 words or phrases',
  '写下 10 篇英文输出': 'Write 10 English outputs',
  '词库累计收集 50 张卡': 'Collect 50 cards',
  '读完第一篇文章': 'Finish your first article',
  '连续学习 3 天': 'Study 3 days in a row',
  '连续学习 7 天': 'Study 7 days in a row',
  '一周之火': 'Week streak',
  '三日不断': 'Three-day streak',
  '五篇精读': 'Five packs',
  '初次入境': 'First stamp',
  '早起鸟': 'Early bird',
  '夜猫子': 'Night owl',
  '收藏家': 'Collector',
  '百次重逢': 'Hundred reviews',
  '下笔有神': 'In the flow',
  '成就': 'Achievements',
  '成长': 'Growth',
  '手机': 'Phone',
  '手机访问': 'Phone access',
  '开启手机访问': 'Enable phone access',
  '让同一 Wi-Fi 下的手机打开这个本地应用。开启后会生成一个带令牌的链接，关闭后立即失效。':
    'Open this local app on a phone on the same Wi-Fi. A token link is created and expires when disabled.',
  '只在可信网络使用；不要在公共 Wi-Fi 开启。': 'Use only on a trusted network; avoid public Wi-Fi.',
  '手机：浏览器菜单 → 添加到主屏幕。电脑：地址栏右侧的安装图标。':
    'Phone: browser menu → Add to Home Screen. Desktop: install icon in the address bar.',
  '把 CloseRead 添加到桌面或手机主屏，打开时更像一个独立应用；数据仍然只留在本机。':
    'Add CloseRead to your desktop or home screen; data stays on this machine.',
  '添加到桌面': 'Add to home screen',
  '应用': 'App',
  '数据与学习包': 'Data & packs',
  '学习包 / 回收站': 'Packs / trash',
  '完整备份包含词库、导入材料、学习包目录、阅读进度、缓存音频和金句。':
    'A full backup includes the library, imported material, packs, reading progress, cached audio and quotes.',
  '恢复会覆盖当前词库、学习包目录和阅读进度；请先下载一份当前备份。':
    'Restoring overwrites the library, packs and reading progress. Download a backup first.',
  '回收站是空的。删除的学习包和材料会先放在这里。':
    'Trash is empty. Deleted packs and materials appear here first.',
  '删除': 'Delete',
  '清空': 'Clear',
  '还没有模型调用记录。': 'No model calls yet.',
  '支持 EPUB、MOBI、AZW、AZW3 和 DOCX；DRM 加密文件无法解析。':
    'Supports EPUB, MOBI, AZW, AZW3 and DOCX; DRM-protected files cannot be parsed.',
  '支持普通文章页、RSS/Atom 订阅链接和直链 PDF；订阅会导入最新一篇。付费墙、登录页和机器人验证页无法抓取。':
    'Supports article pages, RSS/Atom feeds and direct PDF links; feeds import the latest article. Paywalls, login pages and bot checks cannot be fetched.',
  '需要有文字层；扫描件暂不支持，可以改用粘贴文本。':
    'Needs a text layer; scanned files are not supported—paste text instead.',
  '开始读的文章会在这里留下一个章；读完后再回来，可以生成一张 3:4 分享卡。':
    'Each article you start leaves a stamp; finish it to make a 3:4 share card.',
  '去精读': 'Open reading',
  '继续队列': 'Continue queue',
  '核对释义': 'Check meanings',
  '先凭第一反应判断，暂不显示释义；点“核对释义”后再对照意思、修正判断。结果只保存在本机，用来校准文章难度和生词标注。':
    'Judge from first impressions first; meanings stay hidden. Tap “Check meanings” to compare and adjust. Results stay on this machine and calibrate difficulty and word highlights.',
  '默认按文章长度建议 8–16 项（约 20–25 分钟），也可以按 5 个一档手动指定。':
    'Suggests 8–16 items (about 20–25 min) based on article length; or pick in steps of 5.',
  '分享卡 ↗': 'Share card ↗',
  '未学词': 'Unseen words',
  '已掌握': 'Known',
  '学习中': 'Learning',
  '词汇花园': 'Word garden',
  '默认风格': 'Default style',
  '🕵️ 语境侦探': '🕵️ Usage Detective',
  '已获得': 'Unlocked',
  '开源项目': 'Open source',
  '喜欢 CloseRead？': 'Enjoying CloseRead?',
  '如果它对你的英语学习有帮助，欢迎在 GitHub 点亮 Star、Fork 一份，或直接提建议。':
    'If it helps your English study, star the repo, fork it, or send feedback on GitHub.',
  '在 GitHub 点亮 Star': 'Star on GitHub',
  '提建议': 'Send feedback',
  '关于 CloseRead': 'About CloseRead',
  '本地优先的开源英语精读工具。数据保存在你自己的电脑上，模型由你自己选择。':
    'A local-first, open-source intensive reading workspace. Your data stays on your computer.',
  'MIT License · 本地优先 · 开源仓库': 'MIT License · local-first · open source',
  'GitHub 开源仓库': 'GitHub repository',
  '在 GitHub 打开 CloseRead 仓库（新窗口）': 'Open the CloseRead repository on GitHub (new tab)',
}

const PACK_EN: Record<string, string> = {
  '天': 'days',
  '篇': 'articles',
  '段': 'paragraphs',
  '张': '',
  '词': 'words',
  '今天读：': 'Today: ',
  '，还没有生成学习包。': ', no pack yet.',
  '单句精读': 'Sentence focus',
  '今日': 'Today',
  'Learning Pack': 'Learning Pack',
  '添加单词': 'Add words',
  '添加生词': 'Add words',
  '相关词': 'Related words',
  '导出': 'Export',
  '复习这篇': 'Review this pack',
  '返回文章列表': 'Back to articles',
  '只看核心词': 'Core words only',
  '音频跟读': 'Audio shadowing',
  '隐藏译文': 'Hide translation',
  '显示译文': 'Show translation',
  '大字': 'Larger text',
  '词太多': 'Too many words',
  '词太少': 'Too few words',
  '编辑标题': 'Edit title',
  '编辑导语': 'Edit standfirst',
  '精读完成': 'Finish reading',
  '重新开始': 'Start over',
  '逐段精读': 'Paragraph reading',
  '本篇学习要点': 'Study points',
  '精读导读': 'Reading guide',
  '句子卡': 'Sentence cards',
  'INTENSIVE READING': 'INTENSIVE READING',
  '听原句': 'Listen',
  '录音': 'Record',
  '停止录音': 'Stop recording',
  '上一句': 'Previous',
  '下一句': 'Next',
  '重来': 'Reset',
  '检查': 'Check',
  '听全文': 'Listen to article',
  '逐句跟读': 'Sentence shadowing',
  '生成整篇音频': 'Generate article audio',
  '重新生成': 'Regenerate',
  '浏览器朗读': 'Browser voice',
  '语音设置 · 神经语音': 'Voice settings · neural TTS',
  '保存并使用': 'Save and use',
  '改回本地语音': 'Use local voice',
  '造句': 'Write a sentence',
  '词源': 'Etymology',
  '发散': 'Expand',
  '高亮': 'Highlight',
  '本段已读': 'Mark paragraph read',
  '下一步': 'Next',
  '关闭': 'Close',
  '保存': 'Save',
  '删除': 'Delete',
  '编辑': 'Edit',
  '参考答案': 'Reference answer',
  '看参考答案': 'Show reference answer',
  '发音': 'Pronounce',
  '翻译本句': 'Translate sentence',
  '加入句子卡': 'Add sentence card',
  '合并下一句': 'Merge next',
  '拆分本句': 'Split sentence',
  '重新生成本段笔记': 'Regenerate paragraph notes',
  'MOBI（需 Calibre）': 'MOBI (requires Calibre)',
  'PDF · 紧凑（省页）': 'PDF · Compact (fewer pages)',
  'PDF · 舒适': 'PDF · Comfortable',
  'PNG 分图': 'PNG pages',
  'PNG 长图': 'PNG long image',
  '网页 HTML': 'Web HTML',
  '拆分句子': 'Split sentence',
  '更多操作': 'More actions',
  '编辑精读内容': 'Edit reading content',
  '编辑精读笔记': 'Edit reading notes',
  '词汇发散': 'Expand vocabulary',
  '返回文章': 'Back to article',
  '造句实验室': 'Sentence lab',
  '阅读设置': 'Reading settings',
  '音频与跟读': 'Audio & shadowing',
  '例如 resilience / take a toll on': 'e.g. resilience / take a toll on',
  '← → 切换句子 · Esc 退出 · 选中句中的词可以直接加入生词':
    '← → switch sentences · Esc to exit · select a word to add it to your library',
  '← 上一句': '← Previous',
  '← 文章': '← Article',
  '← 返回今日': '← Back to today',
  '← 退出精读': '← Exit reading',
  '下一句 →': 'Next →',
  '中英切换': 'Toggle translation',
  '主题': 'Theme',
  '夜间': 'Dark',
  '字号': 'Font size',
  '完形填空': 'Cloze',
  '完成精读': 'Finish reading',
  '保存后出现在「今日」的输出里': 'Saved to Today’s output',
  '保存并更新译文': 'Save & update translation',
  '保存断句': 'Save split',
  '保存笔记': 'Save notes',
  '保存输出': 'Save output',
  '修复分段': 'Fix paragraphs',
  '先看三句原文': 'Three source sentences first',
  '全文脉络 · 点标签跳到段落': 'Full outline · tap a tag to jump',
  '关键句': 'Key sentence',
  '关键句解析': 'Key sentence analysis',
  '其他表达': 'Other phrases',
  '删除本段': 'Delete paragraph',
  '动作与影响': 'Action & effect',
  '单词或短语': 'Word or phrase',
  '参考回答与译文': 'Reference answer & translation',
  '参考答案与译文': 'Reference answer & translation',
  '句型 / 语法': 'Pattern / grammar',
  '回到顶部': 'Back to top',
  '声音': 'Voice',
  '导出词数': 'Export word count',
  '导出前会自动补齐缺失的派生、参考答案和练习译文；需要模型时会调用。':
    'Export fills in missing derivations, reference answers and exercise translations; uses a model when needed.',
  '想一想': 'Think',
  '手动添加 · 不在原文段落中': 'Manual add · outside the article',
  '手动输入一个词或短语': 'Enter a word or phrase',
  '手机宽 · 900': 'Phone width · 900',
  '拆分这句': 'Split this sentence',
  '摘要': 'Summary',
  '整篇音频在本地生成，不上传。生成一次后可以离线反复听。':
    'Article audio is generated locally and never uploaded. Generate once, then listen offline.',
  '本篇表达线索': 'Expression threads',
  '段落作用': 'Paragraph role',
  '标准 · 1200': 'Standard · 1200',
  '模型': 'Model',
  '点击后加载题干译文…': 'Tap to load question translation…',
  '点击后加载题目译文…': 'Tap to load exercise translation…',
  '生成使用 macOS 自带语音，首次可能需要半分钟；其他系统可以改用「浏览器朗读」。想要更自然的声音，可在「系统设置 → 辅助功能 → 朗读内容 → 系统声音 → 管理声音」下载 Premium / Enhanced 英文声音，重新生成后会自动使用。':
    'Uses the macOS system voice; the first run may take half a minute. On other systems use “Browser voice”. For a more natural voice, download Premium / Enhanced English voices in System Settings → Accessibility → Spoken Content → System Voice → Manage Voices; regenerated audio uses them automatically.',
  '生成学习卡': 'Generate cards',
  '生成导读': 'Generate guide',
  '生成通常需要 20–40 秒。移除词卡时，点右上角 × 两次确认。':
    'Generation usually takes 20–40 seconds. To remove a card, tap × in its top-right corner twice.',
  '答案与译文': 'Answer & translation',
  '答案可展开': 'Answer expandable',
  '精读笔记 · Markdown': 'Reading notes · Markdown',
  '练习与讨论': 'Exercises & discussion',
  '编辑原文': 'Edit source',
  '背景': 'Background',
  '补充词汇': 'Extra vocabulary',
  '补齐导读与笔记': 'Complete guide & notes',
  '讨论 / 输出': 'Discussion / output',
  '提交批改': 'Submit for review',
  '论点': 'Argument',
  '词汇发散 · 相关词': 'Expand vocabulary · related words',
  '词汇总表': 'Vocabulary list',
  '语气': 'Tone',
  '语法': 'Grammar',
  '读之前先带着这几个问题，读完再回来对一遍':
    'Keep these questions in mind; return after reading to check them.',
  '读完写三句': 'Write three sentences after reading',
  '跟随系统': 'System',
  '转折': 'Contrast',
  '选中即加词 / 加句': 'Select to add word / sentence',
  '选词说明：': 'Selection:',
  '逐句原声优先使用本地缓存的语音，首次可能要等一两秒；没有本地语音时回退浏览器朗读。单句录音最长 30 秒，录音只留在当前页面，关闭后消失。':
    'Sentence audio uses the local cache first; the first play may take a second or two, then falls back to browser speech. Recordings are limited to 30 seconds and stay on this page only.',
  '速度': 'Speed',
  '重新生成答案': 'Regenerate answer',
  '阅读提示': 'Reading tips',
  '阅读理解': 'Comprehension',
  '隐藏笔记': 'Hide notes',
  '音频 · 跟读': 'Audio · shadowing',
  '高清 2× · 1800': 'HD 2× · 1800',
  '标准': 'Standard',
  '紧凑': 'Compact',
  '宽松': 'Relaxed',
  '窄': 'Narrow',
  '宽': 'Wide',
  '小': 'Small',
  '大': 'Large',
  '特大': 'Extra large',
  '版心': 'Page width',
  '行高': 'Line height',
  '纸色': 'Paper',
  '例证': 'Example',
  '个重点词': ' key words',
  '个长句': ' long sentences',
  '局势与对象': 'Situation & target',
  '在要断开的位置插入': 'Insert at the split point',
  '，然后保存。例如：前半句 | 后半句。': ', then save. Example: first half | second half.',
  '先通读一遍，再逐段看结构、长句和语法笔记。每段右上角的“精读这段”可以直接进入单句模式。':
    'Read once, then study structure, long sentences and grammar notes paragraph by paragraph. “Focus this paragraph” opens single-sentence mode.',
  '先通读一遍，注意每段的 role 和关键句；遇到细节再回到段落笔记和词卡。':
    'Read once, noting each paragraph’s role and key sentence; return to paragraph notes and cards for details.',
  '在下面原文中选中 1–8 个词，页面会浮出“添加”按钮，直接生成学习卡；选中一整句，可以生成用于回译的句子卡。没有出现在原文里的词会放进“补充词汇”。':
    'Select 1–8 words in the text below to add a card; select a whole sentence to make a back-translation card. Words not in the text go to “Extra vocabulary”.',
  'Key 只保存在本机 data/tts.json（0600），不会返回页面。神经语音会把文章文本发送到你填写的接口。':
    'The key is stored only in data/tts.json on this machine (0600) and never returned to the page. Neural speech sends article text to the endpoint you configure.',
}

const REVIEW_PATTERNS: Array<[string, string, string]> = [
  ['^← 今日$', '← Today', ''],
  ['^(\\d+) 词$', '$1 words', ''],
  ['^(\\d+) 个学习项$', '$1 items', ''],
  ['^精读约 (\\d+) 分钟$', '~$1 min intensive reading', ''],
  ['^已读 (\\d+) \\/ (\\d+) 段$', '$1 / $2 paragraphs read', ''],
  ['^(\\d+) \\/ (\\d+) 段$', '$1 / $2 paragraphs', ''],
  ['^Streak (\\d+) 天$', 'Streak $1 days', ''],
  ['^Finished (\\d+) 篇$', 'Finished $1 articles', ''],
  ['^Read (\\d+) 段$', 'Read $1 paragraphs', ''],
  ['^Sentence cards (\\d+) 张$', 'Sentence cards $1', ''],
  ['^连续 (\\d+) 天$', 'Streak $1 days', ''],
  ['^已精读 (\\d+) 篇$', 'Finished $1 articles', ''],
  ['^已读 (\\d+) 段$', 'Read $1 paragraphs', ''],
  ['^句子卡 (\\d+) 张$', 'Sentence cards $1', ''],
  ['^今天读：(.+)（(\\d+) 词），还没有生成学习包。$', 'Today: $1 ($2 words), no pack yet.', ''],
  ['，还没有生成学习包。', ', no pack yet.', ''],
  ['^复习 (\\d+) 个到期词（可选，约 5 分钟），词库里还有 (\\d+) 个$', 'Review $1 due cards (optional, ~5 min); $2 in library', ''],
  ['^精读完成后，这里会出现今天的思考题。$', 'Your reflection prompt will appear after you finish reading.', ''],
  ['^从今天开始$', 'Start today', ''],
  ['^首次正确率 (\\d+)% · (\\d+) 项$', 'First-attempt accuracy $1% · $2 items', ''],
  ['(.+) 分析，生成通常需要 1–3 分钟。', '$1 analysis; generation usually takes 1–3 minutes.', ''],
  ['^去生成$', 'Generate', ''],
  ['^上次看到第 (\\d+) 段$', 'Last at paragraph $1', ''],
  ['^(\\d+) 段$', '$1 paragraphs', ''],
  ['^(\\d{4}-\\d{2}-\\d{2}) · (\\d+) 次$', '$1 · $2 times', ''],
  ['^已精读 ([\\d,]+) \\/ ([\\d,]+) 段$', '$1 / $2 paragraphs read', ''],
  ['^已获得 ([\\d,]+) \\/ ([\\d,]+)$', '$1 / $2 unlocked', ''],
  ['^已认识 ([\\d,]+) \\/ ([\\d,]+)$', '$1 / $2 known', ''],
  ['^上次 (A1|A2|B1|B2|C1|C2) · ([\\d,]+) \\/ ([\\d,]+) · (\\d{4}-\\d{2}-\\d{2})$', 'Last $1 · $2 / $3 · $4', ''],
  ['^刚开始 · (\\d{4}\\.\\d{2}\\.\\d{2})$', 'Just started · $1', ''],
  ['^整本 · (\\d+) 项 · (\\d{4}-\\d{2}-\\d{2})$', 'Full book · $1 items · $2', ''],
  ['^文章 · (\\d+) 项 · (\\d{4}-\\d{2}-\\d{2})$', 'Article · $1 items · $2', ''],
  ['^第 (\\d+) \\/ (\\d+) 篇 · (\\d+) 项 · (\\d{4}-\\d{2}-\\d{2})$', 'Part $1 / $2 · $3 items · $4', ''],
  ['^(A1|A2|B1|B2|C1|C2) · ([\\d,]+) 词 · (\\d+) 分钟$', '$1 · $2 words · $3 min', ''],
  ['^最近 12 周 · (\\d+) 天有学习记录$', 'Last 12 weeks · $1 active days', ''],
  ['^(\\d+) 篇 \\/ (\\d+) 个回收站条目$', '$1 packs / $2 trash items', ''],
  ['^(\\d+) \\/ (\\d+) 篇$', '$1 / $2 articles', ''],
  ['^(\\d+) \\/ (\\d+) 天$', '$1 / $2 days', ''],
  ['^(\\d+) 个学习包$', '$1 packs', ''],
  ['^(\\d+) 个$', '$1', ''],
  ['^(\\d+) 次$', '$1 times', ''],
  ['^下周先清 (\\d+) 张到期卡、每天学 (\\d+) 个新词，再读一篇新文章。$', 'Clear $1 due cards, learn $2 new words a day, then read a new article.', ''],
  ['^在 (\\d+) 点后复习一次$', 'Review once after $1:00', ''],
  ['^在 (\\d+) 点前复习一次$', 'Review once before $1:00', ''],
  ['^释义已隐藏。判断完自己的熟悉程度后，再点“核对释义”。 当前水平：(.+)，重新诊断会覆盖上次结果，但阅读记录不受影响。$', 'Meanings hidden. Rate your familiarity, then tap “Check meanings”. Current level: $1. A new check replaces this result; reading history is unaffected.', ''],
  ['（(\\d+) 词）', ' ($1 words)', ''],
  ['（', ' (', ''],
  ['）', ') ', ''],
]

const PACK_PATTERNS: Array<[string, string, string]> = [
  ['^← 今日$', '← Today', ''],
  ['^(\\d+) 词$', '$1 words', ''],
  ['^(\\d+) 个学习项$', '$1 items', ''],
  ['^精读约 (\\d+) 分钟$', '~$1 min intensive reading', ''],
  ['^已读 (\\d+) \\/ (\\d+) 段$', '$1 / $2 paragraphs read', ''],
  ['^本段重点词 (\\d+) 个$', 'Key words in this paragraph: $1', ''],
  ['^第 (\\d+) 段$', 'Paragraph $1', ''],
  ['^(\\d+) 段 · 原文 \\/ 译文 \\/ 精读笔记$', '$1 paragraphs · text / translation / notes', ''],
  ['^(\\d+) 项 · 点击段落编号回到原文$', '$1 items · tap a paragraph number to jump back', ''],
  ['^全部 (\\d+) 个$', 'All $1', ''],
  ['^(\\d+) 项$', '$1 items', ''],
  ['^(\\d+) 个$', '$1', ''],
  ['^标记第 (\\d+) 段已读$', 'Mark paragraph $1 read', ''],
  ['^(.+) · 读前先看老师怎么拆$', '$1 · How a teacher reads it first', ''],
  ['^由 CloseRead 生成 · (.+)$', 'Generated by CloseRead · $1', ''],
  ['（(\\d+) 词）', ' ($1 words)', ''],
]

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * Client-side label translation. Content selectors are excluded so article text
 * and AI notes are never rewritten.
 */
export function i18nScript(kind: 'review' | 'pack'): string {
  const dictionary = kind === 'review' ? REVIEW_EN : PACK_EN
  const skip =
    kind === 'review'
      ? '.original,.translation,.para-note,.item,.editorial,.output-text,.word-story,.sentence-rewrites,.library-list .row .def,.library-list .row .context,.result-meta,.graph-detail'
      : '.original,.translation,.para-note,.item,.editorial,.word-story,.sentence-rewrites,.vocab-table,.focus-original,.focus-translation,.shadow-text,.shadow-translation,.output-feedback'
  return `<script>
(function () {
  var KEY = 'closeread-lang';
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'zh' ? 'zh' : (localStorage.getItem(KEY) || 'zh');
  var dictionary = ${escapeJsonForScript(dictionary)};
  var patterns = ${escapeJsonForScript(kind === 'review' ? REVIEW_PATTERNS : PACK_PATTERNS)};
  var skip = '${skip}';
  if (lang === 'en') document.documentElement.lang = 'en';
  function allowed(node) {
    var element = node.nodeType === 1 ? node : node.parentElement;
    return element && !element.closest('script,style,textarea,[data-no-i18n],' + skip);
  }
  function translateText(value) {
    var trimmed = value.trim();
    if (!trimmed || trimmed.length > 300) return value;
    var hasTranslation = Object.prototype.hasOwnProperty.call(dictionary, trimmed);
    var result = hasTranslation ? value.replace(trimmed, dictionary[trimmed]) : value;
    for (var i = 0; i < patterns.length; i++) {
      result = result.replace(new RegExp(patterns[i][0], patterns[i][2]), patterns[i][1]);
    }
    return result;
  }
  function translateTextNode(node) {
    if (!allowed(node)) return;
    var next = translateText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  function translateAttributes(element) {
    if (!allowed(element)) return;
    ['placeholder', 'aria-label', 'title'].forEach(function (attribute) {
      if (!element.hasAttribute(attribute)) return;
      var value = element.getAttribute(attribute);
      var next = translateText(value);
      if (next !== value) element.setAttribute(attribute, next);
    });
  }
  function translate(root) {
    if (lang !== 'en') return;
    if (root.nodeType === 3) {
      translateTextNode(root);
      return;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) translateTextNode(node);
    if (root.nodeType === 1) translateAttributes(root);
    (root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label],[title]') : []).forEach(translateAttributes);
  }
  if (lang === 'en') {
    translate(document.body);
    // Translate only changed text and newly inserted nodes. A full-page scan on
    // every mutation made long packs expensive in English mode.
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
          return;
        }
        if (mutation.type === 'attributes') {
          translateAttributes(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(function (node) { translate(node); });
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title'],
    });
  }
  var toggle = document.getElementById('lang-toggle');
  if (toggle) {
    toggle.textContent = lang === 'en' ? '中文' : 'EN';
    toggle.addEventListener('click', function () {
      var next = lang === 'en' ? 'zh' : 'en';
      localStorage.setItem(KEY, next);
      var url = new URL(location.href);
      if (next === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
      location.href = url.toString();
    });
  }
})();
</script>`
}
