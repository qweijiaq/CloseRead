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
  '复习': 'Review',
  '词库': 'Library',
  '学习包': 'Packs',
  '护照': 'Passport',
  '复盘': 'Insights',
  '词网': 'Word web',
  '导入': 'Import',
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
  '看学习包': 'View packs',
  '导入新材料': 'Import material',
  '导入材料': 'Import material',
  '返回文章列表': 'Back to articles',
  '复习这篇': 'Review this pack',
  'AI 小剧场': 'AI theater',
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
  '导出': 'Export',
  '复习这篇': 'Review this pack',
  '返回文章列表': 'Back to articles',
  '只看核心词': 'Core words only',
  '音频跟读': 'Audio shadowing',
  'AI 小剧场': 'AI theater',
  '隐藏译文': 'Hide translation',
  '显示译文': 'Show translation',
  '大字': 'Larger text',
  '60 秒挑战': '60-second challenge',
  '微故事': 'Micro story',
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
      ? '.original,.translation,.para-note,.item,.editorial,.output-text,.theater-message,.word-story,.sentence-rewrites,.library-list .row .def,.library-list .row .context,.result-meta,.graph-detail'
      : '.original,.translation,.para-note,.item,.editorial,.word-story,.sentence-rewrites,.vocab-table,.focus-original,.focus-translation,.shadow-text,.shadow-translation,.micro-text,.micro-translation,.theater-message,.output-feedback'
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
    if (!trimmed || trimmed.length > 120) return value;
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
  function translate(root) {
    if (lang !== 'en') return;
    if (root.nodeType === 3) {
      translateTextNode(root);
      return;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) translateTextNode(node);
    (root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label],[title]') : []).forEach(function (element) {
      if (!allowed(element)) return;
      ['placeholder', 'aria-label', 'title'].forEach(function (attribute) {
        if (!element.hasAttribute(attribute)) return;
        var value = element.getAttribute(attribute);
        var next = translateText(value);
        if (next !== value) element.setAttribute(attribute, next);
      });
    });
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
        mutation.addedNodes.forEach(function (node) { translate(node); });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
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
