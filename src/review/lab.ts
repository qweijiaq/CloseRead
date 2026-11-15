import { themeBootScript } from '../theme.js'
import { pwaHead } from './pwa.js'

export function renderLabApp(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>实验室 · CloseRead</title>
${themeBootScript()}
${pwaHead()}
<link rel="stylesheet" href="/lab.css">
</head>
<body>
<a class="skip-link" href="#main-content">跳到实验室</a>
<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="CloseRead 首页"><span class="brand-mark">CR</span><span class="brand-copy">CloseRead<small>learning studio</small></span></a>
    <a class="side-import" href="/?tab=import">＋ 导入文章</a>
    <div class="side-label">学习</div>
    <nav class="side-nav">
      <a class="nav-link" href="/?tab=read"><span class="nav-icon">◉</span><span>精读</span></a>
      <a class="nav-link" href="/?tab=packs"><span class="nav-icon">▦</span><span>文章</span></a>
    </nav>
    <details class="side-more" open>
      <summary>更多</summary>
      <nav class="side-nav side-more-list">
        <a class="nav-link active" href="/lab"><span class="nav-icon">✦</span><span>练习</span></a>
        <a class="nav-link" href="/?tab=passport"><span class="nav-icon">◈</span><span>成长</span></a>
        <a class="nav-link" href="/?tab=insights"><span class="nav-icon">▥</span><span>复盘</span></a>
      </nav>
    </details>
    <div class="sidebar-spacer"></div>
    <div class="side-note">一次只练一个能力。<br>读完再回来。</div>
  </aside>
  <div class="app-main">
    <header class="topbar">
      <div class="topbar-title"><span class="topbar-eyebrow">LEARNING LAB</span><h1>练习</h1></div>
      <div class="topbar-actions">
        <span class="lab-status" id="lab-status">正在加载…</span>
        <button class="icon-btn" id="lab-theme" type="button">自动</button>
        <a class="topbar-tool" href="/">阅读器</a>
      </div>
    </header>
    <main class="lab-main" id="main-content" tabindex="-1">
      <section class="lab-intro">
        <div>
          <p class="lab-eyebrow">READ · WATCH · LISTEN · SPEAK · WRITE</p>
          <h1>把学过的词，练成三种能力</h1>
          <p class="lab-lead">从你的词库取词：围绕词义、搭配和例句，练听、说、读、写。一次只做一个小任务。</p>
        </div>
        <div class="lab-picker">
          <label for="lab-scope">学习词库范围</label>
          <div class="cselect lab-cselect" data-cselect>
            <input type="hidden" id="lab-scope" value="all">
            <button class="cselect-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
              <span class="cselect-label">全部学习词</span><span class="cselect-arrow" aria-hidden="true"><svg viewBox="0 0 10 6" width="9" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            </button>
            <div class="cselect-menu" role="listbox" hidden></div>
          </div>
          <div class="lab-pack-meta" id="lab-pack-meta"></div>
        </div>
      </section>
      <section id="lab-dashboard" class="lab-dashboard"></section>
      <section id="lab-stage" class="lab-stage" hidden></section>
    </main>
  </div>
  <nav class="mobile-nav" aria-label="移动导航">
    <a href="/?tab=read"><span>◉</span>精读</a>
    <a href="/?tab=packs"><span>▦</span>文章</a>
    <a class="active" href="/lab"><span>✦</span>练习</a>
  </nav>
</div>
<audio id="lab-player" class="lab-player" controls hidden></audio>
<div class="lab-toast" id="lab-toast" hidden></div>
<noscript><p class="lab-noscript">实验室需要 JavaScript。</p></noscript>
<script src="/lab.js" defer></script>
</body>
</html>`
}
