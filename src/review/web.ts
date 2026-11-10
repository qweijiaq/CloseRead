import { i18nScript } from '../i18n.js'
import { LLM_PROVIDERS } from '../llm/providers.js'
import { themeBootScript } from '../theme.js'
import { pwaHead } from './pwa.js'

function escapeText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/\n+/g, ' ')
}

interface CustomSelectOption {
  value: string
  label: string
}

function customSelectMarkup(
  id: string,
  value: string,
  options: CustomSelectOption[],
  className = '',
): string {
  const selected = options.find((option) => option.value === value) ?? options[0]
  return `<div class="cselect ${className}" data-cselect>
    <input type="hidden" id="${escapeAttr(id)}" value="${escapeAttr(selected?.value ?? '')}">
    <button class="cselect-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="cselect-label">${escapeText(selected?.label ?? '')}</span><span class="cselect-arrow">⌄</span>
    </button>
    <div class="cselect-menu" role="listbox" hidden>
      ${options
        .map(
          (option) =>
            `<button type="button" role="option" class="cselect-option${option.value === selected?.value ? ' is-selected' : ''}" data-value="${escapeAttr(option.value)}">${escapeText(option.label)}</button>`,
        )
        .join('')}
    </div>
  </div>`
}

export function renderReviewApp(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning Reader</title>
${themeBootScript()}
${pwaHead()}
<style>
  :root {
    --paper: #f6f2e8;
    --paper-2: #efe7d7;
    --card: #fffdf8;
    --ink: #1c1a16;
    --muted: rgba(28, 26, 22, .55);
    --line: rgba(28, 26, 22, .12);
    --accent: #3f5f7f;
    --accent-soft: rgba(63, 95, 127, .08);
    --rust: #b03a2e;
    --rust-soft: rgba(176, 58, 46, .08);
    --shadow: 0 1px 2px rgba(28, 26, 22, .04);
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --paper: #141619;
    --paper-2: #1c1f23;
    --card: #22262b;
    --ink: #e9e4d9;
    --muted: rgba(233, 228, 217, .58);
    --line: rgba(233, 228, 217, .14);
    --accent: #8db1d6;
    --accent-soft: rgba(141, 177, 214, .12);
    --rust: #e07a6e;
    --rust-soft: rgba(224, 122, 110, .12);
    --shadow: 0 1px 2px rgba(0, 0, 0, .4);
  }
  html[data-theme="dark"] .stat,
  html[data-theme="dark"] .forecast,
  html[data-theme="dark"] .today-plan,
  html[data-theme="dark"] .home-card,
  html[data-theme="dark"] .home-diagnosis,
  html[data-theme="dark"] .insight-stat,
  html[data-theme="dark"] .diagnosis-word,
  html[data-theme="dark"] .practice,
  html[data-theme="dark"] .article-row,
  html[data-theme="dark"] .graph-word,
  html[data-theme="dark"] .llm-field input,
  html[data-theme="dark"] .article-search,
  html[data-theme="dark"] .graph-controls input[type="search"],
  html[data-theme="dark"] .cselect-trigger,
  html[data-theme="dark"] .lan-url { background: var(--card); }
  html[data-theme="dark"] .home-hero { background: linear-gradient(135deg, var(--card), var(--paper-2)); }
  html[data-theme="dark"] .context,
  html[data-theme="dark"] .today-output-prompt { background: rgba(224, 122, 110, .08); }
  html[data-theme="dark"] .graph-detail { background: rgba(34, 38, 43, .96); }
  html[data-theme="dark"] input,
  html[data-theme="dark"] textarea,
  html[data-theme="dark"] select { background: var(--card); color: var(--ink); }
  html[data-theme="dark"] .passport-canvas-wrap { background: var(--paper-2); }
  html[data-theme="dark"] .home-track { background: rgba(233, 228, 217, .16); }
  html[data-theme="dark"] .btn-primary { color: #141619; }
  html[data-theme="dark"] .btn-primary:hover { background: #a7c4e0; color: #141619; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    margin: 0; background: var(--paper);
    color: var(--ink); font-family: 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 34px 20px 70px; }
  .store-warning { margin: 0 0 18px; padding: 12px 14px; border: 1px solid rgba(176,58,46,.35); border-radius: 10px; background: rgba(176,58,46,.06); color: var(--ink); font-size: 12.5px; line-height: 1.65; }
  .store-warning strong { display: block; margin-bottom: 4px; color: var(--rust); }
  .store-warning code { display: block; margin-top: 6px; font-family: var(--mono); font-size: 11px; word-break: break-all; color: var(--muted); }
  .phone-mode-banner { margin: 0 0 18px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; line-height: 1.6; }
  body.phone-mode .side-import,
  body.phone-mode .header-import,
  body.phone-mode [data-go-tab="import"],
  body.phone-mode #vocab-books-open,
  body.phone-mode [data-delete-pack],
  body.phone-mode [data-delete-resource],
  body.phone-mode [data-build],
  body.phone-mode [data-articles] { display: none !important; }
  body.phone-mode #backup-download,
  body.phone-mode #settings-open,
  body.phone-mode [data-tab="settings"],
  body.phone-mode #view-settings { display: none !important; }
  body.phone-mode #view-import { display: none !important; }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
  .brand { font-family: ui-serif, Georgia, serif; font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
  .brand span { color: var(--accent); }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stat { border: 1px solid var(--line); background: rgba(255,253,248,.75); border-radius: 999px; padding: 5px 10px; font-size: 12px; color: var(--muted); }
  .stat strong { color: var(--ink); }
  nav { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 24px; overflow-x: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar { display: none; }
  nav button { flex: 0 0 auto; white-space: nowrap; border: 0; background: transparent; padding: 10px 14px; font-size: 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
  nav button.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .view { display: none; }
  .view.active { display: block; }
  .review-settings { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; color: var(--muted); font-size: 12px; }
  .review-settings .btn { padding: 4px 10px; font-size: 11.5px; }
  .first-accuracy { margin-left: auto; color: var(--accent); }
  .progress { display: flex; justify-content: space-between; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
  .progress .link-button { margin-left: auto; }
  .forecast { display: flex; align-items: flex-end; gap: 10px; margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,253,248,.6); }
  .forecast[hidden] { display: none; }
  .forecast-title { flex: 0 0 auto; color: var(--muted); font-size: 10.5px; line-height: 1.4; }
  .forecast-days { display: flex; flex: 1; align-items: flex-end; gap: 6px; min-width: 0; }
  .forecast-day { display: flex; flex: 1; min-width: 0; flex-direction: column; align-items: center; gap: 3px; }
  .forecast-bar { width: 100%; max-width: 28px; min-height: 3px; border-radius: 4px 4px 0 0; background: rgba(63,95,127,.28); }
  .forecast-day.is-today .forecast-bar { background: var(--rust); }
  .forecast-day b { color: var(--muted); font-size: 9px; font-weight: 400; white-space: nowrap; }
  .forecast-day small { color: var(--muted); font-size: 9px; }
  .forecast-overdue { flex: 0 0 auto; color: var(--muted); font-size: 10px; }
  .badge.leech { color: var(--rust); border-color: rgba(176,58,46,.35); background: rgba(176,58,46,.07); }
  .leech-hint { margin: 10px 0 0; padding: 9px 11px; border-left: 2px solid var(--rust); background: rgba(176,58,46,.05); color: var(--muted); font-size: 12px; line-height: 1.65; }
  .today-plan { margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,253,248,.75); color: var(--muted); font-size: 12.5px; }
  .today-plan strong { color: var(--ink); margin-right: 6px; }
  .today-plan a { color: var(--accent); text-decoration: none; font-weight: 600; }
  .today-plan a:hover { text-decoration: underline; }
  .home-hero {
    margin-bottom: 14px; padding: 26px 28px; border: 1px solid var(--line); border-radius: 20px;
    background: linear-gradient(135deg, rgba(255,253,248,.96), rgba(245,230,218,.5)); box-shadow: var(--shadow);
  }
  .home-eyebrow { color: var(--rust); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
  .home-title { margin: 0; font-family: ui-serif, Georgia, serif; font-size: clamp(26px, 4vw, 38px); line-height: 1.2; letter-spacing: -.02em; }
  .home-meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
  .home-progress { display: flex; align-items: center; gap: 10px; margin-top: 18px; color: var(--muted); font-size: 12px; }
  .home-track { flex: 1; max-width: 320px; height: 7px; border-radius: 999px; background: rgba(28,26,22,.1); overflow: hidden; }
  .home-fill { height: 100%; width: 0; background: var(--rust); border-radius: 999px; }
  .home-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .home-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; }
  .home-card { border: 1px solid var(--line); border-radius: 16px; background: rgba(255,253,248,.75); padding: 16px 18px; }
  .home-card h2 { margin: 0 0 10px; font-family: ui-serif, Georgia, serif; font-size: 16px; }
  .home-card .muted { color: var(--muted); font-size: 12.5px; }
  .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .settings-card { min-width: 0; }
  .settings-card h2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .settings-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 12px; line-height: 1.6; }
  .settings-row:first-of-type { border-top: 0; }
  .settings-row b { color: var(--muted); font-weight: 500; }
  .settings-row code { font-family: var(--mono); font-size: 10px; overflow-wrap: anywhere; }
  .settings-goals { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; margin-top: 10px; }
  .settings-goals label { display: grid; gap: 3px; color: var(--muted); font-size: 10px; }
  .settings-goals input { width: 72px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--ink); padding: 6px 8px; font: inherit; font-size: 12px; }
  .settings-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .settings-file { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; font-size: 11px; color: var(--muted); }
  .settings-file input { max-width: 100%; font-size: 11px; }
  .trash-entry { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 12px; }
  .trash-entry:first-of-type { border-top: 0; }
  .trash-entry small { display: block; color: var(--muted); font-size: 10px; }
  .trash-entry .row-actions { display: flex; gap: 5px; flex: 0 0 auto; }
  @media (max-width: 760px) { .settings-grid { grid-template-columns: 1fr; } }
  .home-recent-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .home-recent-row:first-of-type { border-top: 0; }
  .home-recent-row a { color: var(--ink); text-decoration: none; font-weight: 600; }
  .home-recent-row a:hover { color: var(--accent); }
  .home-recent-row .mini-progress { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .home-review-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .home-review-line strong { font-family: ui-serif, Georgia, serif; font-size: 28px; }
  .home-review-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .home-outputs { margin-top: 14px; }
  .insights-card { margin-bottom: 16px; }
  .home-diagnosis { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 0 0 14px; padding: 12px 16px; border: 1px solid rgba(63,95,127,.28); border-radius: 14px; background: rgba(63,95,127,.06); }
  .home-diagnosis strong { display: block; font-size: 13px; }
  .home-diagnosis span { display: block; margin-top: 2px; color: var(--muted); font-size: 11.5px; }
  .insight-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .insight-head h2 { margin: 0; font-family: ui-serif, Georgia, serif; font-size: 19px; }
  .insight-head span { color: var(--muted); font-size: 11.5px; }
  .insight-copy { margin: 0 0 12px; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .insight-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 14px 0 4px; }
  .insight-stat { padding: 11px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper-2); }
  .insight-stat strong { display: block; font-family: ui-serif, Georgia, serif; font-size: 22px; line-height: 1.2; }
  .insight-stat span { display: block; margin-top: 3px; color: var(--muted); font-size: 10.5px; }
  .insight-block { margin-top: 16px; }
  .insight-block h3 { margin: 0 0 7px; font-size: 12.5px; color: var(--ink); }
  .insight-block p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .insight-actions { display: flex; justify-content: flex-end; margin-top: 14px; }
  .history-chart { display: flex; align-items: flex-end; gap: 5px; height: 118px; margin: 14px 0 4px; padding-top: 8px; }
  .history-col { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
  .history-bar { width: 100%; max-width: 18px; min-height: 3px; border-radius: 4px 4px 2px 2px; background: var(--accent); }
  .history-bar.good { background: #4d8f6f; }
  .history-bar.mid { background: #c49b4a; }
  .history-bar.low { background: #b05a4a; }
  .history-bar.is-empty { background: var(--line-strong); }
  .history-col small { overflow: hidden; color: var(--muted); font-family: var(--mono); font-size: 8px; text-overflow: clip; white-space: nowrap; }
  .history-sources { display: grid; gap: 2px; }
  .history-source { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 9px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 11.5px; }
  .history-source:first-child { border-top: 0; }
  .history-source span { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  .history-source b { color: var(--accent-strong); font-family: var(--mono); font-size: 10px; }
  .history-source small { color: var(--muted); font-family: var(--mono); font-size: 9px; }
  .history-chip { display: inline-flex; align-items: baseline; gap: 5px; margin: 2px 5px 0 0; padding: 2px 7px; border: 1px solid var(--line); border-radius: 999px; font-family: var(--mono); font-size: 9px; }
  .history-chip em { color: var(--muted); font-style: normal; }
  .insight-list { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12.5px; line-height: 1.8; }
  .insight-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .insight-chip { padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); font-size: 12px; }
  .insight-chip em { margin-left: 5px; color: var(--rust); font-style: normal; font-size: 11px; }
  .diagnosis-words { display: grid; grid-template-columns: repeat(auto-fit, minmax(142px, 1fr)); gap: 7px; margin-top: 12px; }
  .diagnosis-word { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .diagnosis-word b { font-family: ui-serif, Georgia, serif; font-size: 14px; }
  .diagnosis-word span { color: var(--muted); font-size: 10.5px; }
  .diagnosis-word.is-known { border-color: var(--accent); background: rgba(63,95,127,.07); }
  .diagnosis-word.is-known b { color: var(--accent); }
  .diagnosis-actions { display: flex; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
  .diagnosis-actions .muted { color: var(--muted); font-size: 11.5px; }
  .diagnosis-note { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11.5px; line-height: 1.7; }
  @media (max-width: 620px) {
    .insight-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  .passport-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24px; padding: 26px 28px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); box-shadow: var(--shadow); }
  .passport-block { margin-top: 18px; padding: 20px 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); box-shadow: var(--shadow); }
  .passport-block-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .passport-block h2 { margin: 0; font-family: ui-serif, Georgia, serif; font-size: 18px; }
  .passport-block-head span { color: var(--muted); font-size: 11.5px; }
  .achievement-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .achievement { display: flex; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper-2); opacity: .56; }
  .achievement.earned { opacity: 1; background: var(--card); border-color: rgba(63, 95, 127, .35); }
  .achievement-icon { font-size: 22px; line-height: 1.2; }
  .achievement-body { min-width: 0; flex: 1; }
  .achievement b { display: block; font-size: 12.5px; }
  .achievement small { display: block; color: var(--muted); font-size: 10.5px; line-height: 1.5; }
  .achievement-track { height: 4px; margin: 6px 0 3px; border-radius: 999px; background: rgba(28, 26, 22, .1); overflow: hidden; }
  .achievement-track span { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
  .activity-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 12px); gap: 3px; overflow-x: auto; padding-bottom: 4px; }
  .activity-cell { width: 12px; height: 12px; border-radius: 2px; background: var(--paper-2); }
  .activity-cell.level-1 { background: rgba(63, 95, 127, .25); }
  .activity-cell.level-2 { background: rgba(63, 95, 127, .5); }
  .activity-cell.level-3 { background: var(--accent); }
  html[data-theme="dark"] .achievement-track { background: rgba(233, 228, 217, .14); }
  html[data-theme="dark"] .activity-cell { background: rgba(233, 228, 217, .08); }
  html[data-theme="dark"] .activity-cell.level-1 { background: rgba(141, 177, 214, .28); }
  html[data-theme="dark"] .activity-cell.level-2 { background: rgba(141, 177, 214, .52); }
  html[data-theme="dark"] .side-import,
  html[data-theme="dark"] .btn.btn-primary,
  html[data-theme="dark"] .btn.primary { color: #0c100d !important; }
  html[data-theme="dark"] .brand-mark { background: var(--accent); color: #0c100d; }

  .passport-eyebrow { color: var(--rust); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; }
  .passport-head h1 { margin: 6px 0 4px; font-family: ui-serif, Georgia, serif; font-size: clamp(26px, 4vw, 36px); line-height: 1.2; letter-spacing: -.02em; }
  .passport-intro { margin: 0; color: var(--muted); font-size: 12.5px; max-width: 420px; }
  .passport-stats { display: grid; grid-template-columns: repeat(3, minmax(82px, 1fr)); gap: 12px 24px; align-content: center; flex: 1 1 260px; }
  .passport-stat { min-width: 0; }
  .passport-stat strong { display: block; font-family: ui-serif, Georgia, serif; font-size: 24px; line-height: 1.2; color: var(--ink); }
  .passport-stat span { color: var(--muted); font-size: 11.5px; }
  .passport-links { display: flex; justify-content: flex-end; margin: 0 0 10px; }
  .passport-weekly-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .passport-stamps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
  .passport-stamp { display: flex; flex-direction: column; gap: 7px; min-height: 178px; padding: 16px 17px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--shadow); transition: border-color .15s ease, transform .15s ease; }
  .passport-stamp:hover { border-color: var(--accent); transform: translateY(-1px); }
  .passport-stamp .stamp-date { color: var(--rust); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .passport-stamp .stamp-date.reading { color: var(--accent); }
  .passport-stamp .stamp-title { display: block; font-family: ui-serif, Georgia, serif; font-size: 16px; line-height: 1.35; }
  .passport-stamp .stamp-zh { color: var(--muted); font-size: 11.5px; }
  .passport-stamp .stamp-quote { flex: 1; margin: 2px 0 0; color: var(--muted); font-family: ui-serif, Georgia, serif; font-size: 12px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .passport-stamp .stamp-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10.5px; }
  .passport-stamp .stamp-share { color: var(--accent); }
  .passport-empty { grid-column: 1 / -1; padding: 34px 24px; border: 1px dashed var(--line); border-radius: 14px; color: var(--muted); font-size: 13px; text-align: center; }
  .lan-panel { position: fixed; top: 64px; right: 24px; z-index: 95; width: min(440px, calc(100vw - 32px)); padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); box-shadow: 0 18px 50px rgba(28,26,22,.18); }
  .lan-panel[hidden] { display: none; }
  .lan-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
  .lan-panel-head strong { font-family: ui-serif, Georgia, serif; font-size: 16px; }
  .lan-panel p { margin: 0 0 10px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  .lan-url { display: flex; align-items: center; gap: 8px; margin: 8px 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper-2); }
  .lan-url code { flex: 1; min-width: 0; font-family: var(--mono); font-size: 10.5px; word-break: break-all; }
  .lan-url .btn { flex: 0 0 auto; padding: 5px 9px; font-size: 11px; }
  .lan-qr-wrap { display: flex; align-items: center; gap: 14px; margin: 10px 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
  .lan-qr-wrap svg { flex: 0 0 auto; width: 142px; height: 142px; }
  .lan-qr-wrap strong { display: block; color: var(--ink); font-size: 13px; }
  .lan-qr-wrap span { display: block; margin-top: 5px; color: var(--muted); font-size: 11.5px; line-height: 1.6; }
  .lan-warning { color: var(--rust) !important; font-size: 11.5px !important; }
  .lan-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  @media (max-width: 620px) {
    .lan-panel { top: 56px; left: 12px; right: 12px; width: auto; }
    .lan-qr-wrap { gap: 10px; }
    .lan-qr-wrap svg { width: 112px; height: 112px; }
  }
  .nuance-modal { position: fixed; inset: 0; z-index: 105; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(28,26,22,.45); }
  .nuance-modal[hidden] { display: none; }
  .nuance-sheet { width: min(560px, 100%); max-height: 88vh; overflow: auto; border: 1px solid var(--line); border-radius: 18px; background: var(--card); box-shadow: 0 24px 70px rgba(28,26,22,.24); }
  .nuance-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 13px; }
  .nuance-bar button { border: 0; background: none; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
  .nuance-body { padding: 18px 20px 22px; }
  .nuance-scenario { margin: 0 0 14px; padding: 12px 14px; border-left: 2px solid var(--accent); border-radius: 0 10px 10px 0; background: var(--paper-2); font-size: 13px; line-height: 1.75; }
  .nuance-question { margin: 0 0 10px; color: var(--muted); font-size: 12px; }
  .nuance-question b { color: var(--ink); }
  .nuance-option { display: flex; gap: 10px; width: 100%; margin: 7px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); font: inherit; font-size: 13px; line-height: 1.6; text-align: left; cursor: pointer; }
  .nuance-option:hover { border-color: var(--accent); }
  .nuance-option b { flex: none; color: var(--muted); font-family: var(--mono); font-size: 11px; }
  .nuance-option.correct { border-color: #2f7d5f; background: rgba(47, 125, 95, .1); }
  .nuance-option.wrong { border-color: var(--rust); background: var(--rust-soft); }
  .nuance-option:disabled { cursor: default; opacity: .9; }
  .nuance-feedback { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper-2); font-size: 12.5px; line-height: 1.75; }
  .nuance-feedback strong { color: #2f7d5f; }
  .nuance-feedback.bad strong { color: var(--rust); }
  .nuance-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
  .nuance-combo { color: var(--muted); font-size: 11.5px; }
  .nuance-loading { padding: 18px 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
  html[data-theme="dark"] .nuance-option.correct { border-color: #57a37f; background: rgba(87, 163, 127, .14); }
  html[data-theme="dark"] .nuance-feedback strong { color: #57a37f; }
  .passport-modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 22px; background: rgba(28,26,22,.42); }
  .passport-modal[hidden] { display: none; }
  body.passport-modal-open { overflow: hidden; }
  .passport-sheet { width: min(480px, 100%); max-height: 94vh; overflow: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--card); box-shadow: 0 24px 70px rgba(28,26,22,.24); }
  .passport-sheet-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 13px; }
  .passport-sheet-bar button { border: 0; background: none; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
  .passport-canvas-wrap { padding: 16px; background: var(--paper-2); }
  .passport-canvas-wrap canvas { display: block; width: 100%; height: auto; border-radius: 3px; box-shadow: 0 10px 30px rgba(28,26,22,.16); }
  .passport-card-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px 18px; }
  .passport-card-actions span { color: var(--muted); font-size: 11px; }
  @media (max-width: 720px) {
    .passport-head { padding: 22px 20px; }
    .passport-stats { flex-basis: 100%; }
    .passport-stamps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .passport-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .passport-stamps { grid-template-columns: 1fr; }
    .passport-modal { padding: 0; align-items: stretch; }
    .passport-sheet { width: 100%; max-height: 100vh; border: 0; border-radius: 0; }
  }
  .output-entry { padding: 9px 0; border-top: 1px solid var(--line); }
  .output-entry:first-of-type { border-top: 0; }
  .output-meta { color: var(--muted); font-size: 11.5px; }
  .output-entry summary { cursor: pointer; color: var(--ink); font-size: 13px; margin-top: 3px; }
  .output-text { margin-top: 7px; padding: 10px 12px; border-radius: 9px; background: var(--accent-soft); color: var(--ink); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
  .output-feedback { margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .output-feedback p { margin: 5px 0; }
  .output-feedback p b { color: var(--ink); font-weight: 600; }
  .output-feedback blockquote { margin: 7px 0; padding-left: 10px; border-left: 1px solid var(--line-strong); color: var(--ink); font-family: ui-serif, Georgia, serif; }
  .output-feedback .link-button { margin-top: 2px; }
  .output-revision { margin-top: 10px; padding: 10px 0 0 12px; border-top: 1px dashed var(--line); border-left: 2px solid var(--line); }
  .output-revise { margin-top: 10px; }
  .output-revise summary { color: var(--muted); font-size: 11.5px; cursor: pointer; }
  .output-revise textarea { width: 100%; min-height: 92px; margin-top: 7px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); color: var(--ink); padding: 9px 11px; font: inherit; font-size: 13px; line-height: 1.65; resize: vertical; }
  .output-revise .btn { margin-top: 7px; }
  .today-output-input { width: 100%; min-height: 92px; margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); padding: 10px 12px; font: inherit; font-size: 13.5px; line-height: 1.65; resize: vertical; outline: none; }
  .today-output-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .today-output-text { margin-top: 8px; padding: 9px 11px; border-radius: 9px; background: var(--accent-soft); color: var(--ink); font-size: 12.5px; line-height: 1.65; white-space: pre-wrap; }
  @media (max-width: 700px) {
    .home-grid { grid-template-columns: 1fr; }
    .home-hero { padding: 20px 18px; }
  }
  .today-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .today-head strong { font-family: ui-serif, Georgia, serif; font-size: 15px; }
  .today-streak { color: var(--rust); font-size: 11.5px; }
  .today-steps { display: flex; flex-direction: column; gap: 7px; }
  .today-step { display: flex; align-items: flex-start; gap: 8px; }
  .today-step .tick { width: 18px; height: 18px; border: 1px solid var(--line); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: var(--muted); flex: none; margin-top: 1px; }
  .today-step.done .tick { background: var(--accent); border-color: var(--accent); color: #fff; }
  .today-step-body { flex: 1; min-width: 0; }
  .today-step-body b { color: var(--ink); }
  .today-step .btn { padding: 3px 9px; font-size: 11.5px; flex: none; }
  .today-output-prompt { margin-top: 4px; padding: 8px 10px; border-left: 2px solid var(--rust); background: rgba(245,230,218,.35); border-radius: 0 8px 8px 0; color: var(--ink); font-size: 12.5px; }
  .today-output-prompt details { margin-top: 5px; color: var(--muted); }
  .today-complete { margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--line); color: var(--accent); font-weight: 600; }
  .speak-btn { padding: 6px 11px; font-size: 12px; margin-left: 8px; vertical-align: middle; }
  .practice { margin-top: 12px; padding: 12px 14px; border: 1px dashed var(--line); border-radius: 12px; background: rgba(255,253,248,.6); }
  .practice-label { font-size: 11.5px; color: var(--muted); margin-bottom: 7px; }
  .practice-row { display: flex; gap: 7px; flex-wrap: wrap; }
  .practice-row input { flex: 1 1 200px; border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 9px 11px; font: inherit; font-size: 14px; outline: none; }
  .practice-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .practice-row .btn { padding: 8px 12px; font-size: 12.5px; }
  .practice-feedback { margin-top: 7px; font-size: 12px; min-height: 17px; }
  .practice-feedback.ok { color: var(--accent); }
  .practice-feedback.bad { color: var(--rust); }
  .practice-cloze { margin-top: 7px; color: var(--muted); font-size: 12.5px; font-family: ui-serif, Georgia, serif; }
  .card.revealed .practice { display: none; }
  .relations { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; font-size: 12.5px; color: var(--muted); }
  .relations b { color: var(--ink); font-weight: 600; margin-right: 4px; }
  .memory-hook { margin: 12px 0 0; padding: 9px 12px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); font-size: 13px; }
  .formation { margin-top: 10px; color: var(--muted); font-size: 12.5px; }
  .formation b { color: var(--ink); }
  .sentence-eyebrow { color: var(--rust); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
  .sentence-title { font-family: ui-serif, Georgia, serif; font-size: clamp(26px, 5vw, 38px); line-height: 1.2; }
  .sentence-prompt { font-size: 18px; }
  .sentence-answer-original { margin: 0 0 12px; padding: 12px 16px; border-left: 3px solid var(--accent); background: var(--accent-soft); font-family: ui-serif, Georgia, serif; font-size: 18px; line-height: 1.65; border-radius: 0 10px 10px 0; }
  .sentence-chunks { display: grid; gap: 6px; margin-top: 12px; }
  .sentence-chunks .chunk { font-size: 13px; color: var(--ink); }
  .sentence-chunks .chunk b { display: inline-block; min-width: 68px; margin-right: 8px; color: var(--muted); font-weight: 500; }
  .sentence-chunks .chunk i { display: block; margin-left: 76px; color: var(--muted); font-style: normal; font-size: 12px; }
  .sentence-pattern { margin-top: 10px; font-size: 13.5px; }
  .sentence-pattern b { color: var(--rust); margin-right: 6px; }
  .sentence-grammar { margin-top: 8px; font-size: 13px; color: var(--muted); line-height: 1.7; }
  .sentence-variants { margin: 10px 0 0; padding-left: 20px; color: var(--muted); font-size: 13px; }
  .sentence-feedback { margin-top: 8px; font-size: 12.5px; min-height: 18px; }
  .sentence-feedback.ok { color: var(--accent); }
  .sentence-feedback.bad { color: var(--rust); }
  .practice textarea { flex: 1 1 100%; min-height: 96px; border: 1px solid var(--line); background: var(--card); border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 15px; line-height: 1.6; resize: vertical; outline: none; }
  .practice textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .pack-filter { display: flex; align-items: center; gap: 10px; margin: -2px 0 12px; color: var(--muted); font-size: 12.5px; }
  .link-button { border: 0; background: transparent; color: var(--accent); font: inherit; font-size: 12.5px; padding: 0; cursor: pointer; text-decoration: underline; }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 30px 30px 24px;
    box-shadow: var(--shadow); min-height: 360px; display: flex; flex-direction: column;
  }
  .card-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .word { font-family: ui-serif, Georgia, serif; font-size: clamp(38px, 7vw, 62px); line-height: 1.05; letter-spacing: -.025em; }
  .word-prompt { margin-bottom: 6px; color: var(--muted); font-family: var(--mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
  .word-masked { display: inline-block; padding: 0 .18em .06em; border-bottom: 3px dotted var(--line-strong); color: var(--line-strong); font-family: var(--mono); font-size: .45em; letter-spacing: .18em; line-height: 1.4; }
  .word-full { display: none; }
  .card.revealed .word-full { display: inline; }
  .card.revealed .word-masked { display: none; }
  .ipa { font-size: 16px; color: var(--muted); margin-left: 8px; letter-spacing: 0; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .badge { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 3px 8px; border-radius: 999px; background: #f0ece2; color: var(--muted); }
  .badge-pos { background: var(--rust-soft); color: var(--rust); }
  .badge-cefr { background: var(--accent-soft); color: var(--accent); }
  .star { background: transparent; border: 1px solid var(--line); color: #c9c2b3; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 18px; }
  .star.active { color: var(--rust); border-color: var(--rust); background: var(--rust-soft); }
  .context { margin: 26px 0 18px; padding: 16px 18px; border-left: 3px solid var(--rust); background: rgba(245,230,218,.35); border-radius: 0 12px 12px 0; font-family: ui-serif, Georgia, serif; font-size: 19px; line-height: 1.6; }
  .translation { display: block; margin-top: 8px; color: var(--muted); font-family: inherit; font-size: 13.5px; }
  .context-full { display: none; }
  .card.revealed .context-full { display: inline; }
  .card.revealed .context-masked { display: none; }
  .answer { display: none; border-top: 1px dashed var(--line); padding-top: 18px; margin-top: 4px; }
  .card.revealed .answer { display: block; }
  .sense { font-size: 17px; margin: 0 0 10px; }
  .definition { margin: 0; font-size: 15px; }
  .definition-zh { margin: 8px 0 0; color: var(--muted); font-size: 14.5px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .chip { background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 4px 9px; font-size: 12px; }
  .examples { margin: 14px 0 0; padding-left: 18px; color: var(--muted); font-size: 13.5px; }
  .examples li { margin: 4px 0; }
  .source { margin-top: 14px; font-size: 11.5px; color: var(--muted); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 24px; }
  .btn { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 11px; padding: 10px 15px; font-size: 13.5px; cursor: pointer; }
  .btn:hover { border-color: var(--accent); color: var(--accent); }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn-primary:hover { background: #185b4b; color: #fff; }
  .ratings { display: none; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%; }
  .card.revealed .ratings { display: grid; }
  .rating { border: 1px solid var(--line); background: var(--card); border-radius: 11px; padding: 12px 8px; cursor: pointer; text-align: center; font-size: 13px; }
  .rating small { display: block; color: var(--muted); font-size: 10.5px; margin-top: 2px; }
  .rating[data-r="1"]:hover { border-color: #c0392b; color: #c0392b; }
  .rating[data-r="2"]:hover { border-color: var(--rust); color: var(--rust); }
  .rating[data-r="3"]:hover { border-color: var(--accent); color: var(--accent); }
  .rating[data-r="4"]:hover { border-color: #2d6cdf; color: #2d6cdf; }
  .hint { text-align: center; color: var(--muted); font-size: 12px; margin-top: 14px; }
  .empty { text-align: center; padding: 70px 20px; color: var(--muted); }
  .empty strong { display: block; font-family: ui-serif, Georgia, serif; font-size: 26px; color: var(--ink); margin-bottom: 8px; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
  .library-filters { display: flex; gap: 6px; margin-bottom: 10px; }
  .library-filters button { border: 1px solid var(--line); background: var(--card); color: var(--muted); border-radius: 999px; padding: 5px 11px; font: inherit; font-size: 12px; cursor: pointer; }
  .library-filters button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .badge.stale { background: var(--rust-soft); color: var(--rust); }
  .toolbar input { flex: 1; border: 1px solid var(--line); background: var(--card); border-radius: 11px; padding: 11px 14px; font-size: 14px; outline: none; }
  .toolbar input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(31,111,92,.12); }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; }
  .row .lemma { font-family: ui-serif, Georgia, serif; font-size: 18px; font-weight: 600; min-width: 130px; }
  .row .sense { font-size: 13px; color: var(--muted); flex: 1; margin: 0; }
  .row .due { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
  .row .rowstar { background: transparent; border: 0; color: #c9c2b3; font-size: 17px; cursor: pointer; }
  .row .rowstar.active { color: var(--rust); }
  .sentence-row {
    background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 14px 16px;
  }
  .sentence-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .sentence-main { min-width: 0; flex: 1; }
  .sentence-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-bottom: 5px; }
  .sentence-original { font-family: ui-serif, Georgia, serif; font-size: 16px; line-height: 1.7; color: var(--ink); }
  .sentence-zh { margin-top: 5px; color: var(--muted); font-size: 13px; line-height: 1.65; }
  .sentence-actions { display: flex; align-items: center; gap: 7px; flex: none; }
  .sentence-actions .link-button { font-size: 11.5px; }
  .sentence-detail { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); display: grid; gap: 7px; }
  .sentence-detail .rowstar { margin-left: auto; }
  .detail-line { color: var(--ink-70); font-size: 12.5px; line-height: 1.7; }
  .detail-line b { color: var(--ochre); margin-right: 5px; }
  .detail-chunk { font-size: 12.5px; color: var(--ink-70); line-height: 1.65; }
  .detail-chunk b { display: inline-block; min-width: 60px; color: var(--muted); font-weight: 500; margin-right: 6px; }
  .detail-chunk span { display: block; margin-left: 66px; color: var(--muted); font-size: 11.5px; }
  .sentence-detail .sentence-detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .source-link { color: var(--accent); text-decoration: none; white-space: nowrap; }
  .source-link:hover { text-decoration: underline; }
  .pack-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 15px 17px; box-shadow: var(--shadow); }
  .pack-row:hover { border-color: var(--line-strong); }
  .pack-row a { color: var(--accent); font-weight: 600; text-decoration: none; }
  .pack-row a:hover { text-decoration: underline; }
  .pack-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .pack-group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 4px 2px; }
  .pack-group-head strong { font-family: var(--display); font-size: 15px; font-weight: 700; letter-spacing: -.02em; }
  .pack-group-head span { color: var(--muted); font-size: 11.5px; }
  .pack-actions { display: flex; gap: 6px; align-items: center; }
  .pack-actions .btn { padding: 6px 10px; font-size: 12px; }
  .btn.danger { color: var(--rust); }
  .btn.danger[data-confirm="1"] { background: var(--rust-soft); border-color: var(--rust); }
  .header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .header-actions a.btn { display: inline-flex; align-items: center; text-decoration: none; }
  .header-import { padding: 7px 13px; font-size: 12.5px; }
  .lang-toggle { padding: 7px 10px; font-size: 11.5px; }
  .import-mode { color: var(--muted); font-size: 12.5px; margin-bottom: 6px; }
  .import-mode strong { color: var(--ink); }
  .selection-size { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; color: var(--muted); font-size: 12.5px; }
  .cselect { position: relative; display: inline-flex; min-width: 0; }
  .cselect-trigger { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 9px; padding: 7px 10px; font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
  .cselect-trigger:hover { border-color: var(--accent); }
  .cselect-trigger[aria-expanded="true"] { border-color: var(--accent); }
  .cselect-arrow { color: var(--muted); font-size: 10px; }
  .cselect-menu { position: absolute; left: 0; top: calc(100% + 4px); z-index: 80; min-width: 100%; max-height: 240px; overflow: auto; padding: 5px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); box-shadow: 0 10px 30px rgba(28,26,22,.16); }
  .cselect-option { display: block; width: 100%; border: 0; background: transparent; color: var(--ink); text-align: left; padding: 7px 9px; border-radius: 6px; font: inherit; font-size: 12.5px; white-space: nowrap; cursor: pointer; }
  .cselect-option:hover, .cselect-option.is-selected { background: var(--paper-2); color: var(--accent); }
  .cselect-size .cselect-menu { min-width: 220px; }
  .cselect-compact .cselect-trigger { padding: 6px 9px; font-size: 12px; }
  .selection-size small { color: var(--muted); font-size: 11.5px; }
  .llm-settings { margin: 8px 0 14px; padding: 10px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .llm-settings summary { cursor: pointer; color: var(--ink); font-size: 12.5px; font-weight: 600; }
  .llm-settings summary span { margin-left: 8px; color: var(--muted); font-weight: 400; font-size: 11.5px; }
  .llm-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin-top: 12px; }
  .llm-field { display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 11.5px; }
  .llm-field input { border: 1px solid var(--line); background: #fffdf8; color: var(--ink); border-radius: 2px; padding: 7px 9px; font: inherit; font-size: 12.5px; outline: none; }
  .llm-field input:focus { border-color: var(--accent); }
  .llm-field .cselect, .llm-field .cselect-trigger { width: 100%; }
  .llm-model-options { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
  .llm-model-option { border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 2px; padding: 2px 6px; font: inherit; font-size: 10.5px; cursor: pointer; }
  .llm-model-option:hover, .llm-model-option.is-active { border-color: var(--accent); color: var(--accent); }
  .llm-model-refresh { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
  .llm-model-refresh .btn { min-height: 28px; padding: 4px 8px; font-size: 10px; }
  .llm-settings-actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .llm-settings-actions .muted { color: var(--muted); font-size: 11.5px; }
  @media (max-width: 680px) { .llm-settings-grid { grid-template-columns: 1fr; } }
  .audio-toggle { margin-bottom: 14px; }
  .queue-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--accent-soft); color: var(--accent); font-size: 12.5px; }
  .review-budget { margin: 0 0 8px; padding: 8px 11px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--muted); font-family: var(--mono); font-size: 10px; }
  .review-budget strong { color: var(--ink); }
  .review-sentence-only { margin-left: auto; font-size: 12px; }
  .review-sentence-only.active { color: var(--rust); font-weight: 600; }
  .queue-banner .btn { padding: 6px 10px; font-size: 12px; }
  .import-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .import-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .import-card.wide { grid-column: 1 / -1; }
  .import-card h2, .recent h2 { margin: 0; font-family: ui-serif, Georgia, serif; font-size: 19px; }
  .import-card p { margin: 0; color: var(--muted); font-size: 12.5px; }
  .import-card input[type="text"], .import-card input[type="url"], .import-card textarea {
    width: 100%; border: 1px solid var(--line); background: #fffdf8; border-radius: 10px;
    padding: 10px 12px; font: inherit; font-size: 14px; color: var(--ink);
  }
  .import-card textarea { min-height: 150px; resize: vertical; line-height: 1.65; }
  .import-card input:focus, .import-card textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .import-card input[type="file"] { font-size: 12px; color: var(--muted); }
  .import-card input[type="file"]::file-selector-button { margin-right: 8px; border: 1px solid var(--line-strong); border-radius: 9px; background: var(--surface); color: var(--ink); padding: 6px 10px; font: inherit; font-size: 11px; cursor: pointer; }
  .import-card .btn { align-self: flex-start; }
  .import-option { display: flex; align-items: center; gap: 7px; margin: 1px 0; color: var(--ink); font-size: 12px; cursor: pointer; }
  .import-option span { color: var(--muted); font-size: 11px; }
  .bookmark-hint { margin: 12px 0 0; color: var(--muted); font-size: 12px; }
  .bookmark-hint a { color: var(--accent); }
  .import-result { margin-top: 18px; }
  .result-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .result-card.working { flex-direction: row; align-items: center; gap: 12px; }
  .result-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
  .result-title { font-family: ui-serif, Georgia, serif; font-size: 20px; font-weight: 600; }
  .result-meta { color: var(--muted); font-size: 12px; margin-top: 3px; }
  .result-preview { margin: 0; color: var(--muted); font-size: 13.5px; }
  .result-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .article-panel { gap: 12px; }
  .article-search {
    width: 100%; border: 1px solid var(--line); background: #fffdf8; border-radius: 10px;
    padding: 9px 12px; font: inherit; font-size: 13.5px; outline: none;
  }
  .article-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .article-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .article-tools .article-search { flex: 1 1 220px; width: auto; }
  .article-tools .cselect-trigger { padding: 8px 10px; font-size: 12.5px; }
  .article-tools .cselect-menu { min-width: 150px; }
  .article-toggle { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
  .article-section { margin-left: 7px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 1px 7px; }
  .article-row.hidden-article { opacity: .62; border-style: dashed; }
  .article-title .badge { margin-left: 6px; vertical-align: 1px; }
  .article-list { display: flex; flex-direction: column; gap: 6px; max-height: 460px; overflow: auto; padding-right: 4px; }
  .article-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px; background: #fffdf8; }
  .article-row.highlight { border-color: var(--accent); background: var(--accent-soft); }
  .article-main { min-width: 0; }
  .article-actions { display: flex; align-items: center; gap: 8px; }
  .article-queue { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .article-override { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 10.5px; padding: 0; cursor: pointer; text-decoration: underline; white-space: nowrap; }
  .article-override:hover { color: var(--accent); }
  .article-title { font-size: 13.5px; font-weight: 600; }
  .article-preview { color: var(--muted); font-size: 11.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .article-row .btn { padding: 7px 11px; font-size: 12px; white-space: nowrap; }
  .warnings { margin: 0; padding-left: 18px; color: var(--rust); font-size: 12.5px; }
  .warnings li { margin: 2px 0; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--accent-soft); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; flex: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .recent { margin-top: 26px; }
  .recent h2 { margin-bottom: 10px; }
  .resource-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; }
  .resource-main { min-width: 0; cursor: pointer; }
  .resource-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resource-row .due { margin-top: 2px; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
  .graph-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
  .graph-controls input[type="search"] { flex: 1 1 180px; border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 8px 11px; font: inherit; font-size: 13px; outline: none; }
  .graph-controls input[type="search"]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(63,95,127,.12); }
  .graph-controls select { border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 7px 9px; font: inherit; font-size: 12.5px; }
  .graph-zoom { display: flex; gap: 4px; }
  .graph-zoom .btn { padding: 6px 9px; font-size: 12px; }
  .graph-slider { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
  .graph-slider input { width: 90px; accent-color: var(--accent); }
  .graph-meta { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
  .graph-wrap { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
  #word-graph { display: block; width: 100%; height: auto; min-height: 420px; background: radial-gradient(circle at 50% 40%, rgba(63,95,127,.045), transparent 65%); }
  .gedge { stroke: rgba(63, 95, 127, .32); stroke-width: 1.2; }
  .gedge.negative { stroke: rgba(176, 58, 46, .42); stroke-dasharray: 4 4; }
  .gedge.root { stroke: rgba(168, 115, 47, .45); }
  .gedge.context { stroke: rgba(28, 26, 22, .18); stroke-dasharray: 2 4; }
  .gedge.active { stroke: var(--accent); stroke-width: 2.2; }
  .gedge.dim { opacity: .08; }
  .gnode { cursor: pointer; }
  .gnode circle { fill: var(--accent); stroke: var(--card); stroke-width: 2; }
  .gnode.known circle { fill: #557a6b; }
  .gnode.suspended circle { fill: #b8b0a0; }
  .gnode.ghost circle { fill: rgba(255,253,248,.9); stroke: var(--accent); stroke-width: 1.6; stroke-dasharray: 3 3; }
  .gnode.ghost text { fill: var(--muted); font-style: italic; }
  .gnode.due circle { stroke: var(--rust); stroke-width: 3; }
  .gnode.ghost.due circle { stroke: var(--accent); }
  .gnode text { fill: var(--ink); font-size: 10px; font-family: var(--sans); pointer-events: none; paint-order: stroke; stroke: var(--card); stroke-width: 3px; stroke-linejoin: round; opacity: 0; transition: opacity .15s ease; }
  .gnode.labeled text, .gnode:hover text, .gnode.selected text, .gnode.neighbor text, .gnode.hit text { opacity: 1; }
  .gnode.dim { opacity: .16; }
  .gnode.hit circle { stroke: var(--rust); stroke-width: 3; }
  .gnode.selected circle { stroke: var(--rust); stroke-width: 4; }
  .graph-detail { position: absolute; top: 12px; right: 12px; width: min(250px, 70%); max-height: calc(100% - 24px); overflow: auto; background: rgba(255,253,248,.96); border: 1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 6px 24px rgba(28,26,22,.12); font-size: 12.5px; }
  .graph-detail h3 { margin: 0 0 4px; font-family: ui-serif, Georgia, serif; font-size: 18px; }
  .graph-detail .detail-close { float: right; border: 0; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; }
  .graph-detail .detail-sense { color: var(--muted); margin-bottom: 8px; }
  .graph-detail .detail-zh { margin-bottom: 8px; }
  .graph-detail .detail-links { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .graph-detail .neighbor { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 2px 8px; font-size: 11.5px; cursor: pointer; color: var(--accent); }
  .graph-wrap { border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); }
  #word-graph { background: radial-gradient(circle at 50% 42%, var(--accent-soft), transparent 66%); }
  .gedge { stroke: color-mix(in srgb, var(--accent) 35%, transparent); }
  .gedge.negative { stroke: color-mix(in srgb, var(--danger) 45%, transparent); }
  .gedge.root { stroke: color-mix(in srgb, var(--warn) 45%, transparent); }
  .gedge.context { stroke: color-mix(in srgb, var(--ink) 18%, transparent); }
  .gnode circle { stroke: var(--surface); }
  .gnode.due circle { stroke: var(--lime); }
  .gnode.known circle { fill: var(--accent-strong); }
  .gnode.suspended circle { fill: var(--muted); }
  .gnode.ghost circle { fill: var(--surface); stroke: var(--accent); }
  .gnode.hit circle, .gnode.selected circle { stroke: var(--accent); }
  .gnode text { font-size: 9.5px; stroke-width: 2.5px; }
  .legend-dot.known { background: var(--accent-strong); }
  .legend-dot.learning { background: var(--accent); }
  .graph-legend { color: var(--muted); }
  .graph-legend { display: flex; flex-wrap: wrap; gap: 14px; color: var(--muted); font-size: 11.5px; margin-top: 10px; }
  .graph-legend span { display: flex; align-items: center; gap: 5px; }
  .legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; background: var(--accent); }
  .legend-dot.known { background: #557a6b; }
  .legend-dot.learning { background: var(--accent); }
  .legend-dot.ghost { background: transparent; border: 1px dashed var(--accent); }
  .legend-line { width: 18px; height: 0; border-top: 2px solid rgba(63,95,127,.5); display: inline-block; }
  .legend-line.negative { border-top-style: dashed; border-color: rgba(176,58,46,.6); }
  .legend-line.root { border-top-color: rgba(168,115,47,.7); }
  .graph-tree, .graph-clusters { display: flex; flex-direction: column; gap: 10px; }
  .family-card, .cluster-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 15px; }
  .family-head, .cluster-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .family-hub { font-family: var(--mono); font-size: 14px; color: var(--ochre, #a8732f); }
  .family-hub strong { font-size: 16px; }
  .family-head span, .cluster-head span { color: var(--muted); font-size: 11.5px; font-weight: normal; margin-left: 6px; }
  .family-words, .cluster-words { display: flex; flex-wrap: wrap; gap: 5px; }
  .graph-word { border: 1px solid var(--line); background: #fffdf8; border-radius: 999px; padding: 3px 9px; font-size: 12px; cursor: pointer; color: var(--ink); }
  .graph-word.known { color: #557a6b; border-color: rgba(85,122,107,.35); }
  .graph-word.ghost { border-style: dashed; color: var(--muted); }
  .graph-word.due { border-color: rgba(176,58,46,.35); }
  .family-review, .cluster-review { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 3px 9px; font: inherit; font-size: 11.5px; color: var(--accent); cursor: pointer; }
  .cluster-card button.cluster-focus { border: 0; background: transparent; color: var(--accent); font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: underline; }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--ink); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 13px; opacity: 0; transition: all .2s ease; pointer-events: none; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  @media (max-width: 620px) {
    .card { padding: 22px 18px 18px; }
    .ratings { grid-template-columns: repeat(2, 1fr); }
    .row .lemma { min-width: 90px; }
    .row .due { display: none; }
    .import-grid { grid-template-columns: 1fr; }
    .result-head { flex-direction: column; }
  }
  @media (max-width: 480px) {
    .gnode.labeled text { opacity: 0; }
    .gnode.selected text, .gnode.hit text, .gnode:hover text, .gnode.neighbor text { opacity: 1; }
  }

  /* ---------- 2026 App Shell redesign ---------- */
  :root {
    --bg: #f3f5f1;
    --bg-2: #e9ede7;
    --surface: #ffffff;
    --surface-2: #f7f8f5;
    --ink: #151916;
    --muted: #68716a;
    --line: #e1e6df;
    --line-strong: #c9d1c8;
    --accent: #1e6b4e;
    --accent-strong: #154f39;
    --accent-soft: #e4f2ea;
    --lime: #d9f36b;
    --lime-ink: #27320f;
    --danger: #b3473b;
    --warn: #9a641d;
    --paper: var(--bg);
    --paper-2: var(--bg-2);
    --card: var(--surface);
    --rust: var(--danger);
    --rust-soft: #f8e7e3;
    --shadow: 0 1px 2px rgba(20, 24, 21, .04), 0 14px 34px rgba(20, 24, 21, .05);
    --ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --display: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
    --read: 'Iowan Old Style', Charter, 'Songti SC', 'Noto Serif SC', serif;
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0c100d;
    --bg-2: #131813;
    --surface: #161c17;
    --surface-2: #1b221c;
    --ink: #edf2ec;
    --muted: #98a39a;
    --line: #29322b;
    --line-strong: #3b473e;
    --accent: #79d4a8;
    --accent-strong: #a1e5c3;
    --accent-soft: #173326;
    --lime: #c9ef5a;
    --lime-ink: #171d09;
    --danger: #e07a6e;
    --warn: #d3a35f;
    --paper: var(--bg);
    --paper-2: var(--bg-2);
    --card: var(--surface);
    --rust: var(--danger);
    --rust-soft: #3a201d;
    --shadow: 0 1px 2px rgba(0, 0, 0, .25), 0 18px 40px rgba(0, 0, 0, .22);
  }
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  body {
    margin: 0;
    overflow-x: hidden;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--ui);
    font-size: 14px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); }
  .app-shell { display: grid; grid-template-columns: 238px minmax(0, 1fr); min-height: 100vh; }
  .sidebar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: 100vh;
    padding: 22px 14px 16px;
    border-right: 1px solid var(--line);
    background: var(--surface);
  }
  .brand { display: flex; align-items: center; gap: 10px; margin: 0 8px 20px; color: var(--ink); text-decoration: none; }
  .brand-mark {
    display: grid; place-items: center; width: 37px; height: 37px; border-radius: 12px;
    background: var(--ink); color: var(--surface); font-family: var(--display);
    font-size: 12px; font-weight: 800; letter-spacing: -.04em;
  }
  .brand-copy { display: flex; flex-direction: column; font-family: var(--display); font-size: 15px; font-weight: 750; line-height: 1.15; letter-spacing: -.02em; }
  .brand-copy small { margin-top: 3px; color: var(--muted); font-family: var(--ui); font-size: 9px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; }
  .side-import {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: calc(100% - 12px); margin: 0 6px 18px; padding: 10px 12px;
    border: 0; border-radius: 11px; background: var(--accent); color: #fff;
    font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer;
    box-shadow: 0 7px 18px rgba(30, 107, 78, .18);
  }
  .side-import:hover { background: var(--accent-strong); }
  .side-label { margin: 14px 10px 6px; color: var(--muted); font-family: var(--mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
  .side-more { margin-top: 12px; }
  .side-more > summary { margin: 0 10px 4px; padding: 6px 0; color: var(--muted); font-family: var(--mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; cursor: pointer; list-style: none; }
  .side-more > summary::-webkit-details-marker { display: none; }
  .side-more > summary::after { content: ' +'; }
  .side-more[open] > summary::after { content: ' −'; }
  .side-more.active > summary { color: var(--accent-strong); }
  .side-more-list { margin-top: 2px; }
  .side-nav { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; border: 0; overflow: visible; }
  .side-nav button, .side-nav .nav-link {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 8px 10px; border: 0; border-radius: 9px; background: transparent;
    color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 550; text-align: left;
    text-decoration: none; cursor: pointer; border-bottom: 0;
  }
  .side-nav button:hover, .side-nav .nav-link:hover { background: var(--surface-2); color: var(--ink); }
  .side-nav button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 700; }
  .nav-icon { display: grid; place-items: center; width: 20px; height: 20px; color: currentColor; font-size: 14px; line-height: 1; }
  .nav-badge { margin-left: auto; color: var(--rust); font-family: var(--mono); font-size: 10px; }
  .sidebar-spacer { flex: 1; min-height: 18px; }
  .side-stats { padding: 10px 8px 6px; border-top: 1px solid var(--line); }
  .side-stats .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .side-stats .stat { display: flex; flex-direction: column; gap: 1px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); color: var(--muted); font-size: 9.5px; line-height: 1.25; white-space: nowrap; }
  .side-stats .stat:last-child { grid-column: 1 / -1; }
  .side-stats .stat strong { color: var(--ink); font-family: var(--mono); font-size: 12px; font-weight: 650; }
  .sidebar-footer { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--line); }
  .side-utility { flex: 1; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--muted); padding: 5px 6px; font: inherit; font-size: 10.5px; cursor: pointer; }
  .side-utility:hover { color: var(--ink); border-color: var(--line-strong); }
  .app-main { min-width: 0; }
  .topbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
    min-height: 78px; padding: 14px 34px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: blur(18px);
  }
  .topbar-title { min-width: 0; }
  .topbar-eyebrow { display: block; margin-bottom: 2px; color: var(--muted); font-family: var(--mono); font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; }
  .topbar-title h1 { margin: 0; font-family: var(--display); font-size: 24px; font-weight: 760; line-height: 1.15; letter-spacing: -.035em; }
  .topbar-actions { display: flex; align-items: center; gap: 7px; flex: none; }
  .topbar-lab { display: flex; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 9px; color: var(--muted); font-size: 11.5px; text-decoration: none; }
  .topbar-lab:hover { color: var(--ink); border-color: var(--line-strong); }
  .icon-btn { border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--muted); padding: 6px 9px; font: inherit; font-size: 11px; cursor: pointer; }
  .icon-btn:hover { color: var(--ink); border-color: var(--line-strong); }
  .content { width: min(1160px, calc(100% - 68px)); margin: 0 auto; padding: 26px 0 96px; }
  .view.active { display: block; }
  .view { animation: viewIn .18s ease; }
  @keyframes viewIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .mobile-nav { display: none; }
  .mobile-more { position: fixed; inset: 0; z-index: 120; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: rgba(12,16,13,.45); }
  .mobile-more[hidden] { display: none; }
  .mobile-more-panel { width: min(420px, 100%); display: grid; gap: 2px; padding: 14px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); box-shadow: 0 24px 70px rgba(0,0,0,.28); }
  .mobile-more-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 8px; }
  .mobile-more-panel a, .mobile-more-panel button { padding: 11px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--ink); font: inherit; font-size: 13px; text-align: left; text-decoration: none; cursor: pointer; }
  .mobile-more-panel a:hover, .mobile-more-panel button:hover { background: var(--surface-2); }

  /* Shared surfaces */
  .home-hero, .home-card, .today-plan, .home-diagnosis, .card, .forecast, .passport-head,
  .passport-block, .insights-card, .article-row, .import-card, .result-card, .practice,
  .resource-row, .pack-card, .store-warning, .review-settings, .library-filters, .toolbar {
    border-color: var(--line) !important;
    background: var(--surface) !important;
    box-shadow: var(--shadow);
  }
  .home-hero {
    position: relative;
    overflow: hidden;
    margin: 0 0 18px;
    padding: 34px 36px 30px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: linear-gradient(135deg, var(--surface), var(--surface-2)) !important;
  }
  .home-hero::after {
    content: ''; position: absolute; right: -80px; top: -110px; width: 300px; height: 300px;
    border-radius: 50%; background: radial-gradient(circle, var(--accent-soft), transparent 68%); pointer-events: none;
  }
  .home-eyebrow { margin-bottom: 12px; color: var(--accent); font-family: var(--mono); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; }
  .home-title { max-width: 20ch; margin: 0; font-family: var(--display); font-size: clamp(32px, 4.6vw, 58px); font-weight: 760; line-height: 1.04; letter-spacing: -.055em; }
  .home-title a { color: inherit !important; }
  .home-meta { margin-top: 12px; color: var(--muted); font-size: 12px; }
  .home-progress { display: flex; align-items: center; gap: 10px; max-width: 480px; margin-top: 22px; }
  .home-track { flex: 1; height: 6px; border-radius: 999px; background: var(--bg-2); overflow: hidden; }
  .home-fill { height: 100%; border-radius: inherit; background: var(--lime); }
  .home-progress span { color: var(--muted); font-family: var(--mono); font-size: 10px; }
  .home-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 22px; }
  .home-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 16px; margin-top: 16px; }
  .home-card { padding: 20px 22px; border: 1px solid var(--line); border-radius: 17px; }
  .home-card h2, .home-card h3 { margin: 0 0 12px; font-family: var(--display); font-size: 17px; font-weight: 700; letter-spacing: -.02em; }
  .home-card .list, .home-card .recent-list { margin: 0; }
  .home-card .row, .home-card .article-row { padding: 9px 0; border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent !important; box-shadow: none !important; }
  .home-card .row:first-child, .home-card .article-row:first-child { border-top: 0; }
  .today-plan { border-radius: 16px; padding: 15px 18px; }
  .home-diagnosis { border-radius: 16px; border-color: color-mix(in srgb, var(--accent) 25%, var(--line)) !important; background: var(--accent-soft) !important; box-shadow: none !important; }
  .home-diagnosis strong { font-size: 13px; }
  .home-outputs { margin-top: 16px; }
  .home-output-prompt { border-left: 3px solid var(--lime); border-radius: 0 10px 10px 0; background: var(--surface-2); }

  /* Buttons and fields */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 34px; padding: 7px 13px;
    border: 1px solid var(--line-strong); border-radius: 10px;
    background: var(--surface); color: var(--ink);
    font: inherit; font-size: 12px; font-weight: 600; line-height: 1.2; text-decoration: none; cursor: pointer;
    box-shadow: none;
  }
  .btn:hover { border-color: var(--ink); background: var(--surface); }
  .btn.btn-primary, .btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
  .btn.btn-primary:hover, .btn.primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
  .btn:disabled { opacity: .5; cursor: wait; }
  .btn.small, .topbar .btn { min-height: 30px; padding: 5px 10px; font-size: 11.5px; }
  .link-button { border: 0; background: none; color: var(--muted); font: inherit; font-size: 11px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .link-button:hover { color: var(--ink); }
  input, textarea, select {
    border: 1px solid var(--line-strong); border-radius: 10px;
    background: var(--surface); color: var(--ink);
    padding: 9px 11px; font: inherit; font-size: 12.5px; outline: none;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .field, label.field { color: var(--muted); font-size: 10.5px; letter-spacing: .04em; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--muted); padding: 3px 9px; font-size: 10.5px; }

  /* Review */
  .review-settings { margin-bottom: 14px; padding: 11px 14px; border: 1px solid var(--line); border-radius: 13px; box-shadow: none; }
  .progress { margin-bottom: 14px; color: var(--muted); font-size: 11.5px; }
  .forecast { border-radius: 14px; box-shadow: none; }
  #review-area .card { max-width: 760px; margin: 0 auto; padding: 30px 30px 24px; border-radius: 22px; }
  #review-area .card-top { align-items: flex-start; }
  #review-area .word { font-family: var(--display); font-size: clamp(34px, 5vw, 55px); font-weight: 770; letter-spacing: -.055em; }
  #review-area .word .ipa { font-family: var(--mono); font-size: 12px; letter-spacing: 0; }
  #review-area .context { border: 0; border-left: 3px solid var(--lime); border-radius: 0 14px 14px 0; background: var(--surface-2); font-family: var(--read); font-size: 20px; }
  #review-area .actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
  #review-area .actions .btn { min-height: 32px; }
  #review-area .actions .btn:not(.btn-primary) { border-color: var(--line); color: var(--muted); }
  #review-area .actions .btn:not(.btn-primary):hover { color: var(--ink); border-color: var(--line-strong); }
  .ratings { display: none; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 12px; }
  #review-area .card.revealed .ratings { display: grid; }
  .rating { border: 1px solid var(--line); border-radius: 11px; background: var(--surface-2); color: var(--ink); padding: 8px 6px; font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
  .rating:hover { border-color: var(--accent); background: var(--accent-soft); }
  .rating small { display: block; margin-top: 2px; color: var(--muted); font-family: var(--mono); font-size: 9px; font-weight: 500; }
  .hint { color: var(--muted); font-size: 10.5px; text-align: center; }
  .badge { border-color: var(--line); background: var(--surface-2); color: var(--muted); font-family: var(--mono); font-size: 9px; }
  .badge-pos { color: var(--accent); }
  .badge-cefr { color: var(--warn); }
  .star { color: var(--muted); }

  /* Library / packs */
  .library-filters, .toolbar { border: 1px solid var(--line); border-radius: 12px; box-shadow: none; }
  .library-filters button { border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: inherit; font-size: 11.5px; padding: 6px 10px; cursor: pointer; }
  .library-filters button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 650; }
  .row { border-top: 1px solid var(--line); }
  .row:hover { background: var(--surface-2); }
  .row .lemma { font-family: var(--display); font-weight: 680; }
  .pack-card, .resource-row { border-radius: 15px; }
  .pack-card:hover, .resource-row:hover { border-color: var(--line-strong) !important; transform: translateY(-1px); }
  .section-head { border-top: 0; }
  .section-head h2 { font-family: var(--display); font-size: 18px; letter-spacing: -.03em; }

  /* Passport / insights */
  .passport-head { border-radius: 22px; padding: 28px 30px; }
  .passport-eyebrow { color: var(--accent); font-family: var(--mono); font-size: 9px; letter-spacing: .16em; }
  .passport-head h1 { font-family: var(--display); font-size: 36px; letter-spacing: -.05em; }
  .passport-stats { gap: 10px; }
  .passport-stat { border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); padding: 10px 12px; }
  .passport-stat strong { font-family: var(--mono); font-size: 18px; }
  .passport-stamp { border: 1px solid var(--line); border-radius: 14px; background: var(--surface-2); }
  .passport-block { border-radius: 18px; }
  .achievement { border-radius: 11px; background: var(--surface-2); }
  .achievement.earned { border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); background: var(--surface); }
  .insights-card { border-radius: 18px; }
  .insight-stat { border-radius: 12px; background: var(--surface-2); }
  .insight-chip { border-radius: 999px; background: var(--surface-2); }

  /* Import */
  .article-mode .source-tabs,
  .article-mode #llm-settings,
  .article-mode .selection-size,
  .article-mode .audio-toggle,
  .article-mode .queue-banner,
  .article-mode .import-grid,
  .article-mode .bookmark-hint { display: none !important; }
  .import-mode { margin: 0 0 14px; padding: 11px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--muted); font-size: 11.5px; }
  .source-tabs { display: flex; gap: 4px; width: max-content; max-width: 100%; margin: 0 0 14px; padding: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow-x: auto; }
  .source-tabs button { border: 0; border-radius: 9px; background: transparent; color: var(--muted); padding: 7px 12px; font: inherit; font-size: 11.5px; white-space: nowrap; cursor: pointer; }
  .source-tabs button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 650; }
  .import-grid[data-mode="text"] [data-source-panel]:not([data-source-panel="text"]),
  .import-grid[data-mode="url"] [data-source-panel]:not([data-source-panel="url"]),
  .import-grid[data-mode="pdf"] [data-source-panel]:not([data-source-panel="pdf"]),
  .import-grid[data-mode="ebook"] [data-source-panel]:not([data-source-panel="ebook"]) { display: none; }
  .import-grid[data-mode="text"] [data-source-panel="text"],
  .import-grid[data-mode="url"] [data-source-panel="url"],
  .import-grid[data-mode="pdf"] [data-source-panel="pdf"],
  .import-grid[data-mode="ebook"] [data-source-panel="ebook"] { grid-column: 1 / -1; }
  .llm-settings { margin: 0 0 18px; padding: 0 18px 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
  .llm-settings summary { padding: 14px 0; font-size: 12.5px; font-weight: 650; cursor: pointer; }
  .import-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .import-card { padding: 20px; border: 1px solid var(--line); border-radius: 17px; box-shadow: var(--shadow); }
  .import-card.wide { grid-column: 1 / -1; }
  .import-card h2 { font-family: var(--display); font-size: 18px; letter-spacing: -.03em; }
  .import-card p { color: var(--muted); font-size: 11.5px; }
  .import-card input[type="text"], .import-card input[type="url"], .import-card textarea { border-radius: 10px; }
  .import-card .btn { min-height: 36px; }
  .selection-size { margin: 14px 0; padding: 0; }
  .selection-size small { color: var(--muted); font-size: 10.5px; }
  .article-toggle { color: var(--muted); font-size: 11.5px; }
  .result-card { border-radius: 16px; background: var(--surface) !important; box-shadow: var(--shadow); }
  .result-card.working { border-color: var(--line-strong); }
  .result-title { font-family: var(--display); font-size: 19px; font-weight: 720; letter-spacing: -.03em; }
  .result-meta { color: var(--muted); font-size: 11px; }
  .result-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
  .result-preview { color: var(--muted); font-size: 12px; line-height: 1.75; }
  .warnings { margin: 2px 0 0; padding-left: 18px; color: var(--warn); font-size: 11.5px; line-height: 1.7; }
  .article-panel { padding: 18px; }
  .article-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 4px 0 12px; padding: 9px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); }
  .article-tools .article-search { flex: 1 1 220px; min-width: 160px; }
  .article-list { display: flex; flex-direction: column; gap: 7px; }
  .article-row { border-radius: 11px; background: var(--surface) !important; box-shadow: none !important; }
  .article-row:hover { border-color: var(--line-strong); }
  .article-row.highlight { border-color: var(--accent); background: var(--accent-soft) !important; }
  .article-title { font-weight: 620; }
  .article-preview { white-space: normal; line-height: 1.6; }
  .article-override { border: 0; background: none; color: var(--muted); font: inherit; font-size: 10px; text-decoration: underline; cursor: pointer; }
  .article-override:hover { color: var(--ink); }
  #build-selected { border-color: var(--accent); color: var(--accent-strong); font-weight: 650; }
  .article-actions a.btn { border-color: var(--accent); background: var(--accent); color: #fff; }
  .article-actions a.btn:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
  .article-actions button.btn { color: var(--accent-strong); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 760px) {
    .result-head { flex-direction: column; }
    .article-row { align-items: flex-start; flex-direction: column; }
    .article-actions { width: 100%; flex-wrap: wrap; }
    .article-tools { padding: 8px; }
  }
  .recent { margin-top: 24px; }
  .recent h2 { font-family: var(--display); font-size: 18px; }

  /* Misc */
  .store-warning { margin: 0 0 14px; border-radius: 12px; }
  .toast { border-radius: 10px; background: var(--ink); color: var(--surface); font-size: 11.5px; }
  .cselect-trigger { border-radius: 9px; background: var(--surface); color: var(--ink); }
  .cselect-menu { border-radius: 10px; background: var(--surface); }
  .cselect-option:hover, .cselect-option.is-selected { background: var(--surface-2); color: var(--accent); }
  .graph-detail { border-radius: 14px; background: var(--surface); }
  .nuance-sheet, .passport-sheet { border-radius: 18px; background: var(--surface); }
  .nuance-scenario { background: var(--surface-2); border-left-color: var(--lime); }
  .nuance-option { border-radius: 10px; background: var(--surface); }
  .nuance-option.correct { border-color: var(--accent); background: var(--accent-soft); }

  .skip-link { position: fixed; left: 12px; top: -60px; z-index: 100; padding: 9px 13px; border-radius: 9px; background: var(--ink); color: var(--surface); font-size: 12px; text-decoration: none; }
  .skip-link:focus { top: 12px; }
  :focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
  }
  /* Vocabulary + study */
  .vocab-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 26px 28px; border: 1px solid var(--line); border-radius: 22px; background: linear-gradient(135deg, var(--surface), var(--surface-2)); box-shadow: var(--shadow); }
  .vocab-kicker { margin: 0 0 6px; color: var(--accent); font-family: var(--mono); font-size: 9px; letter-spacing: .15em; }
  .vocab-hero h2 { margin: 0; font-family: var(--display); font-size: clamp(30px, 4vw, 44px); font-weight: 760; letter-spacing: -.05em; }
  .vocab-hero p { margin: 8px 0 0; max-width: 60ch; color: var(--muted); font-size: 12px; }
  .vocab-hero-actions { display: flex; align-items: flex-end; gap: 8px; flex: none; }
  .vocab-quota { display: flex; flex-direction: column; gap: 3px; color: var(--muted); font-size: 9.5px; }
  .vocab-quota select { min-width: 92px; padding: 7px 9px; font-size: 11.5px; }
  .vocab-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .vocab-stat { padding: 11px 13px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
  .vocab-stat b { display: block; font-family: var(--mono); font-size: 19px; font-weight: 650; line-height: 1.1; }
  .vocab-stat span { color: var(--muted); font-size: 10px; }
  .vocab-bar { display: flex; flex-direction: column; align-items: stretch; gap: 8px; margin: 16px 0 10px; }
  .vocab-tabs { display: flex; gap: 3px; padding: 3px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); overflow-x: auto; }
  .vocab-tabs button { display: flex; align-items: center; gap: 5px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); padding: 7px 10px; font: inherit; font-size: 11px; white-space: nowrap; cursor: pointer; }
  .vocab-tabs button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 650; }
  .vocab-tabs button span { color: var(--muted); font-family: var(--mono); font-size: 9px; }
  .vocab-filters { display: flex; flex-wrap: nowrap; gap: 6px; justify-content: flex-start; }
  .vocab-filters input { min-width: 120px; flex: 1 1 180px; }
  .vocab-filters select { max-width: 170px; }
  .vocab-filters .cselect { min-width: 120px; }
  .vocab-filters .cselect-trigger { width: 100%; justify-content: space-between; }
  .vocab-quota .cselect { min-width: 92px; }
  .vocab-list { display: flex; flex-direction: column; gap: 7px; }
  .vocab-selectbar { display: flex; align-items: center; gap: 8px; margin: 10px 0 2px; }
  .vocab-selectbar .btn { min-height: 28px; padding: 4px 10px; font-size: 10.5px; }
  .vocab-check { display: inline-grid; place-items: center; flex: none; cursor: pointer; }
  .vocab-check input { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; }
  .vocab-row.is-selected, .sentence-row.is-selected { border-color: var(--accent); background: var(--accent-soft); }
  .vocab-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 15px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); cursor: pointer; transition: border-color .12s ease, transform .12s ease; }
  .vocab-row:hover { border-color: var(--line-strong); transform: translateY(-1px); }
  .vocab-main { min-width: 0; flex: 1; }
  .vocab-word { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
  .vocab-word b { font-family: var(--display); font-size: 16px; font-weight: 720; letter-spacing: -.02em; }
  .vocab-word .ipa { color: var(--muted); font-family: var(--mono); font-size: 10px; }
  .vocab-def { margin-top: 3px; color: var(--muted); font-size: 11.5px; line-height: 1.55; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .vocab-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 6px; }
  .vocab-pill { border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; color: var(--muted); font-family: var(--mono); font-size: 8.5px; }
  .vocab-pill.new { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
  .vocab-pill.leech { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, var(--line)); }
  .vocab-pill.missing { color: var(--muted); border-style: dashed; }
  .vocab-side { display: flex; align-items: center; gap: 8px; flex: none; }
  .vocab-side .due { color: var(--muted); font-family: var(--mono); font-size: 9.5px; }
  .vocab-empty { padding: 44px 20px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 14px; }
  .vocab-more { display: flex; justify-content: center; padding: 14px 0 0; }
  .vocab-quality { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 9px; padding: 9px 12px; border: 1px dashed var(--line-strong); border-radius: 10px; color: var(--muted); font-size: 10.5px; }
  .vocab-quality b { color: var(--ink); }
  .quality-overlay { position: fixed; inset: 0; z-index: 126; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(12,16,13,.5); }
  .quality-panel { width: min(560px,100%); border: 1px solid var(--line); border-radius: 20px; background: var(--surface); box-shadow: 0 30px 90px rgba(0,0,0,.28); }
  .quality-body { padding: 16px 20px 22px; }
  .quality-body p { margin: 0 0 10px; color: var(--muted); font-size: 11.5px; line-height: 1.7; }
  .quality-status { min-height: 20px; margin-bottom: 10px; color: var(--ink-70); font-size: 11px; }
  .quality-actions { display: flex; gap: 7px; flex-wrap: wrap; }
  .known-input { width: 100%; min-height: 140px; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); padding: 9px 11px; font: inherit; font-size: 12.5px; line-height: 1.65; resize: vertical; }
  .sentence-row { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); padding: 13px 15px; }
  .sentence-row + .sentence-row { margin-top: 7px; }

  .wordbooks-overlay { position: fixed; inset: 0; z-index: 125; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(12,16,13,.5); }
  .wordbooks-panel { width: min(900px, 100%); max-height: calc(100vh - 36px); overflow: auto; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); box-shadow: 0 30px 90px rgba(0,0,0,.28); }
  .wordbooks-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 22px 14px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(14px); }
  .wordbooks-kicker { color: var(--accent); font-family: var(--mono); font-size: 8.5px; letter-spacing: .14em; }
  .wordbooks-head h2 { margin: 3px 0 0; font-family: var(--display); font-size: 24px; font-weight: 760; letter-spacing: -.04em; }
  .wordbooks-head button { border: 0; background: none; color: var(--muted); font: inherit; font-size: 11px; cursor: pointer; }
  #wordbooks-body { padding: 18px 20px 24px; }
  .wordbook-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .wordbook-card { display: flex; flex-direction: column; gap: 8px; padding: 16px; border: 1px solid var(--line); border-radius: 15px; background: var(--surface-2); }
  .wordbook-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .wordbook-card h3 { margin: 0; font-family: var(--display); font-size: 19px; font-weight: 730; letter-spacing: -.03em; }
  .wordbook-short { color: var(--accent); font-family: var(--mono); font-size: 9px; letter-spacing: .08em; }
  .wordbook-card p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
  .wordbook-numbers { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); font-family: var(--mono); font-size: 9px; }
  .wordbook-numbers b { color: var(--ink); font-size: 11px; }
  .wordbook-progress { height: 5px; border-radius: 999px; background: var(--line); overflow: hidden; }
  .wordbook-progress span { display: block; height: 100%; background: var(--lime); border-radius: inherit; }
  .wordbook-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .wordbook-actions .btn { min-height: 29px; padding: 4px 9px; font-size: 10.5px; }
  .wordbook-source { margin-top: 3px; color: var(--muted); font-size: 8.5px; line-height: 1.5; }
  .wordbook-note { margin-top: 14px; padding: 10px 12px; border-left: 3px solid var(--lime); background: var(--surface-2); color: var(--muted); font-size: 10.5px; line-height: 1.7; }
  @media (max-width: 760px) {
    .wordbooks-panel { border-radius: 16px; }
    .wordbook-grid { grid-template-columns: 1fr; }
  }
  /* Word detail drawer */
  .vocab-drawer { position: fixed; inset: 0; z-index: 120; display: flex; justify-content: flex-end; background: rgba(12, 16, 13, .42); }
  .vocab-drawer-panel { width: min(560px, 100%); height: 100%; overflow: auto; background: var(--surface); border-left: 1px solid var(--line); box-shadow: -20px 0 60px rgba(20,24,21,.2); }
  .vocab-drawer-bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(14px); font-size: 11px; }
  .vocab-drawer-bar button, .study-close { border: 0; background: none; color: var(--muted); font: inherit; font-size: 11px; cursor: pointer; }
  #vocab-detail-body { padding: 22px 24px 40px; }
  .detail-lemma { margin: 0; font-family: var(--display); font-size: 42px; font-weight: 770; letter-spacing: -.055em; line-height: 1.05; }
  .detail-ipa { color: var(--muted); font-family: var(--mono); font-size: 12px; }
  .detail-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 18px; }
  .detail-edit-form { display: grid; gap: 8px; margin: 0 0 18px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); }
  .detail-edit-form[hidden] { display: none; }
  .detail-edit-form label { display: grid; gap: 3px; color: var(--muted); font-size: 10px; }
  .detail-edit-form input, .detail-edit-form textarea { width: 100%; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--ink); padding: 6px 8px; font: inherit; font-size: 12px; }
  .detail-edit-form textarea { min-height: 54px; resize: vertical; }
  .detail-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
  .detail-section h3 { margin: 0 0 8px; color: var(--muted); font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
  .detail-section p, .detail-section li { font-size: 12.5px; line-height: 1.75; }
  .detail-section ul { margin: 0; padding-left: 18px; }
  .context-card { margin: 8px 0; padding: 10px 12px; border-left: 3px solid var(--lime); background: var(--surface-2); border-radius: 0 9px 9px 0; font-family: var(--read); font-size: 14px; line-height: 1.7; }
  .context-card span { display: block; margin-top: 4px; color: var(--muted); font-family: var(--ui); font-size: 11px; }
  .detail-status { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

  /* Study session */
  .study-overlay { position: fixed; inset: 0; z-index: 130; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(12, 16, 13, .55); }
  .study-panel { width: min(760px, 100%); max-height: calc(100vh - 36px); overflow: auto; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); box-shadow: 0 30px 90px rgba(0,0,0,.28); }
  .study-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 22px 14px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(14px); }
  .study-kicker { color: var(--accent); font-family: var(--mono); font-size: 8.5px; letter-spacing: .14em; }
  .study-head h2 { margin: 3px 0 0; font-family: var(--display); font-size: 22px; font-weight: 750; letter-spacing: -.035em; }
  #study-body { padding: 20px 22px 26px; }
  .study-progress { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-family: var(--mono); font-size: 10px; }
  .study-track { height: 5px; margin: 9px 0 18px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
  .study-track span { display: block; height: 100%; background: var(--lime); border-radius: inherit; }
  .study-modes { display: flex; gap: 4px; margin-bottom: 14px; }
  .study-modes button { border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--muted); padding: 5px 10px; font: inherit; font-size: 10.5px; cursor: pointer; }
  .study-modes button.active { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }
  .study-card { padding: 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2); text-align: center; }
  .study-word { margin: 0; font-family: var(--display); font-size: clamp(36px, 7vw, 62px); font-weight: 770; letter-spacing: -.055em; line-height: 1.05; }
  .study-ipa { margin-top: 5px; color: var(--muted); font-family: var(--mono); font-size: 11px; }
  .study-hint { margin: 16px 0 0; color: var(--muted); font-size: 11px; }
  .study-answer { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); text-align: left; }
  .study-answer h3 { margin: 0 0 4px; font-family: var(--display); font-size: 20px; }
  .study-answer p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .study-answer .zh { margin-top: 6px; color: var(--ink); }
  .study-context { margin-top: 12px; padding: 10px 12px; border-left: 3px solid var(--lime); background: var(--surface); border-radius: 0 8px 8px 0; font-family: var(--read); font-size: 14px; line-height: 1.65; }
  .study-input { width: 100%; margin-top: 16px; font-size: 20px; text-align: center; letter-spacing: .02em; }
  .study-options { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 16px; }
  .study-option { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); padding: 10px 12px; font: inherit; font-size: 13px; cursor: pointer; }
  .study-option:hover { border-color: var(--accent); }
  .study-option.correct { border-color: var(--accent); background: var(--accent-soft); }
  .study-option.wrong { border-color: var(--danger); background: var(--rust-soft); }
  .study-feedback { margin-top: 12px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); font-size: 12px; }
  .study-feedback.good { border-color: var(--accent); color: var(--accent-strong); }
  .study-feedback.bad { border-color: var(--danger); color: var(--danger); }
  .study-actions { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 16px; }
  .study-answer-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .study-rich-section { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
  .study-rich-label { margin-bottom: 5px; color: var(--muted); font-family: var(--mono); font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; }
  .study-chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 4px; }
  .study-chip-label { min-width: 38px; color: var(--muted); font-size: 9.5px; }
  .study-chip { border: 1px solid var(--line); border-radius: 999px; background: var(--surface); padding: 2px 7px; color: var(--ink-70); font-size: 10px; }
  .study-chip b { margin-right: 3px; color: var(--accent-strong); font-family: var(--mono); font-weight: 600; }
  .study-example { margin: 3px 0; font-family: var(--read); font-size: 12.5px; line-height: 1.6; }
  .study-rich-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .study-rich-actions .btn { min-height: 28px; padding: 4px 9px; font-size: 10px; }
  .study-ratings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 14px; }
  .study-ratings button { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 9px 5px; font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
  .study-ratings button:hover { border-color: var(--accent); background: var(--accent-soft); }
  .study-ratings small { display: block; margin-top: 2px; color: var(--muted); font-family: var(--mono); font-size: 8.5px; font-weight: 400; }
  .study-done { text-align: center; padding: 24px 10px; }
  .study-done h2 { margin: 0 0 8px; font-family: var(--display); font-size: 30px; }
  .study-done p { color: var(--muted); }
  .study-done-stats { display: flex; justify-content: center; gap: 20px; margin: 18px 0; }
  .study-done-stats b { display: block; font-family: var(--mono); font-size: 22px; }
  .study-done-stats span { color: var(--muted); font-size: 10px; }
  @media (max-width: 760px) {
    .vocab-hero { flex-direction: column; align-items: stretch; padding: 20px; }
    .vocab-hero-actions { justify-content: space-between; }
    .vocab-stats { grid-template-columns: 1fr 1fr; }
    .vocab-bar { flex-direction: column; align-items: stretch; }
    .vocab-tabs { width: 100%; }
    .vocab-filters { justify-content: stretch; flex-wrap: wrap; }
    .vocab-filters input { flex: 1 1 100%; }
    .vocab-row { align-items: flex-start; }
    .vocab-side { flex-direction: column; align-items: flex-end; }
    .vocab-drawer-panel { width: 100%; }
    .study-panel { border-radius: 16px; }
    .study-options { grid-template-columns: 1fr; }
    .study-ratings { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 980px) {
    .app-shell { grid-template-columns: 205px minmax(0, 1fr); }
    .content { width: calc(100% - 40px); }
    .topbar { padding: 12px 20px; }
    .sidebar { padding-left: 10px; padding-right: 10px; }
  }
  @media (max-width: 760px) {
    .app-shell { display: block; }
    .sidebar { display: none; }
    .topbar { min-height: 66px; padding: 10px 16px; }
    .topbar-eyebrow { font-size: 8px; }
    .topbar-title h1 { font-size: 20px; }
    .topbar-lab { display: none; }
    .content { width: calc(100% - 28px); padding: 18px 0 92px; }
    .mobile-nav {
      position: fixed; left: 10px; right: auto; bottom: 10px; width: min(370px, calc(100vw - 20px)); z-index: 60;
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; max-width: calc(100% - 20px);
      padding: 6px; border: 1px solid var(--line); border-radius: 18px;
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      box-shadow: 0 14px 36px rgba(20, 24, 21, .16); backdrop-filter: blur(18px);
    }
    .mobile-nav button, .mobile-nav a { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; border: 0; border-radius: 12px; background: transparent; color: var(--muted); font: inherit; font-size: 8.5px; padding: 6px 2px; cursor: pointer; text-decoration: none; overflow: hidden; white-space: nowrap; }
    .mobile-nav button span, .mobile-nav a span { font-size: 14px; line-height: 1.1; }
    .mobile-nav button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 650; }
    .mobile-nav a:hover { color: var(--ink); }
    .home-hero { padding: 24px 20px; border-radius: 19px; }
    .home-title { font-size: 34px; }
    .home-grid { grid-template-columns: 1fr; }
    .home-card { padding: 16px; }
    #review-area .card { padding: 22px 18px 18px; border-radius: 18px; }
    #review-area .word { font-size: 42px; }
    .ratings { grid-template-columns: repeat(2, 1fr); }
    .import-grid { grid-template-columns: 1fr; }
    .passport-head { padding: 20px; }
    .passport-head h1 { font-size: 28px; }
    .passport-stats { grid-template-columns: repeat(2, 1fr); }
  }

</style>
</head>
<body>
<a class="skip-link" href="#main-content">跳到主要内容</a>
<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="CloseRead 首页">
      <span class="brand-mark">CR</span>
      <span class="brand-copy">CloseRead<small>learning studio</small></span>
    </a>
    <button class="side-import" type="button" data-go-tab="import">＋ 导入文章</button>
    <div class="side-label">学习</div>
    <nav class="side-nav" aria-label="学习">
      <button class="active" data-tab="read" type="button"><span class="nav-icon">◉</span><span>精读</span></button>
      <button data-tab="vocab" type="button"><span class="nav-icon">▦</span><span>背单词</span><span class="nav-badge" id="nav-due"></span></button>
    </nav>
    <details class="side-more" data-more>
      <summary>更多</summary>
      <nav class="side-nav side-more-list" aria-label="更多">
        <a class="nav-link" href="/lab"><span class="nav-icon">✦</span><span>练习</span></a>
        <button data-tab="graph" type="button"><span class="nav-icon">⌘</span><span>词网</span></button>
        <button data-tab="passport" type="button"><span class="nav-icon">◈</span><span>成长</span></button>
        <button data-tab="insights" type="button"><span class="nav-icon">▥</span><span>复盘</span></button>
      </nav>
    </details>
    <div class="sidebar-spacer"></div>
    <div class="side-stats" hidden><div class="stats" id="stats"></div></div>
    <div class="sidebar-footer">
      <button class="side-utility" id="lan-toggle" type="button" hidden>手机</button>
      <button class="side-utility" data-tab="settings" type="button">设置</button>
      <button class="side-utility" id="lang-toggle" type="button">EN</button>
    </div>
  </aside>

  <div class="app-main">
    <header class="topbar">
      <div class="topbar-title">
        <span class="topbar-eyebrow" id="page-eyebrow">LEARNING STUDIO</span>
        <h1 id="page-title">今日</h1>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换主题">自动</button>
        <button class="icon-btn" id="settings-open" type="button" aria-label="设置" title="设置">⚙</button>
        <button class="btn btn-primary header-import" type="button" data-go-tab="import">＋ 导入</button>
      </div>
    </header>
    <main class="content" id="main-content" tabindex="-1">
      <div class="store-warning" id="store-warning" hidden></div>
      <div class="phone-mode-banner" id="phone-mode-banner" hidden>手机模式：可阅读、复习和练习；导入、删除和设置请回到电脑。</div>

  <section class="view active" id="view-home">
    <div class="home-hero" id="home-hero"></div>
    <div class="home-diagnosis" id="home-diagnosis" hidden></div>
    <div class="today-plan" id="today-plan" hidden></div>
    <div class="home-grid">
      <div class="home-card" id="home-recent"></div>
      <div class="home-card" id="home-review"></div>
    </div>
    <div class="home-card home-outputs" id="home-outputs"></div>
  </section>

  <section class="view" id="view-review">
    <div class="review-settings">
      <span>目标记忆率</span>
      ${customSelectMarkup('review-retention', '0.90', [
        { value: '0.85', label: '85%' },
        { value: '0.90', label: '90%' },
        { value: '0.95', label: '95%' },
      ], 'cselect-compact')}
      <button class="btn" id="save-retention" type="button">保存</button>
      <span id="retention-state"></span>
      <span class="first-accuracy" id="first-accuracy"></span>
    </div>
    <div class="review-budget" id="review-budget"></div>
    <div class="progress"><span id="progress-label">加载中…</span><span id="queue-label"></span><button class="link-button" id="undo-review" type="button" hidden>撤销上一次</button><button class="link-button review-sentence-only" id="review-sentence-only" type="button">只复习句子卡</button></div>
    <div class="pack-filter" id="pack-filter" hidden>
      <span id="pack-filter-label"></span>
      <button class="link-button" id="clear-pack" type="button">清除筛选</button>
    </div>
    <div class="forecast" id="review-forecast" hidden></div>
    <div id="review-area"></div>
    <div class="hint">空格显示答案 · 显示后 1–4 评分 · S 收藏 · K 标记已掌握</div>
  </section>

  <section class="view" id="view-library">
    <div class="vocab-hero">
      <div>
        <p class="vocab-kicker">VOCABULARY</p>
        <h2>词库</h2>
        <p>管理要背的词，按新词、到期、易忘分组；选一个模式开始今天的背词。</p>
      </div>
      <div class="vocab-hero-actions">
        <div class="vocab-quota"><span>今日新词</span>
          ${customSelectMarkup('vocab-new-limit', '10', [
            { value: '5', label: '5 个' },
            { value: '10', label: '10 个' },
            { value: '15', label: '15 个' },
            { value: '20', label: '20 个' },
          ], 'cselect-compact')}
        </div>
        <button class="btn" id="vocab-books-open" type="button">词书库</button>
        <button class="btn" id="vocab-known-open" type="button">导入已认识</button>
        <button class="btn" id="vocab-graph" type="button">关系图</button>
        <button class="btn btn-primary" id="vocab-study" type="button">开始背词</button>
      </div>
    </div>
    <div class="vocab-stats" id="vocab-stats"></div>
    <div class="vocab-quality" id="vocab-quality" hidden>
      <span>有 <b id="vocab-missing">0</b> 个词没有例句，练习会跳过它们。</span>
      <button class="btn" id="vocab-quality-open" type="button">补例句</button>
    </div>
    <div class="vocab-selectbar">
      <button class="btn small" id="vocab-select-toggle" type="button">多选</button>
      <span class="small muted" id="vocab-select-status"></span>
      <button class="btn small btn-primary" id="vocab-select-review" type="button" hidden>复习选中</button>
      <button class="btn small" id="vocab-bulk-suspend" type="button" hidden>暂停</button>
      <button class="btn small" id="vocab-bulk-known" type="button" hidden>标记掌握</button>
      <button class="btn small" id="vocab-bulk-active" type="button" hidden>恢复学习</button>
      <button class="btn small" id="vocab-bulk-favorite" type="button" hidden>收藏</button>
      <button class="btn small" id="vocab-select-clear" type="button" hidden>清空</button>
    </div>
    <div class="vocab-bar">
      <div class="vocab-tabs" id="vocab-groups" role="tablist" aria-label="词库分组">
        <button class="active" data-vocab-group="all" type="button">全部 <span data-count="all">0</span></button>
        <button data-vocab-group="new" type="button">新词 <span data-count="new">0</span></button>
        <button data-vocab-group="due" type="button">到期 <span data-count="due">0</span></button>
        <button data-vocab-group="leech" type="button">易忘 <span data-count="leech">0</span></button>
        <button data-vocab-group="known" type="button">已掌握 <span data-count="known">0</span></button>
        <button data-vocab-group="backlog" type="button">待学 <span data-count="backlog">0</span></button>
        <button data-vocab-group="missing" type="button">无例句 <span data-count="missing">0</span></button>
      </div>
      <div class="vocab-filters">
        <input id="vocab-search" type="search" placeholder="搜索词、释义或语境…">
        ${customSelectMarkup('vocab-source', '', [{ value: '', label: '全部来源' }], 'cselect-compact')}
        ${customSelectMarkup('vocab-book', '', [{ value: '', label: '全部词书' }], 'cselect-compact')}
        ${customSelectMarkup('vocab-cefr', '', [{ value: '', label: '全部等级' }], 'cselect-compact')}
        ${customSelectMarkup('vocab-type', 'all', [
          { value: 'all', label: '全部卡片' },
          { value: 'word', label: '单词' },
          { value: 'sentence', label: '句子卡' },
        ], 'cselect-compact')}
        ${customSelectMarkup('vocab-sort', 'due', [
          { value: 'due', label: '按到期' },
          { value: 'recent', label: '最近添加' },
          { value: 'alpha', label: '字母' },
          { value: 'cefr', label: '按 CEFR' },
          { value: 'frequency', label: '按词频' },
          { value: 'lapses', label: '按易忘' },
        ], 'cselect-compact')}
      </div>
    </div>
    <div class="vocab-list" id="library-list"></div>
    <div class="vocab-more" id="vocab-more"></div>
  </section>

  <section class="view" id="view-packs">
    <div class="list" id="packs-list"></div>
  </section>

  <section class="view" id="view-passport">
    <div class="passport-links"><button class="btn" data-go-tab="insights" type="button">查看本周复盘</button><button class="btn" id="backup-download" type="button">下载完整备份</button></div>
    <div id="passport-head"></div>
    <div class="passport-block" id="passport-weekly"></div>
    <div class="passport-stamps" id="passport-stamps"></div>
    <div class="passport-block" id="passport-achievements"></div>
    <div class="passport-block" id="passport-activity"></div>
  </section>

  <section class="view" id="view-settings">
    <div class="settings-grid">
      <div class="home-card settings-card" id="settings-goals">加载中…</div>
      <div class="home-card settings-card" id="settings-app">加载中…</div>
      <div class="home-card settings-card" id="settings-data">加载中…</div>
      <div class="home-card settings-card" id="settings-llm">加载中…</div>
      <div class="home-card settings-card" id="settings-tts">加载中…</div>
      <div class="home-card settings-card" id="settings-backup">加载中…</div>
      <div class="home-card settings-card" id="settings-trash">加载中…</div>
      <div class="home-card settings-card" id="settings-usage">加载中…</div>
    </div>
  </section>

  <section class="view" id="view-insights">
    <div class="home-card insights-card" id="insight-weekly">加载中…</div>
    <div class="home-card insights-card" id="insight-history">加载中…</div>
    <div class="home-card insights-card" id="insight-diagnosis">加载中…</div>
  </section>

  <section class="view" id="view-graph">
    <div class="graph-controls">
      <input id="graph-search" type="search" placeholder="搜索词…">
      ${customSelectMarkup('graph-view-mode', 'network', [
        { value: 'network', label: '网络' },
        { value: 'tree', label: '词族树' },
        { value: 'clusters', label: '聚类' },
      ], 'cselect-compact')}
      ${customSelectMarkup('graph-labels', 'auto', [
        { value: 'auto', label: '标签：自动' },
        { value: 'all', label: '全部标签' },
        { value: 'off', label: '隐藏标签' },
      ], 'cselect-compact')}
      <label class="graph-slider">阈值 <input id="graph-threshold" autocomplete="off" type="range" min="0.5" max="5" step="0.5" value="1.5"><span id="graph-threshold-value">1.5</span></label>
      <label class="article-toggle"><input type="checkbox" id="graph-negative" autocomplete="off" checked> 负关联</label>
      <label class="article-toggle"><input type="checkbox" id="graph-roots" autocomplete="off" checked> 词根边</label>
      <label class="article-toggle"><input type="checkbox" id="graph-ghosts" autocomplete="off"> 未学词</label>
      <label class="article-toggle"><input type="checkbox" id="graph-context" autocomplete="off"> 上下文</label>
      <label class="article-toggle"><input type="checkbox" id="graph-hide-known" autocomplete="off"> 隐藏已掌握</label>
      <label class="article-toggle"><input type="checkbox" id="graph-hide-isolated" autocomplete="off" checked> 隐藏孤立词</label>
      <button class="btn" id="graph-reset" type="button">重新布局</button>
      <div class="graph-zoom">
        <button class="btn" id="graph-zoom-out" type="button">−</button>
        <button class="btn" id="graph-zoom-reset" type="button">1:1</button>
        <button class="btn" id="graph-zoom-in" type="button">+</button>
      </div>
    </div>
    <div class="graph-meta" id="graph-meta"></div>
    <div class="graph-wrap" id="graph-wrap">
      <svg id="word-graph" viewBox="0 0 960 620" role="img" aria-label="词汇关联图"></svg>
      <div class="graph-detail" id="graph-detail" hidden></div>
    </div>
    <div class="graph-tree" id="graph-tree" hidden></div>
    <div class="graph-clusters" id="graph-clusters" hidden></div>
    <div class="graph-legend">
      <span><i class="legend-dot known"></i>已掌握</span>
      <span><i class="legend-dot learning"></i>学习中</span>
      <span><i class="legend-dot ghost"></i>未学词</span>
      <span><i class="legend-line positive"></i>正关联</span>
      <span><i class="legend-line negative"></i>负关联</span>
      <span><i class="legend-line root"></i>词根</span>
    </div>
  </section>

  <section class="view" id="view-import">
    <div class="import-mode" id="import-mode">检查分析模式…</div>
    <div class="source-tabs" id="source-tabs" role="tablist" aria-label="导入来源">
      <button class="active" type="button" data-source="text" role="tab">粘贴文本</button>
      <button type="button" data-source="url" role="tab">网页链接</button>
      <button type="button" data-source="pdf" role="tab">PDF</button>
      <button type="button" data-source="ebook" role="tab">EPUB / MOBI</button>
    </div>
    <details class="llm-settings" id="llm-settings">
      <summary>模型设置 <span id="llm-settings-state">检测中…</span></summary>
      <div class="llm-settings-grid">
        <label class="llm-field">服务商
          ${customSelectMarkup(
            'llm-provider',
            'openai',
            LLM_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.label })),
            'cselect-llm',
          )}
        </label>
        <label class="llm-field">模型
          <input id="llm-model" type="text" autocomplete="off" spellcheck="false" placeholder="gpt-4o-mini">
          <div class="llm-model-options" id="llm-model-options"></div>
          <div class="llm-model-refresh"><button class="btn" id="llm-refresh" type="button">刷新可用模型</button><span class="small muted" id="llm-refresh-status"></span></div>
        </label>
        <label class="llm-field">API Key
          <input id="llm-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-...">
        </label>
        <label class="llm-field">Base URL
          <input id="llm-base-url" type="text" autocomplete="off" spellcheck="false" placeholder="https://api.openai.com/v1">
        </label>
      </div>
      <div class="llm-settings-actions">
        <button class="btn btn-primary" id="llm-save" type="button">保存模型设置</button>
        <span class="muted" id="llm-settings-message">Key 只保存在本机 data/llm.json，不会上传。</span>
      </div>
    </details>
    <label class="selection-size">
      写作风格
      ${customSelectMarkup('build-style', '', [{ value: '', label: '默认风格' }], 'cselect-size')}
      <small>使用 styles/ 下的风格 profile；留空时用默认 unified 风格。</small>
    </label>
    <label class="selection-size">
      选词量
      ${customSelectMarkup(
        'selection-size',
        'auto',
        [
          { value: 'auto', label: '自动（按精读节奏）' },
          ...Array.from({ length: 20 }, (_, index) => {
            const count = (index + 1) * 5
            return { value: String(count), label: `${count} 个` }
          }),
        ],
        'cselect-size',
      )}
      <small>默认按文章长度建议 8–16 项（约 20–25 分钟），也可以按 5 个一档手动指定。</small>
    </label>
    <label class="article-toggle audio-toggle"><input type="checkbox" id="build-audio"> 生成音频（macOS）</label>
    <label class="article-toggle audio-toggle"><input type="checkbox" id="only-new"> 只选生词（已在词库的词不进入本包）</label>
    <div class="queue-banner" id="queue-banner" hidden>
      <span id="queue-banner-text"></span>
      <button class="btn" id="resume-queue" type="button">继续队列</button>
      <button class="btn" id="clear-queue" type="button">清空</button>
    </div>
    <div class="import-grid" id="import-grid" data-mode="text">
      <form class="import-card wide" id="import-text-form" data-source-panel="text">
        <h2>粘贴文本</h2>
        <p>从网页、Word 或笔记里复制英文正文，粘贴到这里。标题留空时会从首行或 Markdown 标题推断。</p>
        <input id="import-text-title" type="text" placeholder="标题（可选）">
        <textarea id="import-text-body" placeholder="Paste the English article here…"></textarea>
        <label class="import-option"><input type="checkbox" id="import-text-ai-clean" checked> AI 清理正文 <span>去导航、订阅、相关推荐；需要模型</span></label>
        <button class="btn btn-primary" type="submit">导入文本</button>
      </form>
      <form class="import-card wide" id="import-url-form" data-source-panel="url">
        <h2>网页链接</h2>
        <p>支持普通文章页、RSS/Atom 订阅链接和直链 PDF；订阅会导入最新一篇。付费墙、登录页和机器人验证页无法抓取。</p>
        <input id="import-url" type="text" inputmode="url" placeholder="https://example.com/article">
        <input id="import-url-title" type="text" placeholder="标题（可选）">
        <label class="import-option"><input type="checkbox" id="import-url-ai-clean" checked> AI 清理正文 <span>去导航、订阅、相关推荐；需要模型</span></label>
        <button class="btn btn-primary" type="submit">抓取并导入</button>
      </form>
      <form class="import-card" id="import-pdf-form" data-source-panel="pdf">
        <h2>PDF 文件</h2>
        <p>需要有文字层；扫描件暂不支持，可以改用粘贴文本。</p>
        <input id="import-pdf-title" type="text" placeholder="标题（可选）">
        <input id="import-pdf" type="file" accept="application/pdf,.pdf">
        <button class="btn btn-primary" type="submit">上传并导入</button>
      </form>
      <form class="import-card" id="import-ebook-form" data-source-panel="ebook">
        <h2>EPUB / MOBI / DOCX</h2>
        <p>支持 EPUB、MOBI、AZW、AZW3 和 DOCX；DRM 加密文件无法解析。</p>
        <input id="import-ebook-title" type="text" placeholder="标题（可选）">
        <input id="import-ebook" type="file" accept=".epub,.mobi,.azw,.azw3,.docx,application/epub+zip,application/x-mobipocket-ebook,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
        <button class="btn btn-primary" type="submit">上传并导入</button>
      </form>
    </div>
    <p class="bookmark-hint">从浏览器书签导入当前网页：<a href="/bookmarklet" target="_blank">安装书签</a></p>
    <div class="import-result" id="import-result"></div>
    <div class="recent">
      <h2>最近导入</h2>
      <div class="list" id="recent-imports"></div>
    </div>
  </section>
    </main>
  </div>
  <nav class="mobile-nav" aria-label="移动导航">
    <button class="active" data-tab="read" type="button"><span>◉</span>精读</button>
    <button data-tab="vocab" type="button"><span>▦</span>背单词</button>
    <button data-mobile-more type="button"><span>⋯</span>更多</button>
  </nav>
  <div class="mobile-more" id="mobile-more" hidden>
    <div class="mobile-more-panel" role="dialog" aria-modal="true" aria-label="更多">
      <div class="mobile-more-head"><strong>更多</strong><button class="link-button" data-mobile-more-close type="button">关闭</button></div>
      <a href="/lab">练习 / 实验室</a>
      <button data-tab="graph" type="button">词网</button>
      <button data-tab="passport" type="button">成长</button>
      <button data-tab="insights" type="button">复盘</button>
      <button data-tab="settings" type="button">设置</button>
    </div>
  </div>
</div>
<div class="lan-panel" id="lan-panel" hidden>
  <div class="lan-panel-head"><strong>手机访问</strong><button class="link-button" id="lan-close" type="button">关闭</button></div>
  <div id="lan-body"></div>
</div>
<div class="quality-overlay" id="quality-modal" hidden>
  <div class="quality-panel" role="dialog" aria-modal="true" aria-label="批量补例句">
    <header class="wordbooks-head"><div><span class="wordbooks-kicker">DATA QUALITY</span><h2>补全例句</h2></div><button id="quality-close" type="button">关闭</button></header>
    <div class="quality-body">
      <p>没有例句的词不会进练习。每次最多补 5 个，每个词会调用一次模型；补完会自动刷新词库。</p>
      <div class="quality-status" id="quality-status"></div>
      <div class="quality-actions">
        <button class="btn btn-primary" id="quality-run" type="button">补全 5 个</button>
        <button class="btn" id="quality-run-ten" type="button">补全 10 个</button>
      </div>
    </div>
  </div>
</div>
<div class="quality-overlay" id="known-modal" hidden>
  <div class="quality-panel" role="dialog" aria-modal="true" aria-label="导入已认识">
    <header class="wordbooks-head"><div><span class="wordbooks-kicker">KNOWN WORDS</span><h2>导入已认识</h2></div><button id="known-close" type="button">关闭</button></header>
    <div class="quality-body">
      <p>粘贴你已经认识的单词，每行一个；也可以直接导入 CSV（取第一列）。只会把词库里已有的词标记为“已掌握”，不会新增词卡。</p>
      <textarea class="known-input" id="known-text" placeholder="attention&#10;friction&#10;deliberate"></textarea>
      <div class="quality-actions" style="margin-bottom:10px"><input id="known-file" type="file" accept=".txt,.csv,text/plain,text/csv"></div>
      <div class="quality-status" id="known-status"></div>
      <div class="quality-actions"><button class="btn btn-primary" id="known-run" type="button">标记为已认识</button></div>
    </div>
  </div>
</div>
<div class="wordbooks-overlay" id="wordbooks-modal" hidden>
  <div class="wordbooks-panel" role="dialog" aria-modal="true" aria-label="词书库">
    <header class="wordbooks-head"><div><span class="wordbooks-kicker">WORD BOOKS</span><h2>词书库</h2></div><button id="wordbooks-close" type="button">关闭</button></header>
    <div id="wordbooks-body"></div>
  </div>
</div>
<div class="vocab-drawer" id="vocab-detail" hidden>
  <div class="vocab-drawer-panel" role="dialog" aria-modal="true" aria-label="词卡详情">
    <div class="vocab-drawer-bar"><span>词卡详情</span><button id="vocab-detail-close" type="button">关闭</button></div>
    <div id="vocab-detail-body"></div>
  </div>
</div>
<div class="study-overlay" id="study-session" hidden>
  <div class="study-panel" role="dialog" aria-modal="true" aria-label="今日背词">
    <header class="study-head">
      <div><span class="study-kicker" id="study-step">TODAY'S WORDS</span><h2 id="study-title">今日背词</h2></div>
      <button class="study-close" id="study-close" type="button">关闭</button>
    </header>
    <div id="study-body"></div>
  </div>
</div>
<div class="nuance-modal" id="nuance-modal" hidden>
  <div class="nuance-sheet" role="dialog" aria-modal="true" aria-label="语境侦探">
    <div class="nuance-bar"><span>🕵️ 语境侦探 <small id="nuance-combo-bar"></small></span><button id="nuance-close" type="button">关闭</button></div>
    <div class="nuance-body" id="nuance-body"></div>
  </div>
</div>
<div class="passport-modal" id="passport-modal" hidden>
  <div class="passport-sheet" role="dialog" aria-modal="true" aria-label="阅读分享卡">
    <div class="passport-sheet-bar"><span>阅读分享卡</span><button id="passport-card-close" type="button">关闭</button></div>
    <div class="passport-canvas-wrap" id="passport-canvas-wrap"></div>
    <div class="passport-card-actions">
      <button class="btn btn-primary" id="passport-download" type="button">下载 PNG</button>
      <span>3:4 · 1080 × 1440</span>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var state = {
    queue: [], current: null, revealed: false, tab: 'home', stats: {}, typeFilter: null, canUndo: false,
    today: null, passport: null, shareStamp: null,
    resources: [], building: null, currentJobId: null, buildFromQueue: false,
    buildQueue: [], selectedArticles: {}, queueStats: null, savedQueue: [],
    articleResource: null, articles: [], articlePacks: [], articleHidden: [],
    graph: null, graphSelected: null, graphQuery: '', graphFocus: null,
    graphPositions: [], graphNodes: [], graphEdges: [],
    graphZoom: 1, graphPanX: 0, graphPanY: 0, graphHop: 1, graphPathStart: null, graphPath: [],
    reviewScope: 'all', reviewBook: '', reviewNewLimit: 10, packFilter: null, packTitle: '', packDue: 0,
    wordFilter: null, wordFilterLabel: '', wordFilterDue: 0,
    libraryFilter: 'all', lan: null, nuanceCombo: 0,
    vocabGroup: 'all', vocabType: 'all', vocabSource: '', vocabCefr: '', vocabBook: '', vocabQuery: '', vocabSort: 'due', vocabCounts: {}, vocabSources: [], vocabCefrs: [], wordbooks: [],
    vocabItems: [], vocabHasMore: false, vocabTotal: 0,
    vocabSelecting: false, vocabSelected: {},
    study: null, vocabDetail: null,
    importResource: null, importArticle: null, importArticlesView: false
  };
  var LLM_PRESETS = ${JSON.stringify(LLM_PROVIDERS.map((provider) => ({ id: provider.id, label: provider.label, baseUrl: provider.baseUrl, model: provider.model, models: provider.models, api: provider.api })))};
  var els = {
    stats: document.getElementById('stats'),
    progress: document.getElementById('progress-label'),
    queueLabel: document.getElementById('queue-label'),
    undoReview: document.getElementById('undo-review'),
    lanToggle: document.getElementById('lan-toggle'),
    lanPanel: document.getElementById('lan-panel'),
    lanBody: document.getElementById('lan-body'),
    todayPlan: document.getElementById('today-plan'),
    homeHero: document.getElementById('home-hero'),
    homeRecent: document.getElementById('home-recent'),
    homeReview: document.getElementById('home-review'),
    homeOutputs: document.getElementById('home-outputs'),
    reviewArea: document.getElementById('review-area'),
    libraryList: document.getElementById('library-list'),
    packsList: document.getElementById('packs-list'),
    search: document.getElementById('vocab-search'),
    reviewRetention: document.getElementById('review-retention'),
    saveRetention: document.getElementById('save-retention'),
    retentionState: document.getElementById('retention-state'),
    firstAccuracy: document.getElementById('first-accuracy'),
    toast: document.getElementById('toast'),
    packFilter: document.getElementById('pack-filter'),
    packFilterLabel: document.getElementById('pack-filter-label'),
    clearPack: document.getElementById('clear-pack'),
    importMode: document.getElementById('import-mode'),
    llmSettings: document.getElementById('llm-settings'),
    llmProvider: document.getElementById('llm-provider'),
    llmModel: document.getElementById('llm-model'),
    llmModelOptions: document.getElementById('llm-model-options'),
    llmRefresh: document.getElementById('llm-refresh'),
    llmRefreshStatus: document.getElementById('llm-refresh-status'),
    llmApiKey: document.getElementById('llm-api-key'),
    llmBaseUrl: document.getElementById('llm-base-url'),
    llmSave: document.getElementById('llm-save'),
    llmState: document.getElementById('llm-settings-state'),
    llmMessage: document.getElementById('llm-settings-message'),
    selectionSize: document.getElementById('selection-size'),
    buildStyle: document.getElementById('build-style'),
    buildAudio: document.getElementById('build-audio'),
    onlyNew: document.getElementById('only-new'),
    queueBanner: document.getElementById('queue-banner'),
    queueBannerText: document.getElementById('queue-banner-text'),
    resumeQueue: document.getElementById('resume-queue'),
    clearQueue: document.getElementById('clear-queue'),
    importResult: document.getElementById('import-result'),
    recentImports: document.getElementById('recent-imports'),
    textForm: document.getElementById('import-text-form'),
    textTitle: document.getElementById('import-text-title'),
    textBody: document.getElementById('import-text-body'),
    urlForm: document.getElementById('import-url-form'),
    urlInput: document.getElementById('import-url'),
    urlTitle: document.getElementById('import-url-title'),
    pdfForm: document.getElementById('import-pdf-form'),
    pdfTitle: document.getElementById('import-pdf-title'),
    pdfInput: document.getElementById('import-pdf'),
    ebookForm: document.getElementById('import-ebook-form'),
    ebookTitle: document.getElementById('import-ebook-title'),
    ebookInput: document.getElementById('import-ebook'),
    graph: document.getElementById('word-graph'),
    graphWrap: document.getElementById('graph-wrap'),
    graphTree: document.getElementById('graph-tree'),
    graphClusters: document.getElementById('graph-clusters'),
    graphMeta: document.getElementById('graph-meta'),
    graphDetail: document.getElementById('graph-detail'),
    graphSearch: document.getElementById('graph-search'),
    graphViewMode: document.getElementById('graph-view-mode'),
    graphLabels: document.getElementById('graph-labels'),
    graphThreshold: document.getElementById('graph-threshold'),
    graphThresholdValue: document.getElementById('graph-threshold-value'),
    graphNegative: document.getElementById('graph-negative'),
    graphRoots: document.getElementById('graph-roots'),
    graphGhosts: document.getElementById('graph-ghosts'),
    graphContext: document.getElementById('graph-context'),
    graphHideKnown: document.getElementById('graph-hide-known'),
    graphHideIsolated: document.getElementById('graph-hide-isolated'),
    graphReset: document.getElementById('graph-reset'),
    graphZoomIn: document.getElementById('graph-zoom-in'),
    graphZoomOut: document.getElementById('graph-zoom-out'),
    graphZoomReset: document.getElementById('graph-zoom-reset')
  };

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = label || '处理中…';
    } else {
      button.disabled = false;
      if (button.dataset.label) button.textContent = button.dataset.label;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function customSelectHtml(id, value, options, className) {
    var selected = options.find(function (option) { return option.value === value; }) || options[0];
    return '<div class="cselect ' + (className || '') + '" data-cselect>' +
      '<input type="hidden" id="' + escapeHtml(id) + '" value="' + escapeHtml(selected ? selected.value : '') + '">' +
      '<button class="cselect-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="cselect-label">' + escapeHtml(selected ? selected.label : '') + '</span><span class="cselect-arrow">⌄</span>' +
      '</button>' +
      '<div class="cselect-menu" role="listbox" hidden>' +
        options.map(function (option) {
          return '<button type="button" role="option" class="cselect-option' +
            (selected && option.value === selected.value ? ' is-selected' : '') +
            '" data-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function syncCustomSelect(input) {
    if (!input || !input.closest) return;
    var wrap = input.closest('.cselect');
    if (wrap && wrap._sync) wrap._sync();
  }

  function customSelectHasValue(input, value) {
    if (!input || !input.closest) return false;
    var wrap = input.closest('.cselect');
    return Boolean(wrap && wrap.querySelector('.cselect-option[data-value="' + String(value).replace(/"/g, '\\"') + '"]'));
  }

  function initCustomSelects(root) {
    (root || document).querySelectorAll('.cselect[data-cselect]').forEach(function (wrap) {
      if (wrap.dataset.ready === '1') return;
      wrap.dataset.ready = '1';
      var input = wrap.querySelector('input[type="hidden"]');
      var trigger = wrap.querySelector('.cselect-trigger');
      var label = wrap.querySelector('.cselect-label');
      var menu = wrap.querySelector('.cselect-menu');
      if (!input || !trigger || !label || !menu) return;
      function sync() {
        var selected = menu.querySelector('.cselect-option[data-value="' + String(input.value).replace(/"/g, '\\"') + '"]');
        label.textContent = selected ? selected.textContent : '';
        menu.querySelectorAll('.cselect-option').forEach(function (option) {
          option.classList.toggle('is-selected', option === selected);
        });
      }
      function close() {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
      function open() {
        document.querySelectorAll('.cselect-menu').forEach(function (other) {
          if (other !== menu) {
            other.hidden = true;
            var otherTrigger = other.parentElement && other.parentElement.querySelector('.cselect-trigger');
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
          }
        });
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        var selected = menu.querySelector('.cselect-option.is-selected');
        if (selected && selected.focus) selected.focus();
      }
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        if (menu.hidden) open(); else close();
      });
      menu.addEventListener('click', function (event) {
        event.stopPropagation();
        var option = event.target.closest ? event.target.closest('.cselect-option') : null;
        if (!option) return;
        input.value = option.getAttribute('data-value') || '';
        sync();
        close();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
      menu.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { close(); trigger.focus(); }
      });
      document.addEventListener('click', function (event) {
        if (!wrap.contains(event.target)) close();
      });
      wrap._sync = sync;
      sync();
    });
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { els.toast.classList.remove('show'); }, 1600);
  }

  function api(path, options) {
    return fetch(path, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }

  function renderStoreWarnings(warnings) {
    var box = document.getElementById('store-warning');
    if (!box) return;
    var list = Array.isArray(warnings) ? warnings : [];
    if (!list.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '<strong>词库提醒</strong>' + list.map(function (warning) {
      return '<div>' + escapeHtml(warning.message || '') +
        (warning.path ? '<code>' + escapeHtml(warning.path) + '</code>' : '') + '</div>';
    }).join('');
  }

  function renderStats() {
    var s = state.stats || {};
    var today = state.today || {};
    var readingStats = (today.reading && today.reading.stats) || {};
    els.stats.innerHTML =
      '<span class="stat">连续 <strong>' + (today.streak || 0) + '</strong> 天</span>' +
      '<span class="stat">已精读 <strong>' + (readingStats.finished || 0) + '</strong> 篇</span>' +
      '<span class="stat">已读 <strong>' + (readingStats.paragraphsRead || 0) + '</strong> 段</span>' +
      '<span class="stat">句子卡 <strong>' + (readingStats.sentenceCards || 0) + '</strong> 张</span>' +
      '<span class="stat">待复习 <strong>' + (s.dueToday ?? s.due ?? 0) + '</strong></span>' +
      '<span class="stat">待学 <strong>' + (s.backlog || 0) + '</strong></span>';
    var navDue = document.getElementById('nav-due');
    var todayDue = Number(s.dueToday ?? s.due ?? 0);
    if (navDue) navDue.textContent = todayDue > 0 ? String(todayDue) : '';
  }

  function passportDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value).slice(0, 10).replace(/-/g, '.');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '.' + month + '.' + day;
  }

  function passportNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function renderPassportProgress(data) {
    var achievements = data.achievements || {};
    var badges = achievements.badges || [];
    var badgeHost = document.getElementById('passport-achievements');
    if (badgeHost) {
      badgeHost.innerHTML = '<div class="passport-block-head"><h2>成就</h2><span>已获得 ' +
        (achievements.earned || 0) + ' / ' + (achievements.total || badges.length) + '</span></div>' +
        '<div class="achievement-grid">' + badges.map(function (badge) {
          var percent = badge.target ? Math.min(100, Math.round((badge.progress / badge.target) * 100)) : 0;
          return '<div class="achievement' + (badge.earned ? ' earned' : '') + '">' +
            '<span class="achievement-icon">' + escapeHtml(badge.icon) + '</span>' +
            '<div class="achievement-body"><b>' + escapeHtml(badge.title) + '</b>' +
              '<small>' + escapeHtml(badge.description) + '</small>' +
              '<div class="achievement-track"><span style="width:' + percent + '%"></span></div>' +
              '<small>' + (badge.earned ? '已获得' : badge.progress + ' / ' + badge.target) + '</small></div>' +
          '</div>';
        }).join('') + '</div>';
    }

    var activity = achievements.activity || [];
    var activityHost = document.getElementById('passport-activity');
    if (activityHost) {
      activityHost.innerHTML = '<div class="passport-block-head"><h2>阅读日历</h2><span>最近 12 周 · ' +
        (achievements.studyDays || 0) + ' 天有学习记录</span></div>' +
        '<div class="activity-grid">' + activity.map(function (day) {
          return '<span class="activity-cell level-' + day.level + '" title="' +
            escapeHtml(day.date + ' · ' + day.count + ' 次') + '"></span>';
        }).join('') + '</div>';
    }
  }

  function updateNuanceCombo() {
    var bar = document.getElementById('nuance-combo-bar');
    if (bar) bar.textContent = state.nuanceCombo > 0 ? '· 连对 ' + state.nuanceCombo : '';
    var foot = document.getElementById('nuance-combo');
    if (foot) foot.textContent = state.nuanceCombo > 0 ? '连对 ' + state.nuanceCombo : '';
  }

  function closeNuance() {
    var modal = document.getElementById('nuance-modal');
    if (modal) modal.hidden = true;
  }

  function nextNuance(current) {
    var candidates = (state.queue || []).filter(function (entry) {
      return entry && entry.type !== 'sentence' && entry.id !== current.id;
    });
    if (candidates.length) {
      openNuance(candidates[0]);
      return;
    }
    api('/api/queue?limit=20&type=word').then(function (data) {
      var items = (data.items || []).filter(function (entry) {
        return entry && entry.id !== current.id;
      });
      if (items.length) openNuance(items[0]);
      else {
        closeNuance();
        toast('队列里暂时没有更多词了。');
      }
    }).catch(function () {
      closeNuance();
    });
  }

  function renderNuance(quiz, item) {
    var body = document.getElementById('nuance-body');
    if (!body) return;
    body.innerHTML =
      '<div class="nuance-scenario">' + escapeHtml(quiz.scenario) + '</div>' +
      '<p class="nuance-question">哪一句最自然地使用了 <b>' + escapeHtml(quiz.lemma || item.lemma) + '</b>？</p>' +
      quiz.options.map(function (option, index) {
        return '<button class="nuance-option" type="button" data-nuance-option="' + index + '">' +
          '<b>' + String.fromCharCode(65 + index) + '</b><span>' + escapeHtml(option) + '</span></button>';
      }).join('') +
      '<div id="nuance-feedback"></div>' +
      '<div class="nuance-foot"><span class="nuance-combo" id="nuance-combo"></span>' +
        '<button class="btn" id="nuance-next" type="button" hidden>下一题</button></div>';
    updateNuanceCombo();

    var answered = false;
    var buttons = body.querySelectorAll('[data-nuance-option]');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var chosen = Number(button.getAttribute('data-nuance-option'));
        var correct = chosen === quiz.answer;
        if (correct) state.nuanceCombo += 1;
        else state.nuanceCombo = 0;
        buttons.forEach(function (entry) {
          entry.disabled = true;
          var index = Number(entry.getAttribute('data-nuance-option'));
          if (index === quiz.answer) entry.classList.add('correct');
          if (index === chosen && !correct) entry.classList.add('wrong');
        });
        var feedback = document.getElementById('nuance-feedback');
        if (feedback) {
          feedback.innerHTML = '<div class="nuance-feedback' + (correct ? '' : ' bad') + '">' +
            '<strong>' + (correct ? '命中！' : '差一点。') + '</strong> ' +
            escapeHtml(quiz.explanation) + '</div>';
        }
        updateNuanceCombo();
        var next = document.getElementById('nuance-next');
        if (next) next.hidden = false;
      });
    });
    var next = document.getElementById('nuance-next');
    if (next) next.addEventListener('click', function () { nextNuance(item); });
  }

  function openNuance(item) {
    if (!item || !item.id) return;
    var modal = document.getElementById('nuance-modal');
    var body = document.getElementById('nuance-body');
    if (!modal || !body) return;
    modal.hidden = false;
    body.innerHTML = '<div class="nuance-loading">侦探正在布置现场…</div>';
    updateNuanceCombo();
    api('/api/items/' + encodeURIComponent(item.id) + '/nuance', { method: 'POST' })
      .then(function (data) {
        if (data && data.quiz) renderNuance(data.quiz, item);
      })
      .catch(function (error) {
        body.innerHTML = '<p class="nuance-loading">' + escapeHtml(error.message) +
          '<br>配置模型 API Key 后，这里会生成一个三句用法辨析。</p>';
      });
  }

  function renderPassport() {
    var data = state.passport || {};
    var stats = data.stats || {};
    var stamps = data.stamps || [];
    var head = document.getElementById('passport-head');
    var grid = document.getElementById('passport-stamps');
    if (!head || !grid) return;
    head.className = 'passport-head';
    head.innerHTML =
      '<div>' +
        '<div class="passport-eyebrow">READING PASSPORT</div>' +
        '<h1>阅读护照</h1>' +
        '<p class="passport-intro">开始读的文章会在这里留下一个章；读完后再回来，可以生成一张 3:4 分享卡。</p>' +
      '</div>' +
      '<div class="passport-stats">' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.streak) + '</strong><span>连续天数</span></div>' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.finished) + '</strong><span>读完文章</span></div>' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.inProgress) + '</strong><span>在读文章</span></div>' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.paragraphsRead) + '</strong><span>精读段落</span></div>' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.words) + '</strong><span>读完词数</span></div>' +
        '<div class="passport-stat"><strong>' + passportNumber(stats.minutes) + '</strong><span>精读分钟</span></div>' +
      '</div>';
    renderPassportProgress(data);
    if (!stamps.length) {
      grid.innerHTML = '<div class="passport-empty">还没有阅读记录。打开一篇文章开始精读，护照上就会出现第一个章。</div>';
      return;
    }
    grid.innerHTML = stamps.map(function (stamp) {
      var finished = Boolean(stamp.finished);
      var date = passportDate(finished ? stamp.finishedAt : stamp.updatedAt);
      var when = finished
        ? '读完 · ' + date
        : stamp.read
          ? '在读 · ' + (stamp.percent || 0) + '%'
          : '刚开始 · ' + date;
      var meta = [
        stamp.cefr || '',
        stamp.wordCount ? passportNumber(stamp.wordCount) + ' 词' : '',
        stamp.minutes ? passportNumber(stamp.minutes) + ' 分钟' : ''
      ].filter(Boolean).join(' · ');
      return '<button class="passport-stamp" type="button" data-passport-share="' + escapeHtml(stamp.packId) + '">' +
        '<span class="stamp-date' + (finished ? '' : ' reading') + '">' + escapeHtml(when) + '</span>' +
        '<span class="stamp-title">' + escapeHtml(stamp.title) + '</span>' +
        (stamp.titleZh ? '<span class="stamp-zh">' + escapeHtml(stamp.titleZh) + '</span>' : '') +
        (stamp.quote ? '<span class="stamp-quote">“' + escapeHtml(stamp.quote) + '”</span>' : '') +
        '<span class="stamp-foot"><span>' + escapeHtml(meta) + '</span><span class="stamp-share">分享卡 ↗</span></span>' +
      '</button>';
    }).join('');
  }

  function insightStat(label, value, suffix) {
    return '<div class="insight-stat"><strong>' + escapeHtml(String(value)) + (suffix || '') +
      '</strong><span>' + escapeHtml(label) + '</span></div>';
  }

  function renderWeekly(data) {
    var host = document.getElementById('insight-weekly');
    if (!host) return;
    var range = data.range || {};
    var articles = data.articles || {};
    var reviews = data.reviews || {};
    var outputs = data.outputs || {};
    var missed = data.missed || [];
    var activity = (reviews.total || 0) + (articles.finished || 0) + (outputs.count || 0) + (data.newItems || 0);
    var html = '<div class="insight-head"><h2>最近 7 天</h2><span>' +
      escapeHtml(range.start || '') + ' → ' + escapeHtml(range.end || '') + '</span></div>';
    var exportAction = '<div class="insight-actions"><a class="btn" href="/api/weekly/export">导出周报</a></div>';
    if (!activity) {
      host.innerHTML = html + '<p class="insight-copy">这一周还没有学习记录。先完成一篇精读，再写三句输出；下一次复盘这里就会有数据。</p>' +
        '<div class="insight-block"><h3>下周建议</h3><p>' + escapeHtml(data.suggestion || '') + '</p></div>' +
        exportAction;
      return;
    }
    var goals = data.goals || {};
    html += '<div class="insight-stats">' +
      insightStat('精读完成', articles.finished || 0, goals.articles ? ' / ' + goals.articles + ' 篇' : ' 篇') +
      insightStat('复习', reviews.total || 0, ' 次') +
      insightStat('首次正确率', reviews.firstTotal ? Math.round((reviews.firstAccuracy || 0) * 100) + '%' : '—') +
      insightStat('新增词条', data.newItems || 0, ' 个') +
      insightStat('学习天数', data.studyDays || 0, goals.studyDays ? ' / ' + goals.studyDays + ' 天' : ' 天') +
      '</div>';
    if (articles.titles && articles.titles.length) {
      html += '<div class="insight-block"><h3>读完的文章</h3><ul class="insight-list">' +
        articles.titles.map(function (title) { return '<li>' + escapeHtml(title) + '</li>'; }).join('') +
        '</ul></div>';
    }
    html += '<div class="insight-block"><h3>错得最多的词</h3>' +
      (missed.length
        ? '<div class="insight-chips">' + missed.map(function (entry) {
            return '<span class="insight-chip">' + escapeHtml(entry.lemma) +
              '<em>×' + escapeHtml(String(entry.misses)) + '</em></span>';
          }).join('') + '</div>'
        : '<p>这周没有 Again / Hard 的词，保持住。</p>') +
      '</div>';
    if (outputs.latest) {
      html += '<div class="insight-block"><h3>最近的输出</h3><p>' + escapeHtml(outputs.latest.text) + '</p></div>';
    }
    html += '<div class="insight-block"><h3>下周建议</h3><p>' + escapeHtml(data.suggestion || '') + '</p></div>' + exportAction;
    host.innerHTML = html;
  }

  function renderHistory(data) {
    var host = document.getElementById('insight-history');
    if (!host) return;
    var history = data.history || data;
    var totals = history.totals || {};
    var days = history.days || [];
    var range = history.range || {};
    var head = '<div class="insight-head"><h2>复习曲线</h2><span>' +
      escapeHtml(range.start || '') + ' → ' + escapeHtml(range.end || '') + '</span></div>';
    if (!totals.reviews) {
      host.innerHTML = head + '<p class="insight-copy">还没有复习记录。完成一次复习后，这里会显示每天的复习量和留存率。</p>';
      return;
    }
    var max = Math.max.apply(null, days.map(function (day) { return day.reviews || 0; })) || 1;
    var chart = days.map(function (day) {
      var height = Math.max(3, Math.round(((day.reviews || 0) / max) * 86));
      var tone = !day.reviews ? 'is-empty' : day.retention >= 0.8 ? 'good' : day.retention >= 0.6 ? 'mid' : 'low';
      var title = day.date + ' · ' + day.reviews + ' 次 · 留存 ' + Math.round((day.retention || 0) * 100) + '%';
      return '<div class="history-col" title="' + escapeHtml(title) + '">' +
        '<span class="history-bar ' + tone + '" style="height:' + height + 'px"></span>' +
        '<small>' + escapeHtml(day.date.slice(5)) + '</small></div>';
    }).join('');
    var sources = (history.sources || []).slice(0, 5).map(function (entry) {
      return '<div class="history-source"><span title="' + escapeHtml(entry.label) + '">' + escapeHtml(entry.label) + '</span>' +
        '<b>' + Math.round(entry.retention * 100) + '%</b>' +
        '<small>' + entry.reviews + ' 次</small></div>';
    }).join('');
    var cefr = (history.cefr || []).slice(0, 6).map(function (entry) {
      return '<span class="history-chip">' + escapeHtml(entry.label) +
        '<em>' + Math.round(entry.retention * 100) + '% · ' + entry.reviews + '</em></span>';
    }).join('');
    host.innerHTML = head +
      '<div class="insight-stats">' +
      insightStat('留存率', Math.round(totals.retention * 100) + '%') +
      insightStat('复习次数', totals.reviews, ' 次') +
      insightStat('覆盖卡片', totals.unique, ' 张') +
      insightStat('活跃天数', totals.activeDays, ' 天') +
      '</div>' +
      '<div class="history-chart">' + chart + '</div>' +
      (sources ? '<div class="insight-block"><h3>按来源</h3><div class="history-sources">' + sources + '</div></div>' : '') +
      (cefr ? '<div class="insight-block"><h3>按 CEFR</h3><div class="insight-chips">' + cefr + '</div></div>' : '');
  }

  function renderDiagnosis(data) {
    var host = document.getElementById('insight-diagnosis');
    if (!host || !data) return;
    var words = data.words || [];
    var diagnosis = data.diagnosis || null;
    var known = {};
    (diagnosis && diagnosis.knownLemmas ? diagnosis.knownLemmas : []).forEach(function (lemma) { known[lemma] = true; });
    var knownCount = Object.keys(known).length;
    var html = '<div class="insight-head"><h2>词汇诊断</h2><span>' +
      (diagnosis
        ? '上次 ' + escapeHtml(diagnosis.level) + ' · ' + diagnosis.knownCount + ' / ' + diagnosis.total +
          ' · ' + escapeHtml(String(diagnosis.completedAt).slice(0, 10))
        : '3 分钟 · 用来校准选词和卡片难度') +
      '</span></div>' +
      '<p class="insight-copy">凭第一反应选“认识”的词，不确定就不选。结果只保存在本机，用来建立你的已知词表和选词难度。</p>' +
      '<div class="diagnosis-words">' +
      words.map(function (word) {
        var isKnown = Boolean(known[word.lemma]);
        return '<button type="button" class="diagnosis-word' + (isKnown ? ' is-known' : '') +
          '" data-diagnosis-word="' + escapeHtml(word.lemma) + '" aria-pressed="' + (isKnown ? 'true' : 'false') + '">' +
          '<b>' + escapeHtml(word.lemma) + '</b><span>' + escapeHtml(word.gloss) + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="diagnosis-actions"><button class="btn btn-primary" id="diagnosis-save" type="button">保存诊断</button>' +
      '<span class="muted" id="diagnosis-count">已认识 ' + knownCount + ' / ' + words.length + '</span></div>' +
      (diagnosis ? '<div class="diagnosis-note">当前水平：' + escapeHtml(diagnosis.level) +
        '。重新诊断会覆盖上次结果，但词库和复习记录不受影响。</div>' : '');
    host.innerHTML = html;

    host.querySelectorAll('[data-diagnosis-word]').forEach(function (button) {
      button.addEventListener('click', function () {
        var lemma = button.getAttribute('data-diagnosis-word');
        if (known[lemma]) delete known[lemma];
        else known[lemma] = true;
        var isKnown = Boolean(known[lemma]);
        button.classList.toggle('is-known', isKnown);
        button.setAttribute('aria-pressed', isKnown ? 'true' : 'false');
        var count = document.getElementById('diagnosis-count');
        if (count) count.textContent = '已认识 ' + Object.keys(known).length + ' / ' + words.length;
      });
    });

    var save = document.getElementById('diagnosis-save');
    if (save) {
      save.addEventListener('click', function () {
        save.disabled = true;
        api('/api/diagnosis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ known: Object.keys(known) }),
        }).then(function (result) {
          toast('诊断已保存：' + result.diagnosis.level);
          renderDiagnosis({ words: words, diagnosis: result.diagnosis });
          loadPlan();
        }).catch(function (error) {
          toast('保存诊断失败：' + error.message);
        }).finally(function () {
          save.disabled = false;
        });
      });
    }
  }

  function copyLanUrl(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('链接已复制');
      }, function () {
        window.prompt('复制手机访问链接', url);
      });
      return;
    }
    window.prompt('复制手机访问链接', url);
  }

  function renderLanPanel() {
    var status = state.lan;
    if (!els.lanBody || !els.lanPanel) return;
    if (!status || !status.local) {
      els.lanPanel.hidden = true;
      return;
    }
    if (!status.enabled) {
      els.lanBody.innerHTML = '<p>让同一 Wi-Fi 下的手机打开这个本地应用。开启后会生成一个带令牌的链接，关闭后立即失效。</p>' +
        '<div class="lan-actions"><button class="btn btn-primary" id="lan-enable" type="button">开启手机访问</button></div>' +
        '<p class="lan-warning">只在可信网络使用；不要在公共 Wi-Fi 开启。</p>';
    } else {
      var urls = status.urls || [];
      var qr = status.qr && status.qr.length ? status.qr[0] : null;
      els.lanBody.innerHTML = '<p>手机和电脑需要在同一网络。先打开下面带令牌的链接，手机会记住访问权限。</p>' +
        (qr
          ? '<div class="lan-qr-wrap">' + qr.svg +
            '<div><strong>扫码在手机上打开</strong><span>用手机相机扫描，或在同一 Wi-Fi 下打开右侧链接。</span></div></div>'
          : '') +
        (urls.length
          ? urls.map(function (url) {
              return '<div class="lan-url"><code>' + escapeHtml(url) + '</code>' +
                '<button class="btn" data-copy-url="' + escapeHtml(url) + '" type="button">复制</button></div>';
            }).join('')
          : '<p class="lan-warning">没有检测到局域网 IPv4 地址，请检查网络连接。</p>') +
        '<p class="lan-warning">链接包含访问令牌，不要发到公开群聊或截图分享。</p>' +
        '<div class="lan-actions"><button class="btn" id="lan-disable" type="button">关闭手机访问</button></div>';
    }

    var enable = document.getElementById('lan-enable');
    if (enable) enable.addEventListener('click', function () { setLan(true); });
    var disable = document.getElementById('lan-disable');
    if (disable) disable.addEventListener('click', function () { setLan(false); });
    els.lanBody.querySelectorAll('[data-copy-url]').forEach(function (button) {
      button.addEventListener('click', function () {
        copyLanUrl(button.getAttribute('data-copy-url'));
      });
    });
  }

  function setLan(enabled) {
    var button = document.getElementById(enabled ? 'lan-enable' : 'lan-disable');
    if (button) button.disabled = true;
    api('/api/lan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
    }).then(function (result) {
      state.lan = result;
      if (els.lanToggle) {
        els.lanToggle.hidden = false;
        els.lanToggle.textContent = result.enabled ? '手机 ✓' : '手机';
        els.lanToggle.classList.toggle('active', Boolean(result.enabled));
      }
      if (els.lanPanel) els.lanPanel.hidden = false;
      renderLanPanel();
      toast(result.enabled ? '手机访问已开启' : '手机访问已关闭');
    }).catch(function (error) {
      toast('手机访问操作失败：' + error.message);
    }).finally(function () {
      if (button) button.disabled = false;
    });
  }

  function themeChoice() {
    try {
      return localStorage.getItem('closeread-theme') || 'auto';
    } catch (error) {
      return 'auto';
    }
  }

  function prefersDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyReviewTheme(choice) {
    var dark = choice === 'dark' || (choice === 'auto' && prefersDark());
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-choice', choice);
    var button = document.getElementById('theme-toggle');
    if (button) button.textContent = choice === 'light' ? '日间' : choice === 'dark' ? '夜间' : '自动';
  }

  function cycleReviewTheme() {
    var order = ['auto', 'light', 'dark'];
    var next = order[(order.indexOf(themeChoice()) + 1) % order.length];
    try {
      localStorage.setItem('closeread-theme', next);
    } catch (error) {}
    applyReviewTheme(next);
  }

  function settingsRow(label, value) {
    return '<div class="settings-row"><b>' + escapeHtml(label) + '</b><span>' + value + '</span></div>';
  }

  function renderSettings(data) {
    var goalsHost = document.getElementById('settings-goals');
    if (goalsHost) {
      var prefs = data.preferences || {};
      goalsHost.innerHTML = '<h2>学习目标</h2>' +
        '<p class="muted">每日目标决定今日计划和复习队列的默认数量；每周目标只用于复盘进度。</p>' +
        '<div class="settings-goals">' +
        '<label>每日新词 <input id="settings-new-target" type="number" min="0" max="100" step="1" value="' + escapeHtml(String(prefs.dailyNewTarget ?? 10)) + '"></label>' +
        '<label>每日复习 <input id="settings-review-target" type="number" min="0" max="100" step="1" value="' + escapeHtml(String(prefs.dailyReviewTarget ?? 10)) + '"></label>' +
        '<label>每周文章 <input id="settings-week-articles" type="number" min="0" max="100" step="1" value="' + escapeHtml(String(prefs.weeklyArticleGoal ?? 3)) + '"></label>' +
        '<label>每周学习天数 <input id="settings-week-days" type="number" min="0" max="7" step="1" value="' + escapeHtml(String(prefs.weeklyStudyDaysGoal ?? 5)) + '"></label>' +
        '<button class="btn btn-primary" id="settings-goals-save" type="button">保存目标</button>' +
        '<span class="small muted" id="settings-goals-status"></span></div>';
    }
    var appHost = document.getElementById('settings-app');
    if (appHost) {
      appHost.innerHTML = '<h2>应用</h2>' +
        '<p class="muted">把 CloseRead 添加到桌面或手机主屏，打开时更像一个独立应用；数据仍然只留在本机。</p>' +
        '<div class="settings-actions"><button class="btn" id="settings-install" type="button" hidden>添加到桌面</button></div>' +
        '<p class="small muted">手机：浏览器菜单 → 添加到主屏幕。电脑：地址栏右侧的安装图标。</p>';
      var installButton = document.getElementById('settings-install');
      if (installButton) {
        if (window.__closereadInstall) installButton.hidden = false;
        installButton.addEventListener('click', function () {
          var prompt = window.__closereadInstall;
          if (!prompt) return;
          prompt.prompt();
          prompt.userChoice.then(function () {
            window.__closereadInstall = null;
            installButton.hidden = true;
          });
        });
      }
    }
    var dataHost = document.getElementById('settings-data');
    if (dataHost) {
      var warnings = (data.warnings || []).map(function (warning) { return escapeHtml(warning.message || ''); }).join('<br>');
      dataHost.innerHTML = '<h2>数据与词库</h2>' +
        settingsRow('数据目录', '<code>' + escapeHtml(data.dataDir || '') + '</code>') +
        settingsRow('学习包目录', '<code>' + escapeHtml(data.packsDir || '') + '</code>') +
        settingsRow('词条 / 学习包', (data.counts && data.counts.total || 0) + ' / ' + (data.trash ? data.trash.length + ' 个回收站条目' : '0')) +
        (warnings ? '<div class="settings-row"><b>提醒</b><span>' + warnings + '</span></div>' : '');
    }
    var llmHost = document.getElementById('settings-llm');
    if (llmHost) {
      var llm = data.llm || {};
      llmHost.innerHTML = '<h2>模型</h2>' +
        settingsRow('状态', llm.configured ? escapeHtml(llm.label || '') + ' · ' + escapeHtml(llm.model || '') : '未配置') +
        settingsRow('Base URL', '<code>' + escapeHtml(llm.baseUrl || '') + '</code>') +
        settingsRow('Key 来源', llm.keySource === 'stored' ? '本机设置' : llm.keySource === 'env' ? '环境变量' : '未配置') +
        '<div class="settings-actions"><button class="btn" id="settings-llm-test" type="button">测试连接</button>' +
        '<button class="btn" data-go-tab="import" type="button">模型设置</button><span class="small muted" id="settings-llm-result"></span></div>';
    }
    var ttsHost = document.getElementById('settings-tts');
    if (ttsHost) {
      var tts = data.tts || {};
      ttsHost.innerHTML = '<h2>语音</h2>' +
        settingsRow('状态', tts.configured ? escapeHtml(tts.providerLabel || tts.provider || '') : '仅浏览器朗读 / 本地系统语音') +
        settingsRow('音色', escapeHtml(tts.voice || '默认')) +
        settingsRow('说明', escapeHtml(tts.hint || '')) +
        '<div class="settings-actions"><a class="btn" href="/?tab=library">去词库</a></div>';
    }
    var backupHost = document.getElementById('settings-backup');
    if (backupHost) {
      backupHost.innerHTML = '<h2>备份与恢复</h2>' +
        '<p class="muted">完整备份包含词库、导入材料、学习包目录、阅读进度、缓存音频和金句。</p>' +
        '<div class="settings-actions"><button class="btn btn-primary" id="settings-backup" type="button">下载完整备份</button></div>' +
        '<div class="settings-file"><input type="file" id="settings-restore-file" accept="application/json,.json">' +
        '<button class="btn" id="settings-restore-run" type="button">从备份恢复</button>' +
        '<span id="settings-restore-status"></span></div>' +
        '<p class="small muted">恢复会覆盖当前词库、学习包目录和阅读进度；请先下载一份当前备份。</p>';
    }
    var usageHost = document.getElementById('settings-usage');
    if (usageHost) {
      var usage = data.usage || {};
      var models = Object.keys(usage.models || {}).map(function (model) {
        var entry = usage.models[model];
        return '<div class="settings-row"><b>' + escapeHtml(model) + '</b><span>' + entry.calls + ' 次 · ' + entry.promptTokens + ' + ' + entry.completionTokens + ' tokens</span></div>';
      }).join('');
      usageHost.innerHTML = '<h2>本次运行用量</h2>' +
        settingsRow('模型调用', (usage.calls || 0) + ' 次') +
        settingsRow('Token（输入 / 输出）', (usage.promptTokens || 0) + ' / ' + (usage.completionTokens || 0)) +
        (models || '<p class="muted">还没有模型调用记录。</p>');
    }
    var trashHost = document.getElementById('settings-trash');
    if (trashHost) {
      var entries = data.trash || [];
      trashHost.innerHTML = '<h2>回收站 <span class="small muted">' + entries.length + '</span></h2>' +
        (entries.length ? entries.map(function (entry) {
          return '<div class="trash-entry"><div><strong>' + escapeHtml(entry.title) + '</strong>' +
            '<small>' + escapeHtml(entry.kind === 'pack' ? '学习包' : '材料') + ' · ' + escapeHtml(String(entry.deletedAt).slice(0, 10)) +
            ' · ' + entry.packCount + ' 个包 · ' + entry.itemCount + ' 个词条</small></div>' +
            '<div class="row-actions"><button class="btn small" data-trash-restore="' + escapeHtml(entry.id) + '">恢复</button>' +
            '<button class="btn small danger" data-trash-purge="' + escapeHtml(entry.id) + '">彻底删除</button></div></div>';
        }).join('') : '<p class="muted">回收站是空的。删除的学习包和材料会先放在这里。</p>');
    }

    var goalsSave = document.getElementById('settings-goals-save');
    if (goalsSave) goalsSave.addEventListener('click', function () {
      var newInput = document.getElementById('settings-new-target');
      var reviewInput = document.getElementById('settings-review-target');
      var weekArticles = document.getElementById('settings-week-articles');
      var weekDays = document.getElementById('settings-week-days');
      var status = document.getElementById('settings-goals-status');
      setBusy(goalsSave, true, '保存中…');
      api('/api/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dailyNewTarget: Number(newInput ? newInput.value : 10),
          dailyReviewTarget: Number(reviewInput ? reviewInput.value : 10),
          weeklyArticleGoal: Number(weekArticles ? weekArticles.value : 3),
          weeklyStudyDaysGoal: Number(weekDays ? weekDays.value : 5),
        }),
      }).then(function () {
        if (status) status.textContent = '已保存';
        toast('学习目标已更新');
        loadPlan();
      }).catch(function (error) {
        if (status) status.textContent = '保存失败：' + error.message;
      }).finally(function () {
        setBusy(goalsSave, false);
      });
    });
    var testButton = document.getElementById('settings-llm-test');
    if (testButton) testButton.addEventListener('click', function () {
      setBusy(testButton, true, '测试中…');
      var result = document.getElementById('settings-llm-result');
      api('/api/llm/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        .then(function (data) { if (result) result.textContent = data.ok ? '连接成功' : '返回异常'; })
        .catch(function (error) { if (result) result.textContent = '失败：' + error.message; })
        .finally(function () { setBusy(testButton, false); });
    });
    var backupButton = document.getElementById('settings-backup');
    if (backupButton) backupButton.addEventListener('click', function () { downloadBackup(backupButton); });
    var restoreRun = document.getElementById('settings-restore-run');
    if (restoreRun) restoreRun.addEventListener('click', function () {
      var input = document.getElementById('settings-restore-file');
      var status = document.getElementById('settings-restore-status');
      var file = input && input.files && input.files[0];
      if (!file) { if (status) status.textContent = '先选择一个备份 JSON。'; return; }
      if (!confirm('恢复会覆盖当前词库、学习包目录和阅读进度。确认继续？')) return;
      setBusy(restoreRun, true, '恢复中…');
      file.text().then(function (text) {
        return api('/api/restore', { method: 'POST', body: text });
      }).then(function (result) {
        if (status) status.textContent = '已恢复 ' + result.result.items + ' 个词条，页面即将刷新。';
        setTimeout(function () { location.reload(); }, 600);
      }).catch(function (error) {
        if (status) status.textContent = '恢复失败：' + error.message;
      }).finally(function () { setBusy(restoreRun, false); });
    });
    document.querySelectorAll('[data-trash-restore]').forEach(function (button) {
      button.addEventListener('click', function () {
        setBusy(button, true, '恢复中…');
        api('/api/trash/' + encodeURIComponent(button.getAttribute('data-trash-restore')) + '/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          .then(function () { toast('已从回收站恢复'); loadSettings(); loadPacks(); loadPlan(); })
          .catch(function (error) { toast('恢复失败：' + error.message); })
          .finally(function () { setBusy(button, false); });
      });
    });
    document.querySelectorAll('[data-trash-purge]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!confirm('彻底删除后无法恢复，确认继续？')) return;
        api('/api/trash/' + encodeURIComponent(button.getAttribute('data-trash-purge')), { method: 'DELETE' })
          .then(function () { toast('已彻底删除'); loadSettings(); })
          .catch(function (error) { toast('删除失败：' + error.message); });
      });
    });
  }

  function loadSettings() {
    return api('/api/settings').then(renderSettings).catch(function (error) {
      var host = document.getElementById('settings-data');
      if (host) host.innerHTML = '<div class="muted">设置加载失败：' + escapeHtml(error.message) + '</div>';
    });
  }

  function downloadBackup(button) {
    if (button) setBusy(button, true, '打包中…');
    fetch('/api/backup').then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'closeread-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('完整备份已下载；恢复请用电脑上的 pnpm dev restore');
    }).catch(function (error) {
      toast('备份失败：' + error.message);
    }).finally(function () {
      if (button) setBusy(button, false);
    });
  }

  function loadLanStatus() {
    return api('/api/lan').then(function (result) {
      state.lan = result;
      var phoneMode = result.local === false;
      document.body.classList.toggle('phone-mode', phoneMode);
      var banner = document.getElementById('phone-mode-banner');
      if (banner) banner.hidden = !phoneMode;
      if (phoneMode && (state.tab === 'import' || state.tab === 'settings')) switchTab('home');
      if (els.lanToggle) {
        els.lanToggle.hidden = !result.local;
        els.lanToggle.textContent = result.enabled ? '手机 ✓' : '手机';
        els.lanToggle.classList.toggle('active', Boolean(result.enabled));
      }
      renderLanPanel();
    }).catch(function () {
      if (els.lanToggle) els.lanToggle.hidden = true;
    });
  }

  function loadInsights() {
    return Promise.all([api('/api/weekly'), api('/api/diagnosis'), api('/api/history?days=14')]).then(function (results) {
      renderWeekly(results[0]);
      renderDiagnosis(results[1]);
      renderHistory(results[2]);
    }).catch(function (error) {
      var weekly = document.getElementById('insight-weekly');
      var diagnosis = document.getElementById('insight-diagnosis');
      var history = document.getElementById('insight-history');
      if (weekly) {
        weekly.innerHTML = '<div class="insight-head"><h2>复盘</h2></div><p class="insight-copy">加载失败：' +
          escapeHtml(error.message) + '</p>';
      }
      if (diagnosis) diagnosis.innerHTML = '';
      if (history) history.innerHTML = '';
    });
  }

  function loadGrowthWeekly() {
    var host = document.getElementById('passport-weekly');
    if (!host) return;
    api('/api/weekly').then(function (data) {
      var reviews = data.reviews || {};
      var articles = data.articles || {};
      var missed = data.missed || [];
      var goals = data.goals || {};
      var activity = (reviews.total || 0) + (articles.finished || 0) + (data.outputs && data.outputs.count || 0);
      host.innerHTML = '<div class="passport-block-head"><h2>本周复盘</h2><span>' +
        escapeHtml((data.range && data.range.start) || '') + ' → ' + escapeHtml((data.range && data.range.end) || '') +
        '</span></div>' +
        (activity
          ? '<div class="insight-stats">' + insightStat('精读完成', articles.finished || 0, goals.articles ? ' / ' + goals.articles + ' 篇' : ' 篇') +
            insightStat('复习', reviews.total || 0, ' 次') +
            insightStat('首次正确率', reviews.firstTotal ? Math.round((reviews.firstAccuracy || 0) * 100) + '%' : '—') +
            insightStat('学习天数', data.studyDays || 0, goals.studyDays ? ' / ' + goals.studyDays + ' 天' : ' 天') + '</div>' +
            '<div class="insight-block"><h3>下周建议</h3><p>' + escapeHtml(data.suggestion || '') + '</p></div>'
          : '<p class="muted">这一周还没有学习记录。完成一篇精读，下一次复盘就会出现在这里。</p>') +
        (missed.length ? '<div class="insight-block"><h3>易错词</h3><div class="insight-chips">' +
          missed.slice(0, 5).map(function (entry) {
            return '<span class="insight-chip">' + escapeHtml(entry.lemma) + '<em>×' + escapeHtml(String(entry.misses)) + '</em></span>';
          }).join('') + '</div></div>' : '') +
        '<div class="passport-weekly-actions"><a class="btn" href="/api/weekly/export">导出周报</a>' +
        '<button class="btn" data-go-tab="insights" type="button">查看完整复盘</button></div>';
    }).catch(function () {
      host.innerHTML = '';
    });
  }

  function loadPassport() {
    if (state.passportLoading) return state.passportPromise;
    state.passportLoading = true;
    state.passportPromise = api('/api/passport').then(function (result) {
      state.passport = result;
      renderPassport();
    }).catch(function (error) {
      var head = document.getElementById('passport-head');
      var grid = document.getElementById('passport-stamps');
      if (head) {
        head.className = 'passport-head';
        head.innerHTML = '<div><div class="passport-eyebrow">READING PASSPORT</div><h1>阅读护照</h1>' +
          '<p class="passport-intro">护照暂时打不开：' + escapeHtml(error.message) + '</p></div>';
      }
      if (grid) grid.innerHTML = '';
    }).finally(function () {
      state.passportLoading = false;
    });
    return state.passportPromise;
  }

  function fitCanvasText(ctx, text, maxWidth) {
    var value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1);
    return value + '…';
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = String(text || '').replace(/\\s+/g, ' ').trim().split(' ');
    if (!words.length || !words[0]) return y;
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    var shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = fitCanvasText(ctx, shown[maxLines - 1] + ' …', maxWidth);
    shown.forEach(function (value, index) { ctx.fillText(value, x, y + index * lineHeight); });
    return y + shown.length * lineHeight;
  }

  function drawPassportCard(stamp) {
    var canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1440;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var margin = 88;
    var rust = '#a43a2c';

    ctx.fillStyle = '#f7f2e8';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(28,26,22,.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, width - 88, height - 88);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(28,26,22,.5)';
    ctx.font = '500 18px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('C L O S E R E A D', margin, 130);
    ctx.textAlign = 'right';
    ctx.fillText('READING PASSPORT', width - margin, 130);
    ctx.textAlign = 'left';

    var y = 220;
    ctx.fillStyle = '#1c1a16';
    ctx.font = '600 58px Georgia, "Times New Roman", serif';
    y = wrapCanvasText(ctx, stamp.title || 'Reading', margin, y, width - margin * 2, 70, 3);
    if (stamp.titleZh) {
      y += 14;
      ctx.fillStyle = 'rgba(28,26,22,.58)';
      ctx.font = '30px "PingFang SC", "Hiragino Sans GB", sans-serif';
      ctx.fillText(fitCanvasText(ctx, stamp.titleZh, width - margin * 2), margin, y);
      y += 38;
    }

    var divider = Math.max(410, y + 26);
    ctx.strokeStyle = 'rgba(28,26,22,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, divider);
    ctx.lineTo(width - margin, divider);
    ctx.stroke();

    if (stamp.quote) {
      ctx.fillStyle = rust;
      ctx.font = '500 16px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('A LINE TO KEEP', margin, divider + 52);
      ctx.fillStyle = '#2d2922';
      ctx.font = 'italic 38px Georgia, "Times New Roman", serif';
      wrapCanvasText(ctx, stamp.quote, margin, divider + 110, width - margin * 2, 52, 5);
    }

    ctx.strokeStyle = 'rgba(28,26,22,.18)';
    ctx.beginPath();
    ctx.moveTo(margin, 1140);
    ctx.lineTo(width - margin, 1140);
    ctx.stroke();

    var meta = [
      stamp.cefr || '',
      stamp.wordCount ? passportNumber(stamp.wordCount) + ' WORDS' : '',
      stamp.minutes ? passportNumber(stamp.minutes) + ' MIN' : ''
    ].filter(Boolean).join('   ·   ');
    ctx.fillStyle = '#2d2922';
    ctx.font = '500 21px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(fitCanvasText(ctx, meta, 700), margin, 1204);

    var when = stamp.finished
      ? '读完于 ' + passportDate(stamp.finishedAt)
      : '读到 ' + (stamp.percent || 0) + '% · ' + passportDate(stamp.updatedAt);
    ctx.fillStyle = 'rgba(28,26,22,.6)';
    ctx.font = '22px "PingFang SC", "Hiragino Sans GB", sans-serif';
    ctx.fillText(when, margin, 1262);
    ctx.fillStyle = 'rgba(28,26,22,.42)';
    ctx.font = '15px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('CLOSEREAD  ·  READ SLOWLY, KEEP A LINE', margin, 1340);

    ctx.save();
    ctx.translate(888, 1240);
    ctx.rotate(-0.13);
    ctx.strokeStyle = rust;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 57, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rust;
    ctx.textAlign = 'center';
    ctx.font = '600 16px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('CLOSEREAD', 0, -4);
    ctx.font = '500 12px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('R E A D', 0, 22);
    ctx.restore();

    return canvas;
  }

  function openPassportCard(packId) {
    var stamps = (state.passport && state.passport.stamps) || [];
    var stamp = stamps.find(function (entry) { return entry.packId === packId; });
    if (!stamp) return;
    state.shareStamp = stamp;
    var wrap = document.getElementById('passport-canvas-wrap');
    var modal = document.getElementById('passport-modal');
    if (!wrap || !modal) return;
    wrap.innerHTML = '';
    wrap.appendChild(drawPassportCard(stamp));
    modal.hidden = false;
    document.body.classList.add('passport-modal-open');
  }

  function closePassportCard() {
    var modal = document.getElementById('passport-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('passport-modal-open');
  }

  function downloadPassportCard() {
    var canvas = document.querySelector('#passport-canvas-wrap canvas');
    var stamp = state.shareStamp;
    if (!canvas || !stamp) return;
    canvas.toBlob(function (blob) {
      if (!blob) {
        toast('浏览器暂时无法导出这张卡');
        return;
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'CloseRead-' + String(stamp.title || 'reading').replace(/[^A-Za-z0-9\\u4e00-\\u9fa5_-]+/g, '-').slice(0, 40) + '.png';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, 'image/png');
  }

  function readingHref(card, continueReading) {
    if (!card || !card.url) return '#';
    if (continueReading && card.started && card.lastParagraph > 0 && !card.finished) {
      return card.url + '#p-' + String(card.lastParagraph + 1).padStart(2, '0');
    }
    return card.url;
  }

  function editorFeedbackHtml(feedback) {
    return '<div class="output-feedback">' +
      '<p><b>编辑说</b> ' + escapeHtml(feedback.praise) + '</p>' +
      '<p><b>可以升级</b> ' + escapeHtml(feedback.upgrade) + '</p>' +
      '<blockquote>' + escapeHtml(feedback.revision) + '</blockquote>' +
      (feedback.question ? '<p><b>再写一句</b> ' + escapeHtml(feedback.question) + '</p>' : '') +
    '</div>';
  }

  function loadPlan() {
    return api('/api/today').then(function (result) {
      state.today = result;
      renderStoreWarnings(result.warnings);
      var diagnosisPrompt = document.getElementById('home-diagnosis');
      if (diagnosisPrompt) {
        if (result.diagnosis || (result.stats && result.stats.total >= 20) || (result.reading && result.reading.stats && result.reading.stats.finished > 0)) {
          diagnosisPrompt.hidden = true;
          diagnosisPrompt.innerHTML = '';
        } else {
          diagnosisPrompt.hidden = false;
          diagnosisPrompt.innerHTML = '<div><strong>先做一次 3 分钟词汇诊断</strong>' +
            '<span>校准你的水平和已知词表，第一篇文章的选词会更贴合你。</span></div>' +
            '<button class="btn" data-go-tab="insights" type="button">开始诊断</button>';
        }
      }
      state.stats = result.stats || state.stats;
      var steps = result.steps || {};
      var review = steps.review || {};
      var article = steps.article || {};
      var output = steps.output || {};
      var reading = result.reading || {};
      var current = reading.current;
      var todayReading = reading.today;
      var recent = reading.recent || [];
      var articleHref = '';
      if (article.suggestion) {
        articleHref = '/?tab=import&resource=' + encodeURIComponent(article.suggestion.resourceId) +
          '&articles=1&article=' + article.suggestion.articleIndex;
      }

      var hero = '';
      if (current && !current.finished) {
        var heroLabel = current.started ? '继续精读' : '今天读这篇';
        var heroAction = current.started ? '继续精读' : '开始精读';
        var heroProgress = current.percent || 0;
        var heroNote = current.total
          ? (current.lastParagraph > 0 ? '上次读到第 ' + (current.lastParagraph + 1) + ' 段 · 已精读 ' + (current.read || 0) + ' / ' + current.total + ' 段' : '已精读 ' + (current.read || 0) + ' / ' + current.total + ' 段')
          : '尚未开始';
        hero =
          '<div class="home-eyebrow">' + heroLabel + '</div>' +
          '<h1 class="home-title"><a href="' + escapeHtml(current.url) + '" style="color:inherit;text-decoration:none">' +
            escapeHtml(current.title) + '</a></h1>' +
          '<div class="home-meta">' + escapeHtml(heroNote) + '</div>' +
          '<div class="home-progress"><div class="home-track"><div class="home-fill" style="width:' + heroProgress + '%"></div></div><span>' +
            heroProgress + '%</span></div>' +
          '<div class="home-actions"><a class="btn btn-primary" href="' + escapeHtml(readingHref(current, true)) + '">' +
            heroAction + '</a><a class="btn" href="' + escapeHtml(current.url + '?focus=1') + '">单句精读</a>' +
            '<a class="btn" href="' + escapeHtml(current.url) + '">打开学习包</a></div>';
      } else if (todayReading && todayReading.finished) {
        hero =
          '<div class="home-eyebrow">今日精读完成</div>' +
          '<h1 class="home-title">' + escapeHtml(todayReading.title) + '</h1>' +
          '<div class="home-meta">已读 ' + todayReading.read + ' / ' + todayReading.total + ' 段' +
            (result.streak ? ' · 连续 ' + result.streak + ' 天' : '') + '</div>' +
          '<div class="home-actions"><a class="btn" href="' + escapeHtml(todayReading.url) + '">重读</a>' +
            '<a class="btn" href="' + escapeHtml(todayReading.url + '?focus=1') + '">单句精读</a>' +
            '<button class="btn" data-go-tab="review">去复习</button>' +
            '<button class="btn" data-go-tab="packs">看学习包</button></div>';
      } else if (article.suggestion) {
        hero =
          '<div class="home-eyebrow">今天读什么</div>' +
          '<h1 class="home-title">' + escapeHtml(article.suggestion.articleTitle) + '</h1>' +
          '<div class="home-meta">' + escapeHtml(article.suggestion.resourceTitle) + ' · ' +
            article.suggestion.wordCount + ' 词 · 还没有生成学习包</div>' +
          '<div class="home-actions"><a class="btn btn-primary" href="' + escapeHtml(articleHref) + '">去生成这篇</a>' +
            '<button class="btn" data-go-tab="import">导入新材料</button></div>';
      } else {
        hero =
          '<div class="home-eyebrow">今天读什么</div>' +
          '<h1 class="home-title">还没有待读文章</h1>' +
          '<div class="home-meta">导入一篇英文文章，生成学习包后就可以开始精读。</div>' +
          '<div class="home-actions"><button class="btn btn-primary" data-go-tab="import">导入材料</button></div>';
      }
      els.homeHero.innerHTML = hero;
      if (els.reviewRetention && typeof result.desiredRetention === 'number') {
        els.reviewRetention.value = result.desiredRetention.toFixed(2);
        syncCustomSelect(els.reviewRetention);
      }
      if (els.firstAccuracy) {
        var firstReviewed = Number(result.stats && result.stats.firstReviewed || 0);
        var firstAccuracy = Number(result.stats && result.stats.firstAccuracy || 0);
        els.firstAccuracy.textContent = firstReviewed
          ? '首次正确率 ' + Math.round(firstAccuracy * 100) + '% · ' + firstReviewed + ' 项'
          : '还没有首次作答记录';
      }

      var readingBody;
      var readingAction = '';
      if (article.done) {
        readingBody = '精读完成：<a href="' + escapeHtml(article.url || '#') + '">' +
          escapeHtml(article.title || '学习包') + '</a>';
        readingAction = '<a class="btn" href="' + escapeHtml(article.url || '#') + '">重读</a>';
      } else if (article.title && article.url) {
        readingBody = '精读：<a href="' + escapeHtml(article.url) + '">' + escapeHtml(article.title) + '</a>';
        if (todayReading) {
          readingBody += '（' + todayReading.read + ' / ' + todayReading.total + ' 段）';
        }
        readingAction = '<a class="btn" href="' + escapeHtml(readingHref(todayReading, true)) + '">' +
          (todayReading && todayReading.started ? '继续' : '开始') + '精读</a>';
      } else if (current) {
        readingBody = '继续精读：<a href="' + escapeHtml(current.url) + '">' + escapeHtml(current.title) + '</a>（' +
          (current.read || 0) + ' / ' + current.total + ' 段）';
        readingAction = '<a class="btn" href="' + escapeHtml(readingHref(current, true)) + '">继续</a>';
      } else if (article.suggestion) {
        readingBody = '今天读：<b>' + escapeHtml(article.suggestion.articleTitle) + '</b>（' +
          article.suggestion.wordCount + ' 词），还没有生成学习包。';
        readingAction = '<a class="btn" href="' + escapeHtml(articleHref) + '">去生成</a>';
      } else {
        readingBody = '还没有待读文章，导入一份新材料。';
        readingAction = '<button class="btn" data-go-tab="import">导入</button>';
      }

      var outputBody;
      if (output.done) {
        outputBody = '输出已完成' +
          (output.text
            ? '<div class="today-output-text">' + escapeHtml(output.text) + '</div>'
            : '') +
          (output.answer
            ? '<div class="today-output-prompt"><details><summary>看看参考回答</summary>' +
              escapeHtml(output.answer) + '</details></div>'
            : '');
      } else if (output.prompt) {
        outputBody = '用今天的文章写 3 句英文' +
          '<div class="today-output-prompt">' + escapeHtml(output.prompt) + '</div>' +
          '<textarea class="today-output-input" id="today-output-text" placeholder="Write 3 sentences in English…"></textarea>';
      } else {
        outputBody = '精读完成后，这里会出现今天的思考题。';
      }
      var outputAction = !output.done && output.prompt
        ? '<button class="btn btn-primary" id="today-output-save">保存输出</button>'
        : '';

      var reviewText = review.done
        ? '今日学习完成 · ' + (review.dueAtStart || 0) + ' 个'
        : '复习 ' + (review.dueTarget ?? review.remaining ?? 0) + ' 个到期 + ' +
          (review.newTarget ?? review.newLimit ?? 10) + ' 个新词（约 5 分钟）';
      if (review.backlog) {
        reviewText += ' · 待学 ' + review.backlog + ' 个（每天释放 10 个）';
      }
      var reviewAction = review.done
        ? ''
        : '<button class="btn" data-go-tab="review">去复习</button>';

      els.todayPlan.innerHTML =
        '<div class="today-head"><strong>今日三件事</strong><span class="today-streak">' +
          (result.streak ? '连续 ' + result.streak + ' 天' : '从今天开始') + '</span></div>' +
        '<div class="today-steps">' +
          '<div class="today-step' + (article.done ? ' done' : '') + '">' +
            '<span class="tick">' + (article.done ? '✓' : '1') + '</span>' +
            '<div class="today-step-body">' + readingBody + '</div>' + readingAction +
          '</div>' +
          '<div class="today-step' + (output.done ? ' done' : '') + '">' +
            '<span class="tick">' + (output.done ? '✓' : '2') + '</span>' +
            '<div class="today-step-body">' + outputBody + '</div>' + outputAction +
          '</div>' +
          '<div class="today-step' + (review.done ? ' done' : '') + '">' +
            '<span class="tick">' + (review.done ? '✓' : '3') + '</span>' +
            '<div class="today-step-body">' + reviewText + '</div>' + reviewAction +
          '</div>' +
        '</div>' +
        (result.completed ? '<div class="today-complete">今天读完了，连续 ' + result.streak + ' 天。</div>' : '');
      els.todayPlan.hidden = false;

      els.homeRecent.innerHTML = '<h2>最近精读</h2>' + (recent.length
        ? recent.map(function (card) {
            var note = card.finished
              ? '已完成'
              : (card.started ? (card.read + ' / ' + card.total + ' 段') : '未开始');
            return '<div class="home-recent-row"><a href="' + escapeHtml(readingHref(card, true)) + '">' +
              escapeHtml(card.title) + '</a><span class="mini-progress">' + escapeHtml(note) + '</span></div>';
          }).join('')
        : '<div class="muted">还没有精读记录。生成一篇学习包，开始第一次精读。</div>');

      var sentenceDue = review.sentenceDue || 0;
      els.homeReview.innerHTML = '<h2>复习</h2>' +
        '<div class="home-review-line"><strong>' + (review.remaining || 0) + '</strong>' +
          '<span class="muted">待复习</span></div>' +
        '<div class="muted">今天已复习 ' + (review.reviewed || 0) + ' 个' +
          (review.dueTarget ? ' · ' + review.dueTarget + ' 个到期' : '') +
          (review.newTarget ? ' · ' + review.newTarget + ' 个新词' : '') +
          (review.backlog ? ' · 待学 ' + review.backlog + ' 个' : '') +
          (sentenceDue ? ' · 其中句子卡 ' + sentenceDue + ' 张' : '') + '</div>' +
        '<div class="home-review-actions"><button class="btn' + (review.done ? '' : ' btn-primary') +
          '" data-go-tab="review">' + (review.done ? '再看一眼' : '开始复习') + '</button>' +
          (sentenceDue ? '<button class="btn" data-sentence-review="1">只复习句子卡</button>' : '') +
        '</div>';

      var outputs = result.outputs || [];
      els.homeOutputs.innerHTML = '<h2>最近输出</h2>' + (outputs.length
        ? outputs.map(function (entry) {
            var preview = String(entry.text || '').replace(/\\s+/g, ' ').trim();
            if (preview.length > 80) preview = preview.slice(0, 77) + '…';
            var revisions = (entry.revisions || []).map(function (revision, index) {
              return '<div class="output-revision"><div class="output-meta">第 ' + (index + 1) + ' 版 · ' +
                escapeHtml(String(revision.createdAt || '').slice(0, 10)) + '</div>' +
                '<div class="output-text">' + escapeHtml(revision.text) + '</div>' +
                (revision.feedback
                  ? editorFeedbackHtml(revision.feedback)
                  : '<button class="link-button" data-output-revision-feedback="' + escapeHtml(revision.id) +
                    '" data-output-id="' + escapeHtml(entry.id) + '">让编辑看看这版</button>') +
                '</div>';
            }).join('');
            var latest = entry.revisions && entry.revisions.length
              ? entry.revisions[entry.revisions.length - 1].text
              : entry.text;
            var reviseForm = '<details class="output-revise"><summary>改写一版</summary>' +
              '<textarea id="output-revision-' + escapeHtml(entry.id) + '">' + escapeHtml(latest) + '</textarea>' +
              '<button class="btn small" type="button" data-output-revision-save="' + escapeHtml(entry.id) + '">保存这一版</button>' +
              '</details>';
            return '<div class="output-entry"><div class="output-meta">' + escapeHtml(entry.date) +
              (entry.articleTitle ? ' · ' + escapeHtml(entry.articleTitle) : '') + '</div>' +
              '<details' + (entry.feedback || revisions ? ' open' : '') + '><summary>' + escapeHtml(preview) + '</summary>' +
                '<div class="output-text">' + escapeHtml(entry.text) + '</div>' +
                (entry.answer ? '<details><summary>参考回答</summary><div class="output-text">' +
                  escapeHtml(entry.answer) + '</div></details>' : '') +
                (entry.feedback
                  ? editorFeedbackHtml(entry.feedback)
                  : '<button class="link-button" data-output-feedback="' + escapeHtml(entry.id) + '">让编辑看看</button>') +
                revisions + reviseForm +
              '</details></div>';
          }).join('')
        : '<div class="muted">还没有输出记录。精读完成后写下三句英文，会保存在这里。</div>');

      renderStats();
      var outputSave = document.getElementById('today-output-save');
      if (outputSave) {
        outputSave.addEventListener('click', function () {
          var input = document.getElementById('today-output-text');
          var text = input ? input.value.trim() : '';
          if (!text) {
            toast('先写下三句英文');
            if (input) input.focus();
            return;
          }
          outputSave.disabled = true;
          outputSave.textContent = '保存中…';
          api('/api/today/output', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: text })
          }).then(function () {
            toast('输出已保存');
            loadPlan();
          }).catch(function (error) {
            outputSave.disabled = false;
            outputSave.textContent = '保存输出';
            toast('保存失败：' + error.message);
          });
        });
      }
    }).catch(function (error) {
      els.homeHero.innerHTML = '<div class="home-eyebrow">今日</div><h1 class="home-title">暂时无法加载</h1>' +
        '<div class="home-meta">' + escapeHtml(error.message) + '</div>';
      els.todayPlan.hidden = true;
    });
  }

  function renderEmpty(title, subtitle, actionLabel, actionTab, actionAttrs) {
    var attrs = actionAttrs || (actionTab ? 'data-go-tab="' + escapeHtml(actionTab) + '"' : '');
    var action = actionLabel && attrs
      ? '<button class="btn btn-primary" ' + attrs + ' style="margin-top:16px">' + escapeHtml(actionLabel) + '</button>'
      : '';
    els.reviewArea.innerHTML =
      '<div class="card"><div class="empty"><strong>' + escapeHtml(title) + '</strong>' +
      escapeHtml(subtitle) + action + '</div></div>';
    els.progress.textContent = title;
    els.queueLabel.textContent = '';
  }

  function normalizeAnswer(value) {
    return String(value || '').toLowerCase().replace(/[^a-z' -]/g, '').replace(/\\s+/g, ' ').trim();
  }

  function clozeSentence(context, lemma) {
    var word = String(lemma || '').trim();
    if (!word || !context) return context;
    var parts = word.split(/\\s+/);
    var variants = [word];
    if (parts.length === 1) {
      if (/[^aeiou]y$/.test(word)) variants.push(word.slice(0, -1) + 'ies');
      variants.push(word + 's', word + 'es', word + 'ed', word + 'ing');
      if (/e$/.test(word)) variants.push(word.slice(0, -1) + 'ing', word.slice(0, -1) + 'ed');
      if (/[^aeiou][aeiou][bcdfgklmnprstvz]$/.test(word)) {
        variants.push(word + word.slice(-1) + 'ed', word + word.slice(-1) + 'ing');
      }
    } else {
      var tail = parts.slice(1).join(' ');
      var head = parts[0];
      variants.push(head + 's ' + tail, head + 'ing ' + tail, head + 'ed ' + tail);
    }
    var escaped = variants
      .sort(function (a, b) { return b.length - a.length; })
      .map(function (variant) {
        return variant.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\s+/g, '\\\\s+');
      });
    var matcher = new RegExp('\\\\b(?:' + escaped.join('|') + ')\\\\b', 'gi');
    if (!matcher.test(context)) return context;
    return context.replace(matcher, '______');
  }

  function relationBlock(item) {
    var relations = item.relations || {};
    var groups = [
      ['synonyms', '近义'],
      ['antonyms', '反义'],
      ['confusables', '易混'],
      ['wordFamily', '词族']
    ];
    var parts = [];
    groups.forEach(function (group) {
      var values = relations[group[0]] || [];
      if (values.length) {
        parts.push('<span><b>' + group[1] + '</b>' + values.slice(0, 6).map(escapeHtml).join('、') + '</span>');
      }
    });
    return parts.length ? '<div class="relations">' + parts.join('') + '</div>' : '';
  }

  function formationBlock(item) {
    var formation = item.wordFormation;
    if (!formation) return '';
    var groups = [['roots', '词根'], ['prefixes', '前缀'], ['suffixes', '后缀']];
    var lines = [];
    groups.forEach(function (group) {
      var parts = formation[group[0]] || [];
      if (parts.length) {
        lines.push('<b>' + group[1] + '</b> ' + parts.map(function (part) {
          return escapeHtml(part.form) + ' ' + escapeHtml(part.meaning);
        }).join(' · '));
      }
    });
    return lines.length ? '<div class="formation">' + lines.join('<br>') + '</div>' : '';
  }

  function speak() {
    if (!state.current) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      toast('当前浏览器不支持发音');
      return;
    }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(state.current.lemma);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function answerVariants(lemma) {
    var base = normalizeAnswer(lemma);
    if (!base) return [];
    var values = [base];
    if (base.indexOf(' ') === -1) {
      if (/[^aeiou]y$/.test(base)) values.push(base.slice(0, -1) + 'ies');
      values.push(base + 's', base + 'es', base + 'ed', base + 'ing');
      if (/e$/.test(base)) values.push(base.slice(0, -1) + 'ing', base.slice(0, -1) + 'ed');
    }
    return values;
  }

  function checkPractice() {
    var input = document.getElementById('practice-input');
    var feedback = document.getElementById('practice-feedback');
    if (!input || !feedback || !state.current) return;
    var actual = normalizeAnswer(input.value);
    if (!actual) {
      feedback.className = 'practice-feedback bad';
      feedback.textContent = '先输入你记得的拼写。';
      input.focus();
      return;
    }
    if (answerVariants(state.current.lemma).indexOf(actual) !== -1) {
      feedback.className = 'practice-feedback ok';
      feedback.textContent = '拼写正确，已显示完整卡片。';
      reveal();
    } else {
      feedback.className = 'practice-feedback bad';
      feedback.textContent = '还不对，再看一眼语境。';
      input.select();
    }
  }

  function sentenceScore(actual, target) {
    var stop = new Set('a an the and or but if because as at by for from in into of on onto to with without is are was were be been has have had do does did will would can could should may might not no it its this that these those he she they we you i his her their our your my me him them us'.split(' '));
    var wanted = String(target || '').toLowerCase().match(/[a-z][a-z'’-]*/g) || [];
    var got = new Set(String(actual || '').toLowerCase().match(/[a-z][a-z'’-]*/g) || []);
    var content = wanted.filter(function (token) { return !stop.has(token); });
    if (content.length === 0) return 1;
    var hits = content.filter(function (token) { return got.has(token); }).length;
    return hits / content.length;
  }

  function checkSentence() {
    var input = document.getElementById('sentence-input');
    var feedback = document.getElementById('sentence-feedback');
    if (!input || !feedback || !state.current || !state.current.sentence) return;
    var actual = normalizeAnswer(input.value);
    if (!actual) {
      feedback.className = 'sentence-feedback bad';
      feedback.textContent = '先写下你的英文回译。';
      input.focus();
      return;
    }
    var score = sentenceScore(actual, state.current.sentence.original);
    if (score >= 0.6) {
      feedback.className = 'sentence-feedback ok';
      feedback.textContent = '和原文关键信息吻合度 ' + Math.round(score * 100) + '%，已显示参考答案。';
      reveal();
    } else if (score >= 0.35) {
      feedback.className = 'sentence-feedback bad';
      feedback.textContent = '意思接近了（' + Math.round(score * 100) + '%），但结构或关键词还差一点。可以再改一版，或点显示答案对照。';
    } else {
      feedback.className = 'sentence-feedback bad';
      feedback.textContent = '先再试一次；需要时点「显示答案」对照原句。';
    }
  }

  function renderSentenceReview(item) {
    var sentence = item.sentence;
    state.revealed = false;
    els.progress.textContent = '剩余 ' + state.queue.length + ' 个学习项';
    els.queueLabel.textContent = '句子卡 · ' + (item.sourceRef || '精读文章');
    var chunks = (sentence.chunks || []).map(function (chunk) {
      return '<div class="chunk"><b>' + escapeHtml(chunk.role) + '</b>' + escapeHtml(chunk.text) +
        (chunk.meaning ? '<i>' + escapeHtml(chunk.meaning) + '</i>' : '') + '</div>';
    }).join('');
    var variants = (sentence.variants || []).map(function (variant) {
      return '<li>' + escapeHtml(variant) + '</li>';
    }).join('');
    els.reviewArea.innerHTML =
      '<div class="card" id="review-card">' +
        '<div class="card-top">' +
          '<div>' +
            '<div class="sentence-eyebrow">句子卡 · 回译</div>' +
            '<div class="sentence-title">把这句话译回英文</div>' +
          '</div>' +
          '<button class="star ' + (item.favorite ? 'active' : '') + '" id="star">★</button>' +
        '</div>' +
        (sentence.stale ? '<div class="sentence-feedback bad">来源段落已修改，这句可能已过时；建议重新选句生成。</div>' : '') +
        '<div class="context sentence-prompt">' + escapeHtml(sentence.translation) +
          (sentence.pattern ? '<span class="translation">提示：' + escapeHtml(sentence.pattern) + '</span>' : '') +
        '</div>' +
        (item.leech ? '<div class="leech-hint">这张句子卡已经遗忘 ' + (item.lapses || 0) + ' 次。建议先暂停，或重新选一句更典型的原文。</div>' : '') +
        '<div class="practice">' +
          '<div class="practice-label">先自己写，再看原文。系统只做关键词对照，不评判表达好坏。</div>' +
          '<div class="practice-row">' +
            '<textarea id="sentence-input" placeholder="Write the sentence in English…"></textarea>' +
          '</div>' +
          '<div class="practice-row" style="margin-top:8px">' +
            '<button class="btn" id="sentence-check" type="button">对照原文</button>' +
          '</div>' +
          '<div class="sentence-feedback" id="sentence-feedback"></div>' +
        '</div>' +
        '<div class="answer">' +
          '<p class="sense">原文</p>' +
          '<div class="sentence-answer-original">' + escapeHtml(sentence.original) + '</div>' +
          '<button class="btn" id="sentence-speak" type="button" style="margin-bottom:10px">朗读原句</button>' +
          (chunks ? '<div class="sentence-chunks">' + chunks + '</div>' : '') +
          (sentence.pattern ? '<div class="sentence-pattern"><b>句型</b>' + escapeHtml(sentence.pattern) + '</div>' : '') +
          (sentence.grammar ? '<div class="sentence-grammar">' + escapeHtml(sentence.grammar) + '</div>' : '') +
          (variants ? '<div class="sentence-pattern"><b>替换</b></div><ul class="sentence-variants">' + variants + '</ul>' : '') +
          (sentence.why ? '<p class="memory-hook">' + escapeHtml(sentence.why) + '</p>' : '') +
          '<div class="source">' + escapeHtml(item.sourceRef) +
            (item.sourcePack ? ' · <a class="source-link" href="' + escapeHtml(item.sourcePack.url) + '">打开来源</a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" id="reveal">显示答案</button>' +
          '<button class="btn" id="known">标记已掌握</button>' +
          '<button class="btn" id="suspend">暂停</button>' +
        '</div>' +
        '<div class="ratings" style="margin-top:10px">' +
          '<button class="rating" data-r="1">Again<small>1</small></button>' +
          '<button class="rating" data-r="2">Hard<small>2</small></button>' +
          '<button class="rating" data-r="3">Good<small>3</small></button>' +
          '<button class="rating" data-r="4">Easy<small>4</small></button>' +
        '</div>' +
      '</div>';
    document.getElementById('reveal').addEventListener('click', reveal);
    document.getElementById('star').addEventListener('click', toggleFavorite);
    document.getElementById('known').addEventListener('click', function () { setStatus('known'); });
    document.getElementById('suspend').addEventListener('click', function () { setStatus('suspended'); });
    document.getElementById('sentence-check').addEventListener('click', checkSentence);
    document.getElementById('sentence-speak').addEventListener('click', function () {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        toast('当前浏览器不支持发音');
        return;
      }
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(sentence.original);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    });
    var input = document.getElementById('sentence-input');
    input.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        checkSentence();
      }
    });
    input.focus();
    document.querySelectorAll('.rating').forEach(function (button) {
      button.addEventListener('click', function () {
        rate(Number(button.getAttribute('data-r')));
      });
    });
  }

  function renderCurrent() {
    var item = state.current;
    if (!item) {
      renderEmpty('今天的复习完成了', '回到今日精读，或者明天再来。', '回到今日', 'home');
      return;
    }
    if (item.type === 'sentence' && item.sentence) {
      renderSentenceReview(item);
      return;
    }
    state.revealed = false;
    els.progress.textContent = '剩余 ' + state.queue.length + ' 个学习项';
    els.queueLabel.textContent = (item.contextKind === 'example' ? '词书例句 · ' : '来源：') + item.sourceRef;

    var examples = (item.examples || []).map(function (example) {
      return '<li>' + escapeHtml(example) + '</li>';
    }).join('');
    var chips = (item.collocations || []).map(function (collocation) {
      return '<span class="chip">' + escapeHtml(collocation) + '</span>';
    }).join('');
    var masked = clozeSentence(item.context, item.lemma);
    var clozeMode = masked !== item.context;
    var contextHtml = clozeMode
      ? '<span class="context-masked">' + escapeHtml(masked) + '</span>' +
        '<span class="context-full">' + escapeHtml(item.context) + '</span>'
      : escapeHtml(item.context);
    var wordHtml = clozeMode
      ? '<span class="word-masked">••••••</span><span class="word-full">' + escapeHtml(item.lemma) + '</span>'
      : escapeHtml(item.lemma);
    var practiceHtml = clozeMode
      ? '<div class="practice">' +
          '<div class="practice-label">先别看答案：根据语境补全这个词，或直接拼写。</div>' +
          '<div class="practice-row">' +
            '<input id="practice-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词或短语，回车检查">' +
            '<button class="btn" id="practice-check" type="button">检查</button>' +
          '</div>' +
          '<div class="practice-feedback" id="practice-feedback"></div>' +
        '</div>'
      : '';

    els.reviewArea.innerHTML =
      '<div class="card" id="review-card">' +
        '<div class="card-top">' +
          '<div>' +
            '<div class="word-prompt">这个语境里的词是？</div>' +
        '<div class="word">' + wordHtml +
              (item.ipa ? '<span class="ipa">' + escapeHtml(item.ipa) + '</span>' : '') +
              '<button class="btn speak-btn" id="speak" type="button">发音</button></div>' +
            '<div class="badges">' +
              (item.pos ? '<span class="badge badge-pos">' + escapeHtml(item.pos) + '</span>' : '') +
              (item.cefr ? '<span class="badge badge-cefr">' + escapeHtml(item.cefr) + '</span>' : '') +
              '<span class="badge">' + escapeHtml(item.state) + '</span>' +
              (item.leech ? '<span class="badge leech">易忘</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="star ' + (item.favorite ? 'active' : '') + '" id="star">★</button>' +
        '</div>' +
        '<div class="context">' + contextHtml +
          (item.translation ? '<span class="translation">' + escapeHtml(item.translation) + '</span>' : '') +
        '</div>' +
        (item.leech ? '<div class="leech-hint">这张卡已经遗忘 ' + (item.lapses || 0) + ' 次。建议先暂停，或回原文把它改写成更具体的卡。</div>' : '') +
        practiceHtml +
        '<div class="answer">' +
          (item.sense !== item.definition ? '<p class="sense">' + escapeHtml(item.sense) + '</p>' : '') +
          '<p class="definition">' + escapeHtml(item.definition) + '</p>' +
          (item.definitionZh ? '<p class="definition-zh">' + escapeHtml(item.definitionZh) + '</p>' : '') +
          (item.memoryHook ? '<p class="memory-hook">' + escapeHtml(item.memoryHook) + '</p>' : '') +
          (chips ? '<div class="chips">' + chips + '</div>' : '') +
          formationBlock(item) +
          (examples ? '<ul class="examples">' + examples + '</ul>' : '') +
          relationBlock(item) +
          (item.notes ? '<div class="hint" style="text-align:left;margin-top:10px">' + escapeHtml(item.notes) + '</div>' : '') +
          '<div class="source">' + escapeHtml(item.sourceRef) +
            (item.contexts > 1 ? ' · 另有 ' + (item.contexts - 1) + ' 个语境' : '') +
            (item.sourcePack ? ' · <a class="source-link" href="' + escapeHtml(item.sourcePack.url) + '">打开来源</a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" id="reveal">显示答案</button>' +
          '<button class="btn" id="nuance-open" type="button">🕵️ 语境侦探</button>' +
          '<button class="btn" id="known">标记已掌握</button>' +
          '<button class="btn" id="suspend">暂停</button>' +
        '</div>' +
        '<div class="ratings" style="margin-top:10px">' +
          '<button class="rating" data-r="1">Again<small>1</small></button>' +
          '<button class="rating" data-r="2">Hard<small>2</small></button>' +
          '<button class="rating" data-r="3">Good<small>3</small></button>' +
          '<button class="rating" data-r="4">Easy<small>4</small></button>' +
        '</div>' +
      '</div>';

    document.getElementById('reveal').addEventListener('click', reveal);
    document.getElementById('speak').addEventListener('click', speak);
    document.getElementById('star').addEventListener('click', toggleFavorite);
    var nuanceOpen = document.getElementById('nuance-open');
    if (nuanceOpen) nuanceOpen.addEventListener('click', function () { openNuance(state.current); });
    document.getElementById('known').addEventListener('click', function () { setStatus('known'); });
    document.getElementById('suspend').addEventListener('click', function () { setStatus('suspended'); });
    var practiceCheck = document.getElementById('practice-check');
    if (practiceCheck) practiceCheck.addEventListener('click', checkPractice);
    var practiceInput = document.getElementById('practice-input');
    if (practiceInput) {
      practiceInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          checkPractice();
        }
      });
      practiceInput.focus();
    }
    document.querySelectorAll('.rating').forEach(function (button) {
      button.addEventListener('click', function () {
        rate(Number(button.getAttribute('data-r')));
      });
    });
  }

  function reveal() {
    var card = document.getElementById('review-card');
    if (!card) return;
    state.revealed = !state.revealed;
    card.classList.toggle('revealed', state.revealed);
    var button = document.getElementById('reveal');
    if (button) button.textContent = state.revealed ? '隐藏答案' : '显示答案';
    var input = document.getElementById('practice-input');
    if (state.revealed && input && document.activeElement === input) input.blur();
    var sentenceInput = document.getElementById('sentence-input');
    if (state.revealed && sentenceInput && document.activeElement === sentenceInput) sentenceInput.blur();
  }

  function nextItem() {
    if (state.packFilter && state.packDue > 0) state.packDue -= 1;
    if (state.wordFilter && state.wordFilterDue > 0) state.wordFilterDue -= 1;
    state.current = state.queue.shift() || null;
    renderPackFilter();
    renderCurrent();
    loadPlan();
  }

  function showUndo(visible) {
    state.canUndo = visible;
    if (!els.undoReview) return;
    els.undoReview.hidden = !visible;
    els.undoReview.disabled = !visible;
  }

  function undoReview() {
    if (!state.canUndo) return;
    if (els.undoReview) els.undoReview.disabled = true;
    api('/api/review/undo', { method: 'POST' }).then(function (result) {
      state.stats = result.summary || state.stats;
      renderStats();
      showUndo(false);
      state.current = null;
      state.revealed = false;
      state.queue = [];
      toast('已撤销：' + result.item.lemma);
      loadForecast();
      loadPlan().then(function () { loadQueue(); });
    }).catch(function (error) {
      showUndo(false);
      toast('撤销失败：' + error.message);
    });
  }

  function loadForecast() {
    var host = document.getElementById('review-forecast');
    if (!host) return;
    api('/api/forecast').then(function (data) {
      var days = data.days || [];
      if (!days.length) {
        host.hidden = true;
        return;
      }
      var max = 1;
      days.forEach(function (day) { max = Math.max(max, day.due || 0); });
      host.hidden = false;
      host.innerHTML = '<span class="forecast-title">未来 7 天<br>复习负载</span>' +
        '<div class="forecast-days">' + days.map(function (day, index) {
          var height = Math.max(3, Math.round(((day.due || 0) / max) * 34));
          var label = String(day.date || '').slice(5).replace('-', '/');
          return '<div class="forecast-day' + (index === 0 ? ' is-today' : '') + '">' +
            '<span class="forecast-bar" style="height:' + height + 'px"></span>' +
            '<b>' + escapeHtml(label) + '</b><small>' + (day.due || 0) + '</small></div>';
        }).join('') + '</div>' +
        (data.overdue ? '<span class="forecast-overdue">含逾期 ' + data.overdue + '</span>' : '');
    }).catch(function () {
      host.hidden = true;
    });
  }

  function rate(rating) {
    if (!state.current) return;
    api('/api/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: state.current.id, rating: rating })
    }).then(function (result) {
      state.stats = result.summary;
      renderStats();
      toast('已记录：' + rating);
      showUndo(true);
      nextItem();
      loadForecast();
    }).catch(function (error) { toast('评分失败：' + error.message); });
  }

  function toggleFavorite() {
    if (!state.current) return;
    var next = !state.current.favorite;
    api('/api/favorite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: state.current.id, favorite: next })
    }).then(function (result) {
      state.current.favorite = next;
      state.stats = result.summary;
      renderStats();
      var star = document.getElementById('star');
      if (star) star.classList.toggle('active', next);
      toast(next ? '已收藏' : '已取消收藏');
    }).catch(function (error) { toast('操作失败：' + error.message); });
  }

  function setStatus(status) {
    if (!state.current) return;
    api('/api/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: state.current.id, status: status })
    }).then(function (result) {
      state.stats = result.summary;
      renderStats();
      toast(status === 'known' ? '已标记为掌握' : '已暂停');
      showUndo(false);
      nextItem();
    }).catch(function (error) { toast('操作失败：' + error.message); });
  }

  function renderPackFilter() {
    if ((!state.packFilter && !state.wordFilter) || (!state.packTitle && !state.wordFilterLabel)) {
      els.packFilter.hidden = true;
      return;
    }
    els.packFilter.hidden = false;
    els.packFilterLabel.textContent = state.wordFilter
      ? '复习范围：' + state.wordFilterLabel + ' · ' + state.wordFilterDue + ' 个到期'
      : '复习范围：' + state.packTitle + ' · ' + state.packDue + ' 个到期';
  }

  function updateUrl(push) {
    var params = new URLSearchParams();
    if (state.tab !== 'home') params.set('tab', state.tab);
    if (state.packFilter) params.set('pack', state.packFilter);
    if (state.wordFilter) {
      params.set('words', state.wordFilter);
      params.set('label', state.wordFilterLabel);
    }
    if (state.tab === 'import' && state.importArticlesView && state.importResource) {
      params.set('resource', state.importResource);
      params.set('articles', '1');
      if (state.importArticle !== null) params.set('article', String(state.importArticle));
    }
    var query = params.toString();
    var url = query ? '/?' + query : '/';
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }

  function updateReviewMode() {
    var button = document.getElementById('review-sentence-only');
    if (!button) return;
    var active = state.typeFilter === 'sentence';
    button.textContent = active ? '显示全部到期' : '只复习句子卡';
    button.classList.toggle('active', active);
  }

  function setSentenceOnlyReview(on) {
    state.typeFilter = on ? 'sentence' : null;
    state.current = null;
    state.queue = [];
    updateReviewMode();
    loadQueue();
  }

  function clearPackFilter() {
    state.packFilter = null;
    state.packTitle = '';
    state.packDue = 0;
    state.wordFilter = null;
    state.wordFilterLabel = '';
    state.wordFilterDue = 0;
    els.packFilter.hidden = true;
    updateUrl();
    loadQueue();
  }

  function loadQueue() {
    var params = new URLSearchParams();
    params.set('limit', '40');
    params.set('newLimit', String(state.reviewNewLimit || 10));
    params.set('reviewLimit', '10');
    params.set('scope', state.reviewScope || 'all');
    if (state.reviewBook) params.set('book', state.reviewBook);
    if (state.packFilter) params.set('pack', state.packFilter);
    if (state.typeFilter) params.set('type', state.typeFilter);
    if (state.wordFilter) {
      params.set('words', state.wordFilter);
      params.set('label', state.wordFilterLabel);
    }
    var queueUrl = '/api/queue?' + params.toString();
    api(queueUrl).then(function (result) {
      state.queue = result.items || [];
      state.stats = result.summary;
      var budget = result.budget || {};
      var budgetHost = document.getElementById('review-budget');
      if (budgetHost) {
        budgetHost.innerHTML = '今天：<strong>' + (budget.dueShown ?? budget.dueLimit ?? 0) + '</strong> 个到期 + <strong>' +
          (budget.newShown ?? budget.newLimit ?? 0) + '</strong> 个新词 · 待学 <strong>' + (budget.backlog || 0) + '</strong>' +
          (state.reviewBook ? ' · 已按词书筛选' : '');
      }
      if (result.pack) {
        state.packTitle = result.pack.title;
        state.packDue = result.pack.due;
      } else if (!state.packFilter) {
        state.packTitle = '';
        state.packDue = 0;
      }
      if (result.words) {
        state.wordFilterLabel = result.words.label;
        state.wordFilterDue = result.words.due;
      } else if (!state.wordFilter) {
        state.wordFilterLabel = '';
        state.wordFilterDue = 0;
      }
      renderStats();
      renderPackFilter();
      if (state.queue.length === 0) {
        state.current = null;
        if (state.typeFilter) {
          renderEmpty(
            '句子卡复习完成',
            '今天到期的句子卡已经复习完了，可以回到全部到期词。',
            '查看全部到期',
            undefined,
            'data-clear-type="1"'
          );
        } else if (state.packFilter || state.wordFilter) {
          renderEmpty(
            '这组词的复习完成了',
            '可以查看全部到期，或换一组词。',
            '查看全部到期',
            undefined,
            'data-clear-pack="1"'
          );
        } else {
          renderEmpty('今天的复习完成了', '回到今日精读，或者明天再来。', '回到今日', 'home');
        }
        return;
      }
      state.current = state.queue.shift();
      renderCurrent();
    }).catch(function (error) {
      renderEmpty('无法加载复习队列', error.message);
    });
  }

  function vocabQuery() {
    var params = new URLSearchParams();
    if (state.vocabGroup !== 'all') params.set('group', state.vocabGroup);
    if (state.vocabType !== 'all') params.set('type', state.vocabType);
    if (state.vocabSource) params.set('source', state.vocabSource);
    if (state.vocabCefr) params.set('cefr', state.vocabCefr);
    if (state.vocabBook) params.set('book', state.vocabBook);
    if (state.vocabQuery) params.set('q', state.vocabQuery);
    if (state.vocabSort !== 'due') params.set('sort', state.vocabSort);
    return params.toString();
  }

  function renderVocabStats() {
    var counts = state.vocabCounts || {};
    var host = document.getElementById('vocab-stats');
    if (!host) return;
    host.innerHTML = [
      ['全部词', counts.all || 0],
      ['新词', counts.new || 0],
      ['待学', counts.backlog || 0],
      ['今天到期', counts.due || 0],
      ['易忘', counts.leech || 0]
    ].map(function (entry) {
      return '<div class="vocab-stat"><b>' + entry[1] + '</b><span>' + entry[0] + '</span></div>';
    }).join('');
    document.querySelectorAll('[data-count]').forEach(function (node) {
      node.textContent = String(counts[node.getAttribute('data-count')] || 0);
    });
    var strip = document.getElementById('vocab-quality');
    var missing = Number(counts.missing || 0);
    if (strip) {
      strip.hidden = missing === 0;
      var missingNode = document.getElementById('vocab-missing');
      if (missingNode) missingNode.textContent = String(missing);
    }
  }

  function setCustomSelectOptions(id, options, value) {
    var input = document.getElementById(id);
    if (!input) return;
    var wrap = input.closest('.cselect');
    if (!wrap) return;
    var menu = wrap.querySelector('.cselect-menu');
    if (!menu) return;
    menu.innerHTML = options.map(function (option) {
      return '<button type="button" role="option" class="cselect-option" data-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</button>';
    }).join('');
    input.value = value || '';
    if (wrap._sync) wrap._sync();
  }

  function renderVocabFilters() {
    var source = document.getElementById('vocab-source');
    var cefr = document.getElementById('vocab-cefr');
    var book = document.getElementById('vocab-book');
    if (book) {
      setCustomSelectOptions('vocab-book', [{ value: '', label: '全部词书' }].concat(state.wordbooks.map(function (entry) {
        return { value: entry.id, label: entry.name };
      })), state.vocabBook);
    }
    if (source) {
      setCustomSelectOptions('vocab-source', [{ value: '', label: '全部来源' }].concat(state.vocabSources.map(function (entry) {
        return { value: entry.id, label: entry.title };
      })), state.vocabSource);
    }
    if (cefr) {
      setCustomSelectOptions('vocab-cefr', [{ value: '', label: '全部等级' }].concat(state.vocabCefrs.map(function (entry) {
        return { value: entry, label: entry };
      })), state.vocabCefr);
    }
  }

  function vocabStatusPills(item) {
    var pills = [];
    if (item.staged) pills.push('<span class="vocab-pill">待学</span>');
    else if (item.hasExample === false) pills.push('<span class="vocab-pill missing">无例句</span>');
    else if (item.isNew) pills.push('<span class="vocab-pill new">新词</span>');
    if (item.leech) pills.push('<span class="vocab-pill leech">易忘 ×' + (item.lapses || 0) + '</span>');
    if (item.status === 'known') pills.push('<span class="vocab-pill">已掌握</span>');
    else if (item.status === 'suspended') pills.push('<span class="vocab-pill">已暂停</span>');
    else if (!item.isNew) pills.push('<span class="vocab-pill">' + escapeHtml(item.dueLabel || '') + '</span>');
    if (item.pos) pills.push('<span class="vocab-pill">' + escapeHtml(item.pos) + '</span>');
    if (item.cefr) pills.push('<span class="vocab-pill">' + escapeHtml(item.cefr) + '</span>');
    return pills.join('');
  }

  function vocabCheckMarkup(id) {
    if (!state.vocabSelecting) return '';
    var checked = state.vocabSelected[id] ? ' checked' : '';
    return '<span class="vocab-check" title="选择"><input type="checkbox" data-vocab-select="' +
      escapeHtml(id) + '"' + checked + '></span>';
  }

  function renderSentenceRow(item) {
    var sentence = item.sentence || {};
    var original = sentence.original || item.definition || item.lemma;
    var translation = sentence.translation || item.sense;
    return '<div class="sentence-row' + (state.vocabSelecting && state.vocabSelected[item.id] ? ' is-selected' : '') +
      '" data-vocab-id="' + escapeHtml(item.id) + '" tabindex="0" role="button">' +
      '<div class="sentence-top"><div class="sentence-main"><div class="sentence-meta">' + vocabCheckMarkup(item.id) +
      '<span class="badge">句子卡</span><span class="due">' + escapeHtml(item.dueLabel) + '</span></div>' +
      '<div class="sentence-original">' + escapeHtml(original) + '</div><div class="sentence-zh">' + escapeHtml(translation) + '</div></div>' +
      '<button class="rowstar ' + (item.favorite ? 'active' : '') + '" data-vocab-star="' + escapeHtml(item.id) + '">★</button></div></div>';
  }

  function renderVocabList(items) {
    if (!items.length) {
      els.libraryList.innerHTML = '<div class="vocab-empty"><strong>这个分组还没有词</strong><br>换个分组或来源试试。</div>';
      return;
    }
    els.libraryList.innerHTML = items.map(function (item) {
      if (item.type === 'sentence') return renderSentenceRow(item);
      return '<div class="vocab-row' + (state.vocabSelecting && state.vocabSelected[item.id] ? ' is-selected' : '') +
        '" data-vocab-id="' + escapeHtml(item.id) + '" tabindex="0" role="button">' + vocabCheckMarkup(item.id) +
        '<div class="vocab-main"><div class="vocab-word"><b>' + escapeHtml(item.lemma) + '</b>' +
          (item.ipa ? '<span class="ipa">' + escapeHtml(item.ipa) + '</span>' : '') + '</div>' +
          '<div class="vocab-def">' + escapeHtml(item.definitionZh || item.sense || item.definition) + '</div>' +
          '<div class="vocab-meta">' + vocabStatusPills(item) + '</div></div>' +
        '<div class="vocab-side"><span class="due">' + escapeHtml(item.staged ? '待学' : item.isNew ? '未开始' : item.dueLabel || '') + '</span>' +
          '<button class="rowstar ' + (item.favorite ? 'active' : '') + '" data-vocab-star="' + escapeHtml(item.id) + '">★</button></div></div>';
    }).join('');
    updateVocabSelectBar();
  }

  function selectedVocabIds() {
    return Object.keys(state.vocabSelected).filter(function (id) { return state.vocabSelected[id]; });
  }

  function updateVocabSelectBar() {
    var toggle = document.getElementById('vocab-select-toggle');
    var status = document.getElementById('vocab-select-status');
    var review = document.getElementById('vocab-select-review');
    var clear = document.getElementById('vocab-select-clear');
    var count = selectedVocabIds().length;
    if (toggle) toggle.textContent = state.vocabSelecting ? '退出多选' : '多选';
    if (status) status.textContent = state.vocabSelecting ? (count ? '已选 ' + count + ' 个' : '点词卡选择') : '';
    if (review) review.hidden = !state.vocabSelecting || count === 0;
    if (clear) clear.hidden = !state.vocabSelecting || count === 0;
    ['vocab-bulk-suspend', 'vocab-bulk-known', 'vocab-bulk-active', 'vocab-bulk-favorite'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.hidden = !state.vocabSelecting || count === 0;
    });
  }

  function toggleVocabSelection(id) {
    state.vocabSelected[id] = !state.vocabSelected[id];
    var row = document.querySelector('[data-vocab-id="' + id + '"]');
    if (row) {
      row.classList.toggle('is-selected', Boolean(state.vocabSelected[id]));
      var box = row.querySelector('[data-vocab-select]');
      if (box) box.checked = Boolean(state.vocabSelected[id]);
    }
    updateVocabSelectBar();
  }

  function runBulkAction(action, label, button) {
    var ids = selectedVocabIds();
    if (!ids.length) { toast('先选几个词'); return; }
    if (action === 'known' && !confirm('把这 ' + ids.length + ' 张卡标记为已掌握？')) return;
    setBusy(button, true, '处理中…');
    api('/api/items/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ids, action: action })
    }).then(function (result) {
      toast(label + ' ' + result.count + ' 张卡');
      state.vocabSelected = {};
      state.stats = result.summary || state.stats;
      renderStats();
      loadLibrary();
    }).catch(function (error) {
      toast('操作失败：' + error.message);
    }).finally(function () {
      setBusy(button, false);
    });
  }

  function loadLibrary(append) {
    var params = new URLSearchParams(vocabQuery());
    params.set('limit', '200');
    params.set('offset', append ? String(state.vocabItems.length) : '0');
    return api('/api/vocab?' + params.toString()).then(function (result) {
      state.vocabCounts = result.counts || {};
      state.vocabSources = result.sources || [];
      state.vocabCefrs = result.cefrs || [];
      state.vocabTotal = result.total || 0;
      state.vocabHasMore = result.hasMore === true;
      state.vocabItems = append ? state.vocabItems.concat(result.items || []) : result.items || [];
      renderVocabStats();
      renderVocabFilters();
      renderVocabList(state.vocabItems);
      renderVocabMore();
      loadWordbooks();
    }).catch(function (error) {
      els.libraryList.innerHTML = '<div class="vocab-empty">' + escapeHtml(error.message) + '</div>';
    });
  }

  function renderVocabMore() {
    var host = document.getElementById('vocab-more');
    if (!host) return;
    if (!state.vocabHasMore) {
      host.innerHTML = state.vocabTotal > 200 ? '<span class="small muted">已显示全部 ' + state.vocabTotal + ' 个词</span>' : '';
      return;
    }
    host.innerHTML = '<button class="btn" id="vocab-more-btn" type="button">加载更多（已显示 ' + state.vocabItems.length + ' / ' + state.vocabTotal + '）</button>';
    var button = document.getElementById('vocab-more-btn');
    if (button) button.addEventListener('click', function () { setBusy(button, true, '加载中…'); loadLibrary(true); });
  }

  function speakWord(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      toast('当前浏览器不支持发音。');
      return;
    }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function openVocabDetail(id) {
    api('/api/items/' + encodeURIComponent(id)).then(function (result) {
      state.vocabDetail = result.item;
      renderVocabDetail();
      var drawer = document.getElementById('vocab-detail');
      if (drawer) drawer.hidden = false;
    }).catch(function (error) { toast(error.message); });
  }

  function closeVocabDetail() {
    var drawer = document.getElementById('vocab-detail');
    if (drawer) drawer.hidden = true;
    state.vocabDetail = null;
  }

  function renderVocabDetail() {
    var item = state.vocabDetail;
    var host = document.getElementById('vocab-detail-body');
    if (!host || !item) return;
    if (item.type === 'sentence') {
      var s = item.sentence || {};
      host.innerHTML = '<div class="sentence-meta"><span class="badge">句子卡</span></div>' +
        '<h2 class="detail-lemma" style="font-size:28px;line-height:1.3">' + escapeHtml(s.original || item.lemma) + '</h2>' +
        '<p class="vocab-def" style="font-size:13px">' + escapeHtml(s.translation || item.sense) + '</p>' +
        '<div class="detail-actions"><a class="btn btn-primary" href="/?tab=review&words=' + encodeURIComponent(item.id) + '&label=' + encodeURIComponent('句子卡') + '">复习这张</a>' +
        '<button class="btn" id="detail-speak" type="button">朗读</button></div>' +
        (s.pattern ? '<div class="detail-section"><h3>句型</h3><p>' + escapeHtml(s.pattern) + '</p></div>' : '') +
        (s.grammar ? '<div class="detail-section"><h3>语法</h3><p>' + escapeHtml(s.grammar) + '</p></div>' : '') +
        (s.why ? '<div class="detail-section"><h3>为什么</h3><p>' + escapeHtml(s.why) + '</p></div>' : '');
      var speak = document.getElementById('detail-speak');
      if (speak) speak.addEventListener('click', function () { speakWord(s.original || item.lemma); });
      return;
    }
    var actions = '<button class="btn btn-primary" id="detail-study" type="button">背这个词</button>' +
      '<button class="btn" id="detail-edit" type="button">编辑词卡</button>' +
      '<button class="btn" id="detail-speak-word" type="button">🔊 发音</button>' +
      (!item.context && (!item.examples || !item.examples.length) ? '<button class="btn" id="detail-examples" type="button">生成例句</button>' : '') +
      '<button class="btn" data-detail-graph="' + escapeHtml(item.lemma) + '" type="button">关系图</button>' +
      (!item.wordFormation || relationCount(item) === 0 ? '<button class="btn" data-detail-enrich="' + escapeHtml(item.id) + '" type="button">补全词根/关系</button>' : '') +
      '<button class="btn" id="detail-favorite" type="button">' + (item.favorite ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '<button class="btn" data-detail-status="known" type="button">' + (item.status === 'known' ? '重新学习' : '标记已掌握') + '</button>' +
      '<button class="btn" data-detail-status="active" type="button">恢复学习</button>' +
      '<button class="btn danger" data-detail-status="suspended" type="button">暂停</button>';
    var contexts = (item.contexts || []).map(function (context) {
      return '<div class="context-card">' + escapeHtml(context.sentence) +
        (context.translation ? '<span>' + escapeHtml(context.translation) + '</span>' : '') + '</div>';
    }).join('');
    var examples = (item.examples || []).map(function (example) {
      return '<li>' + escapeHtml(example.text) + '</li>';
    }).join('');
    var relations = [];
    ['synonyms', 'antonyms', 'confusables', 'wordFamily'].forEach(function (key) {
      var values = (item.relations && item.relations[key]) || [];
      if (values.length) relations.push('<p><b>' + ({ synonyms: '近义', antonyms: '反义', confusables: '易混', wordFamily: '词族' }[key]) + '</b> ' + values.map(escapeHtml).join(' · ') + '</p>');
    });
    host.innerHTML = '<h2 class="detail-lemma">' + escapeHtml(item.lemma) + '</h2>' +
      (item.ipa ? '<div class="detail-ipa">' + escapeHtml(item.ipa) + '</div>' : '') +
      '<div class="vocab-meta" style="margin-top:10px">' + vocabStatusPills(item) + '</div>' +
      '<div class="detail-actions">' + actions + '</div>' +
      '<div class="detail-edit-form" id="detail-edit-form" hidden>' +
        '<label>义项<input id="detail-edit-sense" type="text"></label>' +
        '<label>英文释义<textarea id="detail-edit-definition"></textarea></label>' +
        '<label>中文释义<textarea id="detail-edit-zh"></textarea></label>' +
        '<label>记忆钩子<input id="detail-edit-hook" type="text"></label>' +
        '<label>搭配（用逗号分隔）<input id="detail-edit-collocations" type="text"></label>' +
        '<label>笔记<textarea id="detail-edit-notes"></textarea></label>' +
        '<div class="detail-actions"><button class="btn btn-primary" id="detail-edit-save" type="button">保存</button>' +
        '<button class="btn" id="detail-edit-cancel" type="button">取消</button><span class="small muted" id="detail-edit-status"></span></div>' +
      '</div>' +
      '<div class="detail-section"><h3>释义</h3><p>' + escapeHtml(item.sense) + '</p>' +
      '<p class="muted">' + escapeHtml(item.definition) + '</p>' +
      (item.definitionZh ? '<p style="margin-top:6px">' + escapeHtml(item.definitionZh) + '</p>' : '') + '</div>' +
      (contexts ? '<div class="detail-section"><h3>原文语境</h3>' + contexts + '</div>' : '<div class="detail-section"><h3>原文语境</h3><p class="muted">这个词来自词书，还没有原文例句。可以点上面的「生成例句」，或在阅读里遇到它时补充语境。</p></div>') +
      (item.collocations && item.collocations.length ? '<div class="detail-section"><h3>搭配</h3><p>' + item.collocations.map(escapeHtml).join(' · ') + '</p></div>' : '') +
      (examples ? '<div class="detail-section"><h3>例句</h3><ul>' + examples + '</ul></div>' : '') +
      (relations.length ? '<div class="detail-section"><h3>关系</h3>' + relations.join('') + '</div>' : '') +
      (item.wordFormation ? '<div class="detail-section"><h3>词根词缀</h3>' + ['prefixes', 'roots', 'suffixes'].map(function (key) {
        var parts = (item.wordFormation[key] || []);
        if (!parts.length) return '';
        return '<p><b>' + ({ prefixes: '前缀', roots: '词根', suffixes: '后缀' }[key]) + '</b> ' +
          parts.map(function (part) { return escapeHtml(part.form) + ' ' + escapeHtml(part.meaning); }).join(' · ') + '</p>';
      }).join('') + '</div>' : '') +
      (item.memoryHook ? '<div class="detail-section"><h3>记忆钩子</h3><p>' + escapeHtml(item.memoryHook) + '</p></div>' : '') +
      (item.notes ? '<div class="detail-section"><h3>笔记</h3><p>' + escapeHtml(item.notes) + '</p></div>' : '') +
      '<div class="detail-section"><h3>来源</h3><p>' + escapeHtml(item.sourceRef || '') + '</p>' +
      (item.sourcePack ? '<a class="btn small" href="' + escapeHtml(item.sourcePack.url) + '">打开来源学习包</a>' : '') + '</div>' +
      '<div class="detail-section"><h3>记忆状态</h3><p class="small muted">复习 ' + (item.review ? item.review.reps : 0) + ' 次 · 遗忘 ' + (item.review ? item.review.lapses : 0) + ' 次 · 下次 ' + escapeHtml(item.dueLabel || '') + '</p></div>';
    document.getElementById('detail-study').addEventListener('click', function () {
      closeVocabDetail();
      startStudyWithItems([item]);
    });
    var detailEdit = document.getElementById('detail-edit');
    var detailEditForm = document.getElementById('detail-edit-form');
    if (detailEdit && detailEditForm) {
      var fillEdit = function () {
        var set = function (id, value) {
          var node = document.getElementById(id);
          if (node) node.value = value || '';
        };
        set('detail-edit-sense', item.sense);
        set('detail-edit-definition', item.definition);
        set('detail-edit-zh', item.definitionZh);
        set('detail-edit-hook', item.memoryHook);
        set('detail-edit-collocations', (item.collocations || []).join(', '));
        set('detail-edit-notes', item.notes);
      };
      detailEdit.addEventListener('click', function () {
        fillEdit();
        detailEditForm.hidden = false;
      });
      var cancel = document.getElementById('detail-edit-cancel');
      if (cancel) cancel.addEventListener('click', function () { detailEditForm.hidden = true; });
      var save = document.getElementById('detail-edit-save');
      if (save) save.addEventListener('click', function () {
        var value = function (id) {
          var node = document.getElementById(id);
          return node ? node.value.trim() : '';
        };
        var collocations = value('detail-edit-collocations').split(/[,，]/).map(function (entry) { return entry.trim(); }).filter(Boolean);
        setBusy(save, true, '保存中…');
        var status = document.getElementById('detail-edit-status');
        api('/api/items/' + encodeURIComponent(item.id) + '/update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sense: value('detail-edit-sense'),
            definition: value('detail-edit-definition'),
            definitionZh: value('detail-edit-zh'),
            memoryHook: value('detail-edit-hook'),
            collocations: collocations,
            notes: value('detail-edit-notes')
          })
        }).then(function (result) {
          state.vocabDetail = result.item;
          renderVocabDetail();
          loadLibrary();
          toast('词卡已更新');
        }).catch(function (error) {
          if (status) status.textContent = '保存失败：' + error.message;
          setBusy(save, false);
        });
      });
    }
    document.getElementById('detail-speak-word').addEventListener('click', function () { speakWord(item.lemma); });
    var examplesButton = document.getElementById('detail-examples');
    if (examplesButton) examplesButton.addEventListener('click', function () {
      examplesButton.disabled = true;
      examplesButton.textContent = '生成中…';
      api('/api/items/' + encodeURIComponent(item.id) + '/examples', { method: 'POST' }).then(function (result) {
        state.vocabDetail = result.item;
        renderVocabDetail();
        loadLibrary();
      }).catch(function (error) { examplesButton.disabled = false; examplesButton.textContent = '生成例句'; toast('生成失败：' + error.message); });
    });
    var graphButton = host.querySelector('[data-detail-graph]');
    if (graphButton) graphButton.addEventListener('click', function () {
      location.href = '/?tab=graph&word=' + encodeURIComponent(graphButton.getAttribute('data-detail-graph'));
    });
    var detailEnrich = host.querySelector('[data-detail-enrich]');
    if (detailEnrich) detailEnrich.addEventListener('click', function () {
      detailEnrich.disabled = true;
      api('/api/items/' + encodeURIComponent(item.id) + '/enrich', { method: 'POST' }).then(function (result) {
        state.vocabDetail = result.item;
        renderVocabDetail();
        loadLibrary();
      }).catch(function (error) { detailEnrich.disabled = false; toast('补全失败：' + error.message); });
    });
    document.getElementById('detail-favorite').addEventListener('click', function () {
      api('/api/favorite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, favorite: !item.favorite })
      }).then(function (result) {
        item.favorite = !item.favorite;
        state.stats = result.summary;
        renderStats();
        renderVocabDetail();
        loadLibrary();
      }).catch(function (error) { toast(error.message); });
    });
    host.querySelectorAll('[data-detail-status]').forEach(function (button) {
      button.addEventListener('click', function () {
        var status = button.getAttribute('data-detail-status');
        api('/api/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, status: status })
        }).then(function (result) {
          state.stats = result.summary;
          renderStats();
          closeVocabDetail();
          loadLibrary();
          toast(status === 'known' ? '已标记为掌握' : status === 'suspended' ? '已暂停' : '已恢复学习');
        }).catch(function (error) { toast(error.message); });
      });
    });
  }

  function studySpeak() {
    if (!state.study) return;
    var item = state.study.items[state.study.index];
    if (item) speakWord(item.lemma);
  }

  function renderStudy() {
    var study = state.study;
    var host = document.getElementById('study-body');
    if (!study || !host) return;
    var step = document.getElementById('study-step');
    var title = document.getElementById('study-title');
    if (step) step.textContent = "TODAY'S WORDS · " + Math.min(study.index + 1, study.items.length) + ' / ' + study.items.length;
    if (title) title.textContent = '背词';
    if (study.index >= study.items.length) {
      var correct = study.results.filter(function (rating) { return rating >= 3; }).length;
      host.innerHTML = '<div class="study-done"><h2>这一轮完成了</h2>' +
        '<p>' + correct + ' / ' + study.items.length + ' 个词一次回忆正确。</p>' +
        '<div class="study-done-stats"><div><b>' + correct + '</b><span>正确</span></div>' +
        '<div><b>' + (study.items.length - correct) + '</b><span>需要再看</span></div></div>' +
        '<div class="study-actions"><button class="btn btn-primary" id="study-again" type="button">再背一轮</button>' +
        '<button class="btn" id="study-back" type="button">回到词库</button></div></div>';
      document.getElementById('study-again').addEventListener('click', function () { closeStudy(); startStudy(); });
      document.getElementById('study-back').addEventListener('click', closeStudy);
      return;
    }
    var item = study.items[study.index];
    var mode = study.mode;
    var modes = '<div class="study-modes">' + [['recognize', '认词'], ['spell', '拼写'], ['listen', '听音']].map(function (entry) {
      return '<button type="button" data-study-mode="' + entry[0] + '"' + (entry[0] === mode ? ' class="active"' : '') + '>' + entry[1] + '</button>';
    }).join('') + '</div>';
    var progress = '<div class="study-progress"><span>' + (state.study.items.length) + ' 个词</span><span>' + (state.study.index + 1) + ' / ' + study.items.length + '</span></div>' +
      '<div class="study-track"><span style="width:' + ((study.index / study.items.length) * 100) + '%"></span></div>';
    var body = '';
    if (mode === 'recognize') {
      body = '<div class="study-card"><p class="study-hint">看到词，先回忆释义</p><h2 class="study-word">' + escapeHtml(item.lemma) + '</h2>' +
        (item.ipa ? '<div class="study-ipa">' + escapeHtml(item.ipa) + '</div>' : '') +
        '<div class="study-actions"><button class="btn" id="study-speak" type="button">🔊 发音</button>' +
        (study.revealed ? '' : '<button class="btn btn-primary" id="study-reveal" type="button">显示答案</button>') + '</div>' +
        (study.revealed ? studyAnswerHtml(item) : '') + '</div>';
    } else if (mode === 'spell') {
      body = '<div class="study-card"><p class="study-hint">根据释义拼出单词</p>' +
        '<p class="study-word" style="font-size:20px;font-family:var(--ui);font-weight:600;letter-spacing:0">' + escapeHtml(item.definitionZh || item.sense) + '</p>' +
        '<div class="study-actions"><button class="btn" id="study-speak" type="button">🔊 听发音</button></div>' +
        '<input class="study-input" id="study-spell-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词…" value="' + escapeHtml(study.input || '') + '">' +
        '<div class="study-actions">' + (study.revealed ? '' : '<button class="btn btn-primary" id="study-check" type="button">检查</button>') + '</div>' +
        (study.revealed ? '<div class="study-feedback ' + (study.spellCorrect ? 'good' : 'bad') + '">' + (study.spellCorrect ? '拼写正确。' : '正确拼写：' + escapeHtml(item.lemma)) + '</div>' : '') +
        (study.revealed ? studyAnswerHtml(item) : '') + '</div>';
    } else {
      var options = study.options || [];
      body = '<div class="study-card"><p class="study-hint">听发音，选出你听到的词</p>' +
        '<div class="study-actions"><button class="btn btn-primary" id="study-play" type="button">🔊 再听一遍</button></div>' +
        '<div class="study-options">' + options.map(function (option) {
          var cls = '';
          if (study.revealed && option === item.lemma) cls = ' correct';
          if (study.revealed && study.listenChoice === option && option !== item.lemma) cls = ' wrong';
          return '<button class="study-option' + cls + '" type="button" data-study-option="' + escapeHtml(option) + '"' + (study.revealed ? ' disabled' : '') + '>' + escapeHtml(option) + '</button>';
        }).join('') + '</div>' +
        (study.revealed ? studyAnswerHtml(item) : '') + '</div>';
    }
    host.innerHTML = progress + modes + body + (study.revealed ? studyRatingsHtml() : '');
    host.querySelectorAll('[data-study-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setStudyMode(button.getAttribute('data-study-mode')); });
    });
    var speakButton = document.getElementById('study-speak');
    if (speakButton) speakButton.addEventListener('click', studySpeak);
    var revealButton = document.getElementById('study-reveal');
    if (revealButton) revealButton.addEventListener('click', function () { study.revealed = true; renderStudy(); });
    var checkButton = document.getElementById('study-check');
    if (checkButton) checkButton.addEventListener('click', checkSpelling);
    var input = document.getElementById('study-spell-input');
    if (input) {
      input.focus();
      input.addEventListener('input', function () { study.input = input.value; });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); checkSpelling(); }
      });
    }
    var playButton = document.getElementById('study-play');
    if (playButton) playButton.addEventListener('click', studySpeak);
    if (mode === 'listen' && !study.revealed) setTimeout(studySpeak, 180);
    host.querySelectorAll('[data-study-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (study.revealed) return;
        study.listenChoice = button.getAttribute('data-study-option');
        study.revealed = true;
        renderStudy();
      });
    });
    host.querySelectorAll('[data-study-rate]').forEach(function (button) {
      button.addEventListener('click', function () { rateStudy(Number(button.getAttribute('data-study-rate'))); });
    });
    host.querySelectorAll('[data-study-graph]').forEach(function (button) {
      button.addEventListener('click', function () {
        location.href = '/?tab=graph&word=' + encodeURIComponent(button.getAttribute('data-study-graph'));
      });
    });
    host.querySelectorAll('[data-study-enrich]').forEach(function (button) {
      button.addEventListener('click', function () {
        button.disabled = true;
        api('/api/items/' + encodeURIComponent(button.getAttribute('data-study-enrich')) + '/enrich', { method: 'POST' }).then(function (result) {
          study.items[study.index] = result.item;
          renderStudy();
        }).catch(function (error) { button.disabled = false; toast('补全失败：' + error.message); });
      });
    });
  }

  function studyFormationHtml(item) {
    var formation = item.wordFormation;
    if (!formation) return '';
    var groups = [
      ['前缀', formation.prefixes || []],
      ['词根', formation.roots || []],
      ['后缀', formation.suffixes || []],
    ];
    var rows = groups.map(function (entry) {
      if (!entry[1].length) return '';
      return '<div class="study-chip-row"><span class="study-chip-label">' + entry[0] + '</span>' +
        entry[1].map(function (part) {
          return '<span class="study-chip"><b>' + escapeHtml(part.form) + '</b>' + escapeHtml(part.meaning) + '</span>';
        }).join('') + '</div>';
    }).join('');
    if (!rows) return '';
    return '<div class="study-rich-section"><div class="study-rich-label">词根词缀</div>' + rows + '</div>';
  }

  function studyRelationsHtml(item) {
    var relations = item.relations || {};
    var groups = [
      ['近义', relations.synonyms || []],
      ['反义', relations.antonyms || []],
      ['易混', relations.confusables || []],
      ['词族/派生', relations.wordFamily || []],
    ];
    var rows = groups.map(function (entry) {
      if (!entry[1].length) return '';
      return '<div class="study-chip-row"><span class="study-chip-label">' + entry[0] + '</span>' +
        entry[1].map(function (value) {
          return '<span class="study-chip">' + escapeHtml(value) + '</span>';
        }).join('') + '</div>';
    }).join('');
    if (!rows) return '';
    return '<div class="study-rich-section"><div class="study-rich-label">词族与关系</div>' + rows + '</div>';
  }

  function studyExtrasHtml(item) {
    var sections = [];
    if (item.collocations && item.collocations.length) {
      sections.push('<div class="study-rich-section"><div class="study-rich-label">搭配</div><p>' + item.collocations.slice(0, 6).map(escapeHtml).join(' · ') + '</p></div>');
    }
    if (item.examples && item.examples.length) {
      sections.push('<div class="study-rich-section"><div class="study-rich-label">例句</div>' +
        item.examples.slice(0, 3).map(function (example) {
          return '<p class="study-example">' + escapeHtml(example) + '</p>';
        }).join('') + '</div>');
    }
    if (item.memoryHook) {
      sections.push('<div class="study-rich-section"><div class="study-rich-label">记忆钩子</div><p>' + escapeHtml(item.memoryHook) + '</p></div>');
    }
    if (item.notes) {
      sections.push('<div class="study-rich-section"><div class="study-rich-label">笔记</div><p>' + escapeHtml(item.notes) + '</p></div>');
    }
    return sections.join('');
  }

  function relationCount(item) {
    var relations = item.relations || {};
    return (relations.synonyms || []).length + (relations.antonyms || []).length +
      (relations.confusables || []).length + (relations.wordFamily || []).length;
  }

  function studyAnswerHtml(item) {
    var needsEnrich = !item.wordFormation || relationCount(item) === 0;
    return '<div class="study-answer"><div class="study-answer-head"><h3>' + escapeHtml(item.lemma) + '</h3>' +
      '<span class="small muted">' + escapeHtml([item.pos, item.cefr].filter(Boolean).join(' · ')) + '</span></div>' +
      '<p>' + escapeHtml(item.sense) + '</p>' +
      (item.definitionZh ? '<p class="zh">' + escapeHtml(item.definitionZh) + '</p>' : '') +
      (item.context ? '<div class="study-context">' + escapeHtml(item.context) + '</div>' : '') +
      studyFormationHtml(item) + studyRelationsHtml(item) + studyExtrasHtml(item) +
      '<div class="study-rich-actions">' +
        '<button class="btn small" type="button" data-study-graph="' + escapeHtml(item.lemma) + '">关系图</button>' +
        (needsEnrich ? '<button class="btn small" type="button" data-study-enrich="' + escapeHtml(item.id) + '">补全词根/关系</button>' : '') +
      '</div></div>';
  }

  function studyRatingsHtml() {
    return '<div class="study-ratings">' +
      '<button type="button" data-study-rate="1">Again<small>忘了 · 1</small></button>' +
      '<button type="button" data-study-rate="2">Hard<small>吃力 · 2</small></button>' +
      '<button type="button" data-study-rate="3">Good<small>记得 · 3</small></button>' +
      '<button type="button" data-study-rate="4">Easy<small>很熟 · 4</small></button>' +
    '</div>';
  }

  function checkSpelling() {
    var study = state.study;
    if (!study || study.revealed) return;
    var input = document.getElementById('study-spell-input');
    if (input) study.input = input.value;
    study.revealed = true;
    study.spellCorrect = normalizeAnswer(study.input || '') === normalizeAnswer(study.items[study.index].lemma);
    renderStudy();
  }

  function setStudyMode(mode) {
    if (!state.study) return;
    state.study.mode = mode;
    state.study.revealed = false;
    state.study.input = '';
    state.study.listenChoice = null;
    if (mode === 'listen') state.study.options = studyOptions(state.study.items[state.study.index]);
    renderStudy();
  }

  function studyOptions(item) {
    var all = state.study.items.map(function (entry) { return entry.lemma; }).filter(function (value, index, list) { return list.indexOf(value) === index; });
    var options = [item.lemma];
    all.forEach(function (lemma) { if (options.length < 4 && lemma !== item.lemma) options.push(lemma); });
    while (options.length < 4) options.push(['focus', 'sustain', 'fragile', 'attention'][options.length % 4]);
    return options.sort(function () { return Math.random() - 0.5; });
  }

  function rateStudy(rating) {
    var study = state.study;
    if (!study) return;
    var item = study.items[study.index];
    api('/api/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, rating: rating })
    }).then(function (result) {
      state.stats = result.summary;
      renderStats();
      study.results.push(rating);
      study.index += 1;
      study.revealed = false;
      study.input = '';
      study.listenChoice = null;
      if (study.mode === 'listen' && study.items[study.index]) study.options = studyOptions(study.items[study.index]);
      renderStudy();
    }).catch(function (error) { toast(error.message); });
  }

  function loadWordbooks(force) {
    if (!force && state.wordbooks.length) return Promise.resolve();
    return api('/api/wordbooks').then(function (result) {
      state.wordbooks = result.books || [];
      renderVocabFilters();
      var modal = document.getElementById('wordbooks-modal');
      if (modal && !modal.hidden) renderWordbooks();
    }).catch(function (error) { toast(error.message); });
  }

  function renderWordbooks() {
    var host = document.getElementById('wordbooks-body');
    if (!host) return;
    if (!state.wordbooks.length) {
      host.innerHTML = '<div class="empty">正在加载词书…</div>';
      return;
    }
    host.innerHTML = '<div class="wordbook-grid">' + state.wordbooks.map(function (book) {
      var progress = book.progress || {};
      var percent = progress.total ? Math.round((progress.enrolled / progress.total) * 100) : 0;
      return '<div class="wordbook-card">' +
        '<div class="wordbook-top"><h3>' + escapeHtml(book.name) + '</h3><span class="wordbook-short">' + escapeHtml(book.short) + '</span></div>' +
        '<p>' + escapeHtml(book.description) + '</p>' +
        '<div class="wordbook-numbers"><span><b>' + progress.total + '</b> 词</span><span><b>' + progress.enrolled + '</b> 词库已有</span><span><b>' + (progress.staged || 0) + '</b> 待学</span><span><b>' + progress.due + '</b> 到期</span></div>' +
        '<div class="wordbook-progress"><span style="width:' + percent + '%"></span></div>' +
        '<div class="wordbook-actions">' +
          (progress.enrolled < progress.total ? '<button class="btn btn-primary" type="button" data-wordbook-enroll="' + escapeHtml(book.id) + '">加入词库</button>' : '<span class="wordbook-short">已全部加入</span>') +
          (progress.enrolled > 0 ? '<button class="btn" type="button" data-wordbook-study="' + escapeHtml(book.id) + '">开始背</button>' : '') +
        '</div>' +
        '<div class="wordbook-source">数据：' + escapeHtml(book.source) + ' · ' + escapeHtml(book.license) + '</div>' +
      '</div>';
    }).join('') + '</div>' +
    '<div class="wordbook-note">词书会加入现有 FSRS 词库，和文章里收集的词共用同一套复习调度。已存在的同名词不会重复添加。IELTS 为 Word Atlas 7,298 词数据集；CET-4/6/TOEFL 为第三方开源词表，详见 src/wordbooks/ATTRIBUTION.md。</div>';
    host.querySelectorAll('[data-wordbook-enroll]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-wordbook-enroll');
        setBusy(button, true, '加入中…');
        api('/api/wordbooks/' + encodeURIComponent(id) + '/enroll', { method: 'POST', body: {} }).then(function (result) {
          toast('已加入 ' + result.result.added + ' 个词' +
            (result.result.merged ? '，补全 ' + result.result.merged + ' 个已有词' : '') +
            (result.result.skipped ? '，跳过 ' + result.result.skipped + ' 个已存在词' : ''));
          return loadWordbooks(true).then(function () { loadLibrary(); });
        }).catch(function (error) { toast(error.message) }).finally(function () { setBusy(button, false); });
      });
    });
    host.querySelectorAll('[data-wordbook-study]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-wordbook-study');
        state.vocabBook = id;
        state.vocabGroup = 'all';
        document.querySelectorAll('[data-vocab-group]').forEach(function (entry) {
          entry.classList.toggle('active', entry.getAttribute('data-vocab-group') === 'all');
        });
        closeWordbooks();
        loadLibrary().then(function () { startStudy(); });
      });
    });
  }

  function openWordbooks() {
    var modal = document.getElementById('wordbooks-modal');
    if (modal) modal.hidden = false;
    renderWordbooks();
    loadWordbooks(true);
  }

  function closeWordbooks() {
    var modal = document.getElementById('wordbooks-modal');
    if (modal) modal.hidden = true;
  }

  function openQuality() {
    var modal = document.getElementById('quality-modal');
    if (modal) modal.hidden = false;
    var status = document.getElementById('quality-status');
    if (status) status.textContent = '当前有 ' + (state.vocabCounts.missing || 0) + ' 个词缺例句。';
  }

  function closeQuality() {
    var modal = document.getElementById('quality-modal');
    if (modal) modal.hidden = true;
  }

  function openKnown() {
    var modal = document.getElementById('known-modal');
    if (modal) modal.hidden = false;
    var status = document.getElementById('known-status');
    if (status) status.textContent = '';
    var input = document.getElementById('known-text');
    if (input) input.focus();
  }

  function closeKnown() {
    var modal = document.getElementById('known-modal');
    if (modal) modal.hidden = true;
  }

  function runKnown(button) {
    var input = document.getElementById('known-text');
    var text = input ? input.value.trim() : '';
    var status = document.getElementById('known-status');
    if (!text) {
      if (status) status.textContent = '先粘贴或导入一份词表。';
      return;
    }
    setBusy(button, true, '处理中…');
    if (status) status.textContent = '正在匹配词库…';
    api('/api/vocab/known', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).then(function (result) {
      if (status) {
        status.textContent = '识别 ' + result.words + ' 个词，匹配 ' + result.matchedWords +
          ' 个，更新 ' + result.itemsUpdated + ' 张卡' +
          (result.alreadyKnown ? '，原本已掌握 ' + result.alreadyKnown + ' 张' : '') +
          (result.unknownCount ? '；' + result.unknownCount + ' 个词不在词库：' + result.unknown.join('、') : '');
      }
      toast('已标记 ' + result.itemsUpdated + ' 张卡');
      state.stats = result.summary || state.stats;
      renderStats();
      loadLibrary();
    }).catch(function (error) {
      if (status) status.textContent = '导入失败：' + error.message;
    }).finally(function () {
      setBusy(button, false);
    });
  }

  function runQuality(limit, button) {
    if (button) setBusy(button, true, '生成中…');
    var status = document.getElementById('quality-status');
    if (status) status.textContent = '正在生成 ' + limit + ' 个例句，请稍候…';
    api('/api/words/examples', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: limit, book: state.vocabBook || undefined })
    }).then(function (result) {
      if (status) {
        status.textContent = '已补 ' + result.updated + ' 个' +
          (result.failures && result.failures.length ? '，失败 ' + result.failures.length + ' 个' : '') +
          '；还剩 ' + result.remaining + ' 个。';
      }
      toast('已补全 ' + result.updated + ' 个例句');
      loadLibrary();
    }).catch(function (error) {
      if (status) status.textContent = '补全失败：' + error.message;
      toast('补全失败：' + error.message);
    }).finally(function () { setBusy(button, false); });
  }

  function startStudyWithItems(items) {
    if (!items || !items.length) { toast('没有可背的词。'); return; }
    location.href = '/?tab=review&words=' + encodeURIComponent(items[0].id) + '&label=' + encodeURIComponent(items[0].lemma);
  }

  function startStudy() {
    if (state.vocabType === 'sentence') {
      toast('背词只练单词卡；先切回「全部卡片」或「单词」。');
      return;
    }
    if (state.vocabGroup === 'known' || state.vocabGroup === 'suspended') {
      toast('这个分组不需要背；切到「全部」「新词」「到期」或「待学」。');
      return;
    }
    var params = new URLSearchParams({ tab: 'review' });
    if (state.vocabGroup === 'backlog') params.set('scope', 'all');
    else if (state.vocabGroup === 'new') params.set('scope', 'new');
    else if (state.vocabGroup === 'due') params.set('scope', 'due');
    else if (state.vocabGroup === 'leech') params.set('scope', 'leech');
    if (state.vocabBook) params.set('book', state.vocabBook);
    var newLimit = Number(document.getElementById('vocab-new-limit')?.value || 10);
    if (Number.isFinite(newLimit)) params.set('newLimit', String(newLimit));
    location.href = '/?' + params.toString();
  }

  function closeStudy() {
    var overlay = document.getElementById('study-session');
    if (overlay) overlay.hidden = true;
    state.study = null;
    loadLibrary();
  }

  function loadPacks() {
    api('/api/packs').then(function (result) {
      var packs = result.packs || [];
      if (!packs.length) {
        els.packsList.innerHTML = '<div class="empty"><strong>还没有学习包</strong>在「导入」里添加 PDF、粘贴文字或填写链接。' +
          '<button class="btn btn-primary" data-go-tab="import" style="margin-top:14px">去导入</button></div>';
        return;
      }

      var groups = [];
      var byIssue = {};
      packs.forEach(function (pack) {
        var key = pack.issueId || pack.resourceId;
        if (!byIssue[key]) {
          byIssue[key] = { id: key, title: pack.issueTitle || pack.title, packs: [] };
          groups.push(byIssue[key]);
        }
        byIssue[key].packs.push(pack);
      });

      els.packsList.innerHTML = groups.map(function (group) {
        var rows = group.packs.map(function (pack) {
          var label = pack.articleIndex === null || pack.articleIndex === undefined
            ? '整本'
            : pack.chapter
              ? '第 ' + pack.chapter.index + ' / ' + pack.chapter.total + ' 篇'
              : '文章';
          var rebuild = pack.articleIndex === null || pack.articleIndex === undefined
            ? ''
            : '<button class="btn" data-rebuild-resource="' +
              escapeHtml(pack.parentResourceId || pack.resourceId) +
              '" data-rebuild-article="' + pack.articleIndex + '">重生成</button>';
          return '<div class="pack-row">' +
            '<div><a href="' + escapeHtml(pack.url) + '">' + escapeHtml(pack.title) + '</a>' +
            '<div class="due">' + label + ' · ' + pack.itemCount + ' 项 · 到期 ' + pack.due +
              ' · 已掌握 ' + pack.mastered + ' · ' + escapeHtml((pack.createdAt || '').slice(0, 10)) + '</div></div>' +
            '<div class="pack-actions">' +
              '<a class="btn btn-primary" href="' + escapeHtml(pack.url) + '">阅读</a>' +
              '<a class="btn" href="/?tab=review&pack=' + encodeURIComponent(pack.id) + '">复习</a>' +
              rebuild +
              '<button class="btn danger" data-delete-pack="' + escapeHtml(pack.id) + '">删除</button>' +
            '</div>' +
          '</div>';
        }).join('');
        return '<div class="pack-group"><div class="pack-group-head"><strong>' + escapeHtml(group.title) +
          '</strong><span>' + group.packs.length + ' 个学习包</span></div>' + rows + '</div>';
      }).join('');

      els.packsList.querySelectorAll('[data-delete-pack]').forEach(function (button) {
        var timer;
        button.addEventListener('click', function () {
          if (button.getAttribute('data-confirm') !== '1') {
            button.setAttribute('data-confirm', '1');
            button.textContent = '确认删除';
            clearTimeout(timer);
            timer = setTimeout(function () {
              button.removeAttribute('data-confirm');
              button.textContent = '删除';
            }, 3000);
            return;
          }
          var packId = button.getAttribute('data-delete-pack');
          api('/api/packs/' + encodeURIComponent(packId) + '/delete', { method: 'POST' }).then(function (deleted) {
            toast('已移到回收站' + (deleted.removedItems ? '，移除 ' + deleted.removedItems + ' 个词条' : ''));
            state.stats = deleted.summary;
            renderStats();
            if (state.packFilter === packId) clearPackFilter();
            loadPacks();
            loadRecentImports();
          }).catch(function (error) {
            toast('删除失败：' + error.message);
          });
        });
      });
    }).catch(function (error) {
      els.packsList.innerHTML = '<div class="empty"><strong>无法加载学习包</strong>' + escapeHtml(error.message) + '</div>';
    });
  }

  var kindLabels = { pdf: 'PDF', epub: 'EPUB', mobi: 'MOBI', text: '文本', web: '网页', transcript: '字幕' };

  function kindLabel(kind) {
    return kindLabels[kind] || kind;
  }

  function renderWorking(message, jobId) {
    state.currentJobId = jobId === undefined ? null : jobId;
    var cancel = state.currentJobId
      ? '<div class="result-actions"><button class="btn" data-cancel-job="' + escapeHtml(state.currentJobId) + '">取消</button>' +
        (state.buildFromQueue && state.buildQueue.length > 0 ? '<button class="btn" data-stop-queue="1">停止队列</button>' : '') +
        '</div>'
      : '';
    els.importResult.innerHTML = '<div class="result-card working"><span class="spinner"></span><div><strong>处理中…</strong>' +
      '<div class="result-meta">' + escapeHtml(message) + '</div></div>' + cancel + '</div>';
  }

  function renderImportError(message, resourceId, articleIndex) {
    var retry = resourceId
      ? '<div class="result-actions"><button class="btn" data-build="' + escapeHtml(resourceId) + '"' +
        (articleIndex === undefined ? '' : ' data-article="' + articleIndex + '"') + '>重试</button></div>'
      : '';
    els.importResult.innerHTML = '<div class="result-card"><div class="result-title">没有完成</div>' +
      '<p class="result-preview">' + escapeHtml(message) + '</p>' + retry + '</div>';
    toast(message);
  }

  function renderResourceCard(resource) {
    var warnings = (resource.warnings || []).map(function (warning) {
      return '<li>' + escapeHtml(warning) + '</li>';
    }).join('');
    var packs = resource.packs || [];
    var articlePacks = packs.filter(function (pack) { return pack.articleIndex !== null; });
    var articleCount = resource.articleCount || 1;
    var actions;
    if (articleCount > 1) {
      actions = '<button class="btn btn-primary" data-articles="' + escapeHtml(resource.id) + '">查看 ' +
        articleCount + ' 篇文章</button>';
      if (articlePacks.length) {
        actions += '<span class="result-meta">已生成 ' + articlePacks.length + ' 篇学习包</span>';
      }
    } else if (packs.length) {
      actions = '<a class="btn btn-primary" href="' + escapeHtml(packs[0].url) + '">打开学习包</a>' +
        '<button class="btn" data-build="' + escapeHtml(resource.id) + '">重新生成</button>';
    } else {
      actions = '<button class="btn btn-primary" data-build="' + escapeHtml(resource.id) + '">生成学习包</button>';
    }
    if (resource.canResplit) {
      actions += '<button class="btn" data-resplit="' + escapeHtml(resource.id) + '">重新解析文章</button>';
    }
    actions += '<button class="btn danger" data-delete-resource="' + escapeHtml(resource.id) + '">删除材料</button>';
    return '<div class="result-card">' +
      '<div class="result-head"><div><div class="result-title">' + escapeHtml(resource.title) + '</div>' +
      '<div class="result-meta">' + kindLabel(resource.kind) + ' · ' + resource.wordCount + ' 词 · ' + resource.segmentCount + ' 段' +
      (articleCount > 1 ? ' · ' + articleCount + ' 篇' : '') + '</div></div>' +
      '<div class="result-actions">' + actions + '</div></div>' +
      (warnings ? '<ul class="warnings">' + warnings + '</ul>' : '') +
      '<p class="result-preview">' + escapeHtml(resource.preview) + '</p>' +
    '</div>';
  }

  function showImportResult(resource) {
    state.articleResource = resource;
    state.articles = [];
    state.articlePacks = [];
    state.importResource = null;
    state.importArticle = null;
    state.importArticlesView = false;
    document.getElementById('view-import').classList.remove('article-mode');
    updateUrl();
    els.importResult.innerHTML = renderResourceCard(resource);
    if (els.importResult.scrollIntoView) els.importResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function articleRowHtml(article, byIndex, resourceId) {
    var pack = byIndex[article.index];
    var action = pack
      ? '<a class="btn" href="' + escapeHtml(pack.url) + '">打开</a>'
      : '<button class="btn" data-build-article="' + article.index + '" data-build-resource="' + escapeHtml(resourceId) + '">生成</button>';
    var section = article.section
      ? '<span class="article-section">' + escapeHtml(article.section) + '</span>'
      : '';
    var hidden = article.hidden ? '<span class="badge">非文章</span>' : '';
    var queue = pack
      ? ''
      : '<input class="article-queue" type="checkbox" data-queue-article="' + article.index + '"' +
        (state.selectedArticles[article.index] ? ' checked' : '') + ' title="加入构建队列">';
    var override = '<button class="article-override" data-override-article="' + article.index +
      '" data-override-value="' + (article.hidden ? 'true' : 'false') + '">' +
      (article.hidden ? '设为文章' : '非文章') + '</button>';
    return '<div class="article-row' + (article.index === state.importArticle ? ' highlight' : '') +
      (article.hidden ? ' hidden-article' : '') + '" data-search="' + escapeHtml(article.title.toLowerCase()) + '">' +
      '<div class="article-main"><div class="article-title">' + escapeHtml(article.title) + section + hidden + '</div>' +
      '<div class="article-preview">' + article.wordCount + ' 词 · ' + escapeHtml(article.preview) + '</div></div>' +
      '<div class="article-actions">' + override + queue + action + '</div></div>';
  }

  function renderArticleRows() {
    var byIndex = {};
    state.articlePacks.forEach(function (pack) { byIndex[pack.articleIndex] = pack; });
    var search = document.getElementById('article-search');
    var sectionSelect = document.getElementById('article-section');
    var sortSelect = document.getElementById('article-sort');
    var statusSelect = document.getElementById('article-status');
    var showHidden = document.getElementById('show-hidden');
    var query = search ? search.value.trim().toLowerCase() : '';
    var section = sectionSelect ? sectionSelect.value : '';
    var sort = sortSelect ? sortSelect.value : 'default';
    var status = statusSelect ? statusSelect.value : '';
    var includeHidden = showHidden ? showHidden.checked : false;

    var list = state.articles.slice();
    if (includeHidden) list = list.concat(state.articleHidden);
    list = list.filter(function (article) {
      if (query && article.title.toLowerCase().indexOf(query) === -1) return false;
      if (section && article.section !== section) return false;
      var built = Boolean(byIndex[article.index]);
      if (status === 'done' && !built) return false;
      if (status === 'new' && built) return false;
      return true;
    });

    if (sort === 'short') list.sort(function (a, b) { return a.wordCount - b.wordCount; });
    else if (sort === 'long') list.sort(function (a, b) { return b.wordCount - a.wordCount; });
    else list.sort(function (a, b) { return a.index - b.index; });

    var listEl = document.getElementById('article-list');
    if (!listEl) return;
    listEl.innerHTML = list.length
      ? list.map(function (article) { return articleRowHtml(article, byIndex, state.articleResource.id); }).join('')
      : '<div class="empty" style="padding:24px"><strong>没有匹配的文章</strong>换个关键词或筛选条件。</div>';
    var highlighted = listEl.querySelector('.article-row.highlight');
    if (highlighted && highlighted.scrollIntoView) highlighted.scrollIntoView({ block: 'center' });
  }

  function renderArticleList(result) {
    var resource = result.resource;
    var articles = result.articles || [];
    var hiddenArticles = result.hiddenArticles || [];
    var packs = result.packs || [];
    state.articleResource = resource;
    state.articles = articles;
    state.articleHidden = hiddenArticles;
    state.articlePacks = packs;
    state.selectedArticles = {};

    var sections = [];
    articles.concat(hiddenArticles).forEach(function (article) {
      if (article.section && sections.indexOf(article.section) === -1) sections.push(article.section);
    });

    var sectionOptions = [{ value: '', label: '全部栏目' }].concat(sections.map(function (section) {
      return { value: section, label: section };
    }));
    var toolbar = '<div class="article-tools">' +
      '<input class="article-search" id="article-search" type="search" placeholder="筛选文章标题…">' +
      (sections.length ? customSelectHtml('article-section', '', sectionOptions, 'cselect-article') : '') +
      customSelectHtml('article-sort', 'default', [
        { value: 'default', label: '默认顺序' },
        { value: 'short', label: '短到长' },
        { value: 'long', label: '长到短' }
      ], 'cselect-article') +
      customSelectHtml('article-status', '', [
        { value: '', label: '全部状态' },
        { value: 'new', label: '未生成' },
        { value: 'done', label: '已生成' }
      ], 'cselect-article') +
      (hiddenArticles.length
        ? '<label class="article-toggle"><input type="checkbox" id="show-hidden"> 显示被过滤的 ' +
          hiddenArticles.length + ' 项</label>'
        : '') +
      '<button class="btn" id="build-selected" type="button">生成选中</button>' +
    '</div>';

    els.importResult.innerHTML =
      '<div class="result-card article-panel">' +
        '<div class="result-head"><div><div class="result-title">选择文章</div>' +
          '<div class="result-meta">' + escapeHtml(resource.title) + ' · ' + articles.length + ' 篇可学习文章' +
            (hiddenArticles.length > 0 ? ' · 已隐藏 ' + hiddenArticles.length + ' 个目录/广告/漫画/新闻摘要页' : '') +
          '</div></div>' +
          '<div class="result-actions"><button class="btn" data-resource-info="1">返回材料</button></div></div>' +
        toolbar +
        '<div class="article-list" id="article-list"></div>' +
      '</div>';

    initCustomSelects(els.importResult);
    ['article-search', 'article-section', 'article-sort', 'article-status', 'show-hidden'].forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.addEventListener('input', renderArticleRows);
      if (element) element.addEventListener('change', renderArticleRows);
    });
    var buildSelectedButton = document.getElementById('build-selected');
    if (buildSelectedButton) buildSelectedButton.addEventListener('click', buildSelected);
    renderArticleRows();
    if (els.importResult.scrollIntoView) els.importResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openArticleList(resourceId, highlightArticle) {
    state.importResource = resourceId;
    state.importArticlesView = true;
    state.importArticle = highlightArticle === undefined ? null : highlightArticle;
    document.getElementById('view-import').classList.add('article-mode');
    updateUrl();
    api('/api/resources/' + encodeURIComponent(resourceId) + '/articles').then(function (result) {
      renderArticleList(result);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  }

  function renderImportMode(llm, model, provider) {
    els.importMode.innerHTML = llm
      ? '当前使用 <strong>' + escapeHtml(provider || 'LLM') + '</strong> · ' + escapeHtml(model) +
        ' 分析，生成通常需要 1–3 分钟。'
      : '未配置 LLM，将使用<strong>启发式模式</strong>：速度快，但义项判断和中文释义会弱一些。展开下方「模型设置」可填写自己的 API Key。';
  }

  function llmPreset(id) {
    return LLM_PRESETS.find(function (provider) { return provider.id === id; }) ||
      LLM_PRESETS[0];
  }

  function renderModelOptions(providerId, selectedModel) {
    if (!els.llmModelOptions) return;
    var preset = llmPreset(providerId);
    els.llmModelOptions.innerHTML = '';
    (preset.models || []).forEach(function (model) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'llm-model-option' + (model.id === selectedModel ? ' is-active' : '');
      button.textContent = model.label;
      button.title = model.description || model.id;
      button.addEventListener('click', function () {
        if (els.llmModel) els.llmModel.value = model.id;
        renderModelOptions(providerId, model.id);
      });
      els.llmModelOptions.appendChild(button);
    });
  }

  function renderLiveModelOptions(models, selectedModel) {
    if (!els.llmModelOptions) return;
    els.llmModelOptions.innerHTML = '';
    models.forEach(function (id) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'llm-model-option' + (id === selectedModel ? ' is-active' : '');
      button.textContent = id;
      button.title = id;
      button.addEventListener('click', function () {
        if (els.llmModel) els.llmModel.value = id;
        renderLiveModelOptions(models, id);
      });
      els.llmModelOptions.appendChild(button);
    });
  }

  function refreshModels() {
    if (!els.llmRefresh) return;
    setBusy(els.llmRefresh, true, '查询中…');
    if (els.llmRefreshStatus) els.llmRefreshStatus.textContent = '';
    api('/api/llm/models').then(function (result) {
      var models = result.models || [];
      renderLiveModelOptions(models, els.llmModel ? els.llmModel.value : '');
      if (els.llmRefreshStatus) els.llmRefreshStatus.textContent = '已获取 ' + models.length + ' 个模型';
    }).catch(function (error) {
      if (els.llmRefreshStatus) els.llmRefreshStatus.textContent = '失败：' + error.message;
    }).finally(function () {
      setBusy(els.llmRefresh, false);
    });
  }

  function setLlmStatus(status) {
    if (!status) return;
    if (els.llmProvider) {
      els.llmProvider.value = status.provider || 'openai';
      syncCustomSelect(els.llmProvider);
    }
    if (els.llmModel) els.llmModel.value = status.model || '';
    renderModelOptions(status.provider || 'openai', status.model || '');
    if (els.llmBaseUrl) els.llmBaseUrl.value = status.baseUrl || '';
    if (els.llmApiKey) {
      els.llmApiKey.value = '';
      els.llmApiKey.placeholder = status.configured ? '已配置，留空保持不变' : 'sk-...';
    }
    if (els.llmState) {
      els.llmState.textContent = status.configured
        ? status.label + ' · ' + status.model
        : '未配置';
    }
    if (!status.configured && els.llmSettings) els.llmSettings.open = true;
  }

  function loadLlmSettings() {
    return api('/api/llm').then(function (result) {
      setLlmStatus(result.status);
      renderImportMode(result.status.configured, result.status.model, result.status.label);
    }).catch(function (error) {
      if (els.llmState) els.llmState.textContent = error.message;
    });
  }

  function saveLlmSettings() {
    if (!els.llmSave) return;
    els.llmSave.disabled = true;
    els.llmSave.textContent = '保存中…';
    if (els.llmMessage) els.llmMessage.textContent = '正在保存…';
    api('/api/llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: els.llmProvider ? els.llmProvider.value : 'openai',
        apiKey: els.llmApiKey ? els.llmApiKey.value : '',
        model: els.llmModel ? els.llmModel.value : '',
        baseUrl: els.llmBaseUrl ? els.llmBaseUrl.value : ''
      })
    }).then(function (result) {
      setLlmStatus(result.status);
      renderImportMode(result.status.configured, result.status.model, result.status.label);
      if (els.llmMessage) els.llmMessage.textContent = '已保存，接下来会使用 ' + result.status.label + ' · ' + result.status.model;
      toast('模型设置已保存');
      loadRecentImports();
    }).catch(function (error) {
      if (els.llmMessage) els.llmMessage.textContent = error.message;
      toast('保存失败：' + error.message);
    }).finally(function () {
      els.llmSave.disabled = false;
      els.llmSave.textContent = '保存模型设置';
    });
  }

  function loadStyles() {
    return api('/api/styles').then(function (result) {
      if (!els.buildStyle) return;
      var styles = result.styles || [];
      setCustomSelectOptions('build-style', [{ value: '', label: '默认风格' }].concat(styles.map(function (style) {
        return { value: style.name, label: style.title + (style.model ? ' · ' + style.model : '') };
      })), els.buildStyle.value);
      try {
        var saved = localStorage.getItem('learn-build-style');
        if (saved && customSelectHasValue(els.buildStyle, saved)) {
          els.buildStyle.value = saved;
          syncCustomSelect(els.buildStyle);
        }
      } catch (error) {}
    }).catch(function () {
      // The default style still works when profiles cannot be listed.
    });
  }

  function loadRecentImports() {
    loadStyles();
    api('/api/resources?limit=8').then(function (result) {
      state.resources = result.resources || [];
      renderImportMode(result.llm, result.model, result.provider);
      if (!state.resources.length) {
        els.recentImports.innerHTML = '<div class="empty" style="padding:26px"><strong>还没有导入材料</strong>从上面的文本、链接或 PDF 开始。</div>';
        return;
      }
      els.recentImports.innerHTML = state.resources.map(function (resource) {
        var packs = resource.packs || [];
        var articlePacks = packs.filter(function (pack) { return pack.articleIndex !== null; });
        var articleCount = resource.articleCount || 1;
        var generatedCount = articleCount > 1 ? articlePacks.length : packs.length;
        var action;
        if (articleCount > 1) {
          action = '<button class="btn" data-articles="' + escapeHtml(resource.id) + '">选文章</button>';
        } else if (packs.length) {
          action = '<a class="btn" href="' + escapeHtml(packs[0].url) + '">打开</a>';
        } else {
          action = '<button class="btn" data-build="' + escapeHtml(resource.id) + '">生成</button>';
        }
        action += '<button class="btn danger" data-delete-resource="' + escapeHtml(resource.id) + '">删除</button>';
        return '<div class="resource-row">' +
          '<div class="resource-main" data-resource="' + escapeHtml(resource.id) + '">' +
            '<div class="resource-title">' + escapeHtml(resource.title) + '</div>' +
            '<div class="due">' + kindLabel(resource.kind) + ' · ' + resource.wordCount + ' 词 · ' + resource.segmentCount + ' 段' +
              (articleCount > 1 ? ' · ' + articleCount + ' 篇' : '') +
              (generatedCount ? ' · 已生成 ' + generatedCount + ' 篇' : '') + '</div>' +
          '</div>' + action +
        '</div>';
      }).join('');
    }).catch(function (error) {
      els.importMode.textContent = '无法加载导入信息：' + error.message;
    });
  }

  function afterImport(resource) {
    showImportResult(resource);
    loadRecentImports();
    toast(resource.aiRemoved > 0 ? '已导入并清理 ' + resource.aiRemoved + ' 段：' + resource.title : '已导入：' + resource.title);
  }

  function refreshStats() {
    api('/api/summary').then(function (result) {
      state.stats = result.summary;
      renderStats();
    });
  }

  var QUEUE_KEY = 'learn-build-queue';

  function saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(state.buildQueue));
    } catch (error) {
      // Storage can be unavailable in private modes; the in-memory queue still works.
    }
  }

  function clearSavedQueue() {
    try {
      localStorage.removeItem(QUEUE_KEY);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function loadQueueBanner() {
    try {
      var saved = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        state.savedQueue = saved;
        els.queueBanner.hidden = false;
        els.queueBannerText.textContent = '上次有 ' + saved.length + ' 篇文章待生成。';
      }
    } catch (error) {
      // Ignore a corrupt queue.
    }
  }

  function resumeQueue() {
    if (state.building) {
      toast('正在生成，请稍候');
      return;
    }
    state.buildQueue = state.savedQueue.slice();
    state.savedQueue = [];
    els.queueBanner.hidden = true;
    state.queueStats = { ok: 0, failed: 0 };
    saveQueue();
    processBuildQueue();
  }

  function discardSavedQueue() {
    state.savedQueue = [];
    els.queueBanner.hidden = true;
    clearSavedQueue();
  }

  function stopQueue() {
    state.buildQueue = [];
    clearSavedQueue();
    var stopButton = document.querySelector('[data-stop-queue]');
    if (stopButton) stopButton.remove();
    toast('已停止队列，当前这篇会继续完成');
  }

  function finishQueueStep() {
    if (!state.buildFromQueue) return;
    state.buildFromQueue = false;
    if (state.buildQueue.length > 0) {
      saveQueue();
      setTimeout(processBuildQueue, 700);
      return;
    }
    clearSavedQueue();
    var stats = state.queueStats;
    state.queueStats = null;
    if (stats) {
      toast('队列完成：' + stats.ok + ' 成功' + (stats.failed > 0 ? '，' + stats.failed + ' 失败' : ''));
    }
  }

  function pollJob(jobId) {
    api('/api/jobs/' + encodeURIComponent(jobId)).then(function (result) {
      var job = result.job;
      if (job.status === 'running') {
        var queueNote = state.buildFromQueue && state.buildQueue.length > 0
          ? ' · 剩余 ' + state.buildQueue.length + ' 篇'
          : '';
        renderWorking((job.message || '生成中…') + queueNote, jobId);
        setTimeout(function () { pollJob(jobId); }, 800);
        return;
      }
      state.building = null;
      state.currentJobId = null;
      if (job.status === 'done' && job.pack) {
        if (state.queueStats) state.queueStats.ok += 1;
        var continueButton = job.articleIndex === undefined
          ? ''
          : '<button class="btn" data-articles="' + escapeHtml(job.resourceId) + '">继续选文章</button>';
        var removedNote = job.removedItems ? ' · 移除 ' + job.removedItems + ' 个旧词' : '';
        els.importResult.innerHTML = '<div class="result-card"><div class="result-head"><div>' +
          '<div class="result-title">学习包已生成</div>' +
          '<div class="result-meta">' + job.pack.itemCount + ' 个学习项 · ' + escapeHtml(job.pack.title) + removedNote + '</div></div>' +
          '<div class="result-actions"><a class="btn btn-primary" href="' + escapeHtml(job.pack.url) + '">打开学习包</a>' +
          continueButton + '</div>' +
        '</div></div>';
        toast('学习包已生成');
        loadRecentImports();
        loadPacks();
        refreshStats();
        loadPlan();
        if (state.tab !== 'review') loadQueue();
        finishQueueStep();
        return;
      }
      if (state.queueStats) state.queueStats.failed += 1;
      if (job.status === 'cancelled') {
        renderImportError('已取消，没有写入学习包。', job.resourceId, job.articleIndex);
      } else {
        renderImportError(job.error || job.message || '生成失败', job.resourceId, job.articleIndex);
      }
      finishQueueStep();
    }).catch(function (error) {
      state.building = null;
      state.currentJobId = null;
      if (state.queueStats) state.queueStats.failed += 1;
      renderImportError(error.message);
      finishQueueStep();
    });
  }

  function deleteResource(resourceId, button) {
    if (button && button.getAttribute('data-confirm') !== '1') {
      button.setAttribute('data-confirm', '1');
      button.textContent = '确认删除';
      clearTimeout(button._confirmTimer);
      button._confirmTimer = setTimeout(function () {
        button.removeAttribute('data-confirm');
        button.textContent = '删除';
      }, 3000);
      return;
    }
    api('/api/resources/' + encodeURIComponent(resourceId) + '/delete', { method: 'POST' }).then(function (deleted) {
      toast('已移到回收站' + (deleted.removedPacks ? '，包含 ' + deleted.removedPacks + ' 个学习包' : '') +
        (deleted.removedItems ? '、' + deleted.removedItems + ' 个词条' : ''));
      state.stats = deleted.summary;
      renderStats();
      if (state.articleResource && state.articleResource.id === resourceId) {
        state.articleResource = null;
        state.importResource = null;
        state.importArticlesView = false;
        els.importResult.innerHTML = '';
        updateUrl();
      }
      loadRecentImports();
      loadPacks();
      if (state.tab === 'review') loadQueue();
    }).catch(function (error) {
      toast('删除失败：' + error.message);
    });
  }

  function resplitResource(resourceId) {
    api('/api/resources/' + encodeURIComponent(resourceId) + '/resplit', { method: 'POST' }).then(function (result) {
      toast('已重新解析为 ' + result.articleCount + ' 篇文章');
      loadRecentImports();
      openArticleList(resourceId);
    }).catch(function (error) {
      toast('重新解析失败：' + error.message);
    });
  }

  function toggleArticleOverride(resourceId, index, isArticle) {
    api('/api/resources/' + encodeURIComponent(resourceId) + '/articles/' + index + '/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isArticle: isArticle })
    }).then(function () {
      toast(isArticle ? '已设为文章' : '已从文章列表移除');
      openArticleList(resourceId, index);
      loadRecentImports();
    }).catch(function (error) {
      toast('操作失败：' + error.message);
    });
  }

  function cancelBuild(jobId) {
    state.buildQueue = [];
    state.buildFromQueue = false;
    state.queueStats = null;
    clearSavedQueue();
    api('/api/jobs/' + encodeURIComponent(jobId) + '/cancel', { method: 'POST' }).then(function () {
      toast('正在取消…');
    }).catch(function (error) {
      toast('取消失败：' + error.message);
    });
  }

  function selectedArticleEntries() {
    if (!state.articleResource) return [];
    var all = state.articles.concat(state.articleHidden);
    return Object.keys(state.selectedArticles)
      .map(Number)
      .map(function (index) {
        var article = all.find(function (entry) { return entry.index === index; });
        return article ? { resource: state.articleResource.id, article: index } : null;
      })
      .filter(Boolean);
  }

  function processBuildQueue() {
    if (state.building) return;
    var next = state.buildQueue.shift();
    saveQueue();
    if (!next) return;
    startBuild(next.resource, next.article, true);
  }

  function buildSelected() {
    var selected = selectedArticleEntries().filter(function (entry) {
      return !state.articlePacks.some(function (pack) { return pack.articleIndex === entry.article; });
    });
    if (selected.length === 0) {
      toast('先勾选未生成的文章');
      return;
    }
    if (selected.length > 10) {
      toast('一次最多生成 10 篇，请分批选择');
      return;
    }
    var button = document.getElementById('build-selected');
    if (selected.length > 2 && button && button.getAttribute('data-confirm') !== '1') {
      button.setAttribute('data-confirm', '1');
      button.textContent = '确认生成 ' + selected.length + ' 篇（约 ' + selected.length + ' 分钟）';
      clearTimeout(state.queueConfirmTimer);
      state.queueConfirmTimer = setTimeout(function () {
        if (!button) return;
        button.removeAttribute('data-confirm');
        button.textContent = '生成选中';
      }, 5000);
      return;
    }
    if (button) {
      button.removeAttribute('data-confirm');
      button.textContent = '生成选中';
    }
    state.queueStats = { ok: 0, failed: 0 };
    state.buildQueue = selected;
    state.selectedArticles = {};
    saveQueue();
    renderArticleRows();
    toast('已加入队列：' + selected.length + ' 篇');
    processBuildQueue();
  }

  function startBuild(resourceId, articleIndex, fromQueue) {
    if (state.building) {
      toast('正在生成，请稍候');
      return;
    }
    state.building = resourceId + ':' + (articleIndex === undefined ? 'all' : articleIndex);
    state.buildFromQueue = fromQueue === true;
    renderWorking('正在启动生成任务…');
    api('/api/resources/' + encodeURIComponent(resourceId) + '/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(articleIndex === undefined ? {} : { article: articleIndex }),
        limit:
          els.selectionSize && els.selectionSize.value !== 'auto'
            ? Number(els.selectionSize.value)
            : 'auto',
        audio: Boolean(els.buildAudio && els.buildAudio.checked),
        onlyNew: Boolean(els.onlyNew && els.onlyNew.checked),
        ...(els.buildStyle && els.buildStyle.value ? { style: els.buildStyle.value } : {})
      })
    }).then(function (result) {
      toast('已开始生成学习包');
      state.currentJobId = result.jobId;
      pollJob(result.jobId);
    }).catch(function (error) {
      state.building = null;
      state.currentJobId = null;
      renderImportError(error.message, resourceId, articleIndex);
      finishQueueStep();
    });
  }

  function setImportSource(source, focus) {
    var grid = document.getElementById('import-grid')
    var tabs = document.getElementById('source-tabs')
    if (!grid || !tabs) return
    grid.setAttribute('data-mode', source)
    tabs.querySelectorAll('[data-source]').forEach(function (button) {
      var active = button.getAttribute('data-source') === source
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', active ? 'true' : 'false')
    })
    if (!focus) return
    var target = {
      text: els.textBody,
      url: els.urlInput,
      pdf: els.pdfInput,
      ebook: els.ebookInput
    }[source]
    if (target && target.focus) target.focus()
  }

  var sourceTabs = document.getElementById('source-tabs')
  if (sourceTabs) {
    setImportSource('text', false)
    sourceTabs.addEventListener('click', function (event) {
      var target = event.target.closest('[data-source]')
      if (target) setImportSource(target.getAttribute('data-source'), true)
    })
  }

  els.textForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var text = els.textBody.value;
    if (!text.trim()) { toast('请先粘贴文本'); els.textBody.focus(); return; }
    renderWorking('正在导入文本…');
    api('/api/import/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text, title: els.textTitle.value.trim(), aiClean: document.getElementById('import-text-ai-clean').checked })
    }).then(function (result) {
      els.textBody.value = '';
      els.textTitle.value = '';
      afterImport(result.resource);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  });

  els.urlForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var value = els.urlInput.value.trim();
    if (!value) { toast('请填写网页链接'); els.urlInput.focus(); return; }
    renderWorking('正在抓取网页，最多等待 20 秒…');
    api('/api/import/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: value, title: els.urlTitle.value.trim(), aiClean: document.getElementById('import-url-ai-clean').checked })
    }).then(function (result) {
      els.urlInput.value = '';
      els.urlTitle.value = '';
      afterImport(result.resource);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  });

  els.pdfForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var file = els.pdfInput.files && els.pdfInput.files[0];
    if (!file) { toast('请选择一个 PDF 文件'); return; }
    renderWorking('正在上传并解析 PDF…');
    api('/api/import/pdf?name=' + encodeURIComponent(file.name) +
      '&title=' + encodeURIComponent(els.pdfTitle.value.trim()), {
      method: 'POST',
      body: file
    }).then(function (result) {
      els.pdfInput.value = '';
      els.pdfTitle.value = '';
      afterImport(result.resource);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  });

  els.ebookForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var file = els.ebookInput.files && els.ebookInput.files[0];
    if (!file) { toast('请选择一个 EPUB、MOBI 或 DOCX 文件'); return; }
    renderWorking('正在上传并解析文档…');
    api('/api/import/ebook?name=' + encodeURIComponent(file.name) +
      '&title=' + encodeURIComponent(els.ebookTitle.value.trim()), {
      method: 'POST',
      body: file
    }).then(function (result) {
      els.ebookInput.value = '';
      els.ebookTitle.value = '';
      afterImport(result.resource);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var clearTarget = target.closest('[data-clear-pack]');
    if (clearTarget) {
      event.preventDefault();
      clearPackFilter();
      return;
    }
    var revisionSaveTarget = target.closest('[data-output-revision-save]');
    if (revisionSaveTarget) {
      event.preventDefault();
      var revisionId = revisionSaveTarget.getAttribute('data-output-revision-save');
      var revisionInput = document.getElementById('output-revision-' + revisionId);
      var revisionText = revisionInput ? revisionInput.value.trim() : '';
      if (!revisionText) {
        toast('先改几句再保存');
        if (revisionInput) revisionInput.focus();
        return;
      }
      setBusy(revisionSaveTarget, true, '保存中…');
      api('/api/outputs/' + encodeURIComponent(revisionId) + '/revision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: revisionText }),
      }).then(function () {
        toast('新版本已保存');
        loadPlan();
      }).catch(function (error) {
        setBusy(revisionSaveTarget, false);
        toast('保存失败：' + error.message);
      });
      return;
    }
    var revisionFeedbackTarget = target.closest('[data-output-revision-feedback]');
    if (revisionFeedbackTarget) {
      event.preventDefault();
      var feedbackOutputId = revisionFeedbackTarget.getAttribute('data-output-id');
      var feedbackRevisionId = revisionFeedbackTarget.getAttribute('data-output-revision-feedback');
      setBusy(revisionFeedbackTarget, true, '编辑正在看…');
      api('/api/outputs/' + encodeURIComponent(feedbackOutputId) + '/revisions/' +
        encodeURIComponent(feedbackRevisionId) + '/feedback', { method: 'POST' })
        .then(function () {
          toast('这一版的编辑回信已收到');
          loadPlan();
        })
        .catch(function (error) {
          setBusy(revisionFeedbackTarget, false);
          toast('生成失败：' + error.message);
        });
      return;
    }
    var outputFeedbackTarget = target.closest('[data-output-feedback]');
    if (outputFeedbackTarget) {
      event.preventDefault();
      var feedbackId = outputFeedbackTarget.getAttribute('data-output-feedback');
      outputFeedbackTarget.disabled = true;
      outputFeedbackTarget.textContent = '编辑正在看…';
      api('/api/outputs/' + encodeURIComponent(feedbackId) + '/feedback', { method: 'POST' })
        .then(function () {
          toast('编辑回信已收到');
          loadPlan();
        })
        .catch(function (error) {
          outputFeedbackTarget.disabled = false;
          outputFeedbackTarget.textContent = '让编辑看看';
          toast('生成失败：' + error.message);
        });
      return;
    }
    var clearTypeTarget = target.closest('[data-clear-type]');
    if (clearTypeTarget) {
      event.preventDefault();
      setSentenceOnlyReview(false);
      return;
    }
    var sentenceReviewTarget = target.closest('[data-sentence-review]');
    if (sentenceReviewTarget) {
      event.preventDefault();
      switchTab('review');
      setSentenceOnlyReview(true);
      return;
    }
    var cancelTarget = target.closest('[data-cancel-job]');
    if (cancelTarget) {
      event.preventDefault();
      cancelBuild(cancelTarget.getAttribute('data-cancel-job'));
      return;
    }
    var stopQueueTarget = target.closest('[data-stop-queue]');
    if (stopQueueTarget) {
      event.preventDefault();
      stopQueue();
      return;
    }
    var deleteResourceTarget = target.closest('[data-delete-resource]');
    if (deleteResourceTarget) {
      event.preventDefault();
      deleteResource(deleteResourceTarget.getAttribute('data-delete-resource'), deleteResourceTarget);
      return;
    }
    var resplitTarget = target.closest('[data-resplit]');
    if (resplitTarget) {
      event.preventDefault();
      resplitResource(resplitTarget.getAttribute('data-resplit'));
      return;
    }
    var overrideTarget = target.closest('[data-override-article]');
    if (overrideTarget && state.articleResource) {
      event.preventDefault();
      toggleArticleOverride(
        state.articleResource.id,
        Number(overrideTarget.getAttribute('data-override-article')),
        overrideTarget.getAttribute('data-override-value') === 'true'
      );
      return;
    }
    var rebuildTarget = target.closest('[data-rebuild-resource]');
    if (rebuildTarget) {
      event.preventDefault();
      switchTab('import');
      startBuild(
        rebuildTarget.getAttribute('data-rebuild-resource'),
        Number(rebuildTarget.getAttribute('data-rebuild-article'))
      );
      return;
    }
    var tabTarget = target.closest('[data-go-tab]');
    if (tabTarget) {
      event.preventDefault();
      switchTab(tabTarget.getAttribute('data-go-tab'));
      return;
    }
    var articlesTarget = target.closest('[data-articles]');
    if (articlesTarget) {
      event.preventDefault();
      openArticleList(articlesTarget.getAttribute('data-articles'));
      return;
    }
    var articleBuildTarget = target.closest('[data-build-article]');
    if (articleBuildTarget) {
      event.preventDefault();
      startBuild(
        articleBuildTarget.getAttribute('data-build-resource'),
        Number(articleBuildTarget.getAttribute('data-build-article'))
      );
      return;
    }
    var buildTarget = target.closest('[data-build]');
    if (buildTarget) {
      event.preventDefault();
      var article = buildTarget.getAttribute('data-article');
      startBuild(buildTarget.getAttribute('data-build'), article === null ? undefined : Number(article));
      return;
    }
    var infoTarget = target.closest('[data-resource-info]');
    if (infoTarget) {
      event.preventDefault();
      if (state.articleResource) showImportResult(state.articleResource);
      return;
    }
    var resourceTarget = target.closest('[data-resource]');
    if (resourceTarget) {
      var id = resourceTarget.getAttribute('data-resource');
      var resource = state.resources.find(function (entry) { return entry.id === id; });
      if (resource) showImportResult(resource);
    }
  });

  function svgElement(name, attributes) {
    var element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
    return element;
  }

  var GRAPH_SETTINGS_KEY = 'learn-graph-settings-v2';

  function saveGraphSettings() {
    try {
      localStorage.setItem(GRAPH_SETTINGS_KEY, JSON.stringify({
        mode: els.graphViewMode.value,
        labels: els.graphLabels.value,
        threshold: els.graphThreshold.value,
        negative: els.graphNegative.checked,
        roots: els.graphRoots.checked,
        ghosts: els.graphGhosts.checked,
        context: els.graphContext.checked,
        hideKnown: els.graphHideKnown.checked,
        hideIsolated: els.graphHideIsolated.checked
      }));
    } catch (error) {
      // Settings persistence is a convenience.
    }
  }

  function applyGraphSettings() {
    var defaults = {
      mode: 'network',
      labels: 'auto',
      threshold: '1.5',
      negative: true,
      roots: true,
      ghosts: false,
      context: false,
      hideKnown: false,
      hideIsolated: true
    };
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(GRAPH_SETTINGS_KEY) || '{}') || {};
    } catch (error) {
      saved = {};
    }
    els.graphViewMode.value = saved.mode && ['network', 'tree', 'clusters'].indexOf(saved.mode) !== -1
      ? saved.mode
      : defaults.mode;
    els.graphLabels.value = saved.labels && ['auto', 'all', 'off'].indexOf(saved.labels) !== -1
      ? saved.labels
      : defaults.labels;
    syncCustomSelect(els.graphViewMode);
    syncCustomSelect(els.graphLabels);
    els.graphThreshold.value = saved.threshold || defaults.threshold;
    els.graphNegative.checked = typeof saved.negative === 'boolean' ? saved.negative : defaults.negative;
    els.graphRoots.checked = typeof saved.roots === 'boolean' ? saved.roots : defaults.roots;
    els.graphGhosts.checked = typeof saved.ghosts === 'boolean' ? saved.ghosts : defaults.ghosts;
    els.graphContext.checked = typeof saved.context === 'boolean' ? saved.context : defaults.context;
    els.graphHideKnown.checked = typeof saved.hideKnown === 'boolean' ? saved.hideKnown : defaults.hideKnown;
    els.graphHideIsolated.checked = typeof saved.hideIsolated === 'boolean' ? saved.hideIsolated : defaults.hideIsolated;
    els.graphThresholdValue.textContent = els.graphThreshold.value;
  }

  function graphVisibleData() {
    var hideKnown = els.graphHideKnown.checked;
    var hideIsolated = els.graphHideIsolated.checked;
    var roots = els.graphRoots.checked;
    var nodes = state.graph.nodes.filter(function (node) { return !hideKnown || node.status !== 'known'; });
    var ids = {};
    nodes.forEach(function (node) { ids[node.id] = true; });
    var edges = state.graph.edges.filter(function (edge) {
      return ids[edge.source] && ids[edge.target] && (roots || edge.type !== 'root');
    });
    var degree = {};
    edges.forEach(function (edge) {
      degree[edge.source] = (degree[edge.source] || 0) + 1;
      degree[edge.target] = (degree[edge.target] || 0) + 1;
    });
    nodes = nodes.map(function (node) {
      return { ...node, degree: degree[node.id] || 0 };
    });
    if (hideIsolated) nodes = nodes.filter(function (node) { return node.degree > 0; });
    return { nodes: nodes, edges: edges };
  }

  function loadGraph() {
    var threshold = Number(els.graphThreshold.value) || 1.5;
    var negative = els.graphNegative.checked ? '1' : '0';
    var ghosts = els.graphGhosts.checked ? '1' : '0';
    var context = els.graphContext.checked ? '1' : '0';
    els.graphThresholdValue.textContent = String(threshold);
    els.graphMeta.textContent = '正在计算词网…';
    saveGraphSettings();
    return api('/api/graph?threshold=' + encodeURIComponent(String(threshold)) + '&negative=' + negative +
      '&ghosts=' + ghosts + '&context=' + context).then(function (result) {
      state.graph = result;
      state.graphSelected = null;
      state.graphPathStart = null;
      state.graphPath = [];
      els.graphDetail.hidden = true;
      renderGraph();
      focusGraphWord();
    }).catch(function (error) {
      els.graph.innerHTML = '';
      els.graphMeta.textContent = '无法加载词网：' + error.message;
    });
  }

  function graphLayout(nodes, edges) {
    var width = 960;
    var height = 620;
    var positions = nodes.map(function (node, index) {
      var angle = index * 2.399963229728653;
      var radius = 140 + Math.sqrt(index + 1) * 20;
      return { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
    });
    var indexById = {};
    nodes.forEach(function (node, index) { indexById[node.id] = index; });
    var links = edges
      .map(function (edge) {
        return { edge: edge, a: indexById[edge.source], b: indexById[edge.target] };
      })
      .filter(function (link) { return link.a !== undefined && link.b !== undefined; });

    for (var iteration = 0; iteration < 180; iteration++) {
      var forceX = new Array(nodes.length).fill(0);
      var forceY = new Array(nodes.length).fill(0);
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = positions[i].x - positions[j].x;
          var dy = positions[i].y - positions[j].y;
          var distanceSq = dx * dx + dy * dy + 80;
          var repulsion = 9000 / distanceSq;
          var length = Math.sqrt(dx * dx + dy * dy) || 1;
          var fx = (dx / length) * repulsion;
          var fy = (dy / length) * repulsion;
          forceX[i] += fx;
          forceY[i] += fy;
          forceX[j] -= fx;
          forceY[j] -= fy;
        }
      }
      links.forEach(function (link) {
        var dx = positions[link.b].x - positions[link.a].x;
        var dy = positions[link.b].y - positions[link.a].y;
        var distance = Math.sqrt(dx * dx + dy * dy) || 1;
        var pull = (distance - 105) * 0.016;
        var fx = (dx / distance) * pull;
        var fy = (dy / distance) * pull;
        forceX[link.a] += fx;
        forceY[link.a] += fy;
        forceX[link.b] -= fx;
        forceY[link.b] -= fy;
      });
      for (var k = 0; k < nodes.length; k++) {
        forceX[k] += (width / 2 - positions[k].x) * 0.002;
        forceY[k] += (height / 2 - positions[k].y) * 0.002;
        var step = Math.min(8, Math.sqrt(forceX[k] * forceX[k] + forceY[k] * forceY[k]));
        var angle = Math.atan2(forceY[k], forceX[k]);
        positions[k].x += Math.cos(angle) * step;
        positions[k].y += Math.sin(angle) * step;
      }
    }

    var minX = Math.min.apply(null, positions.map(function (position) { return position.x; }));
    var maxX = Math.max.apply(null, positions.map(function (position) { return position.x; }));
    var minY = Math.min.apply(null, positions.map(function (position) { return position.y; }));
    var maxY = Math.max.apply(null, positions.map(function (position) { return position.y; }));
    var scale = Math.min((width - 140) / Math.max(1, maxX - minX), (height - 120) / Math.max(1, maxY - minY));
    positions.forEach(function (position) {
      position.x = 70 + (position.x - minX) * scale;
      position.y = 60 + (position.y - minY) * scale;
    });
    return { positions: positions, links: links };
  }

  function renderGraph() {
    if (!state.graph) return;
    var mode = els.graphViewMode.value;
    if (mode === 'tree') {
      els.graphWrap.hidden = true;
      els.graphTree.hidden = false;
      els.graphClusters.hidden = true;
      renderFamilyTree();
      return;
    }
    if (mode === 'clusters') {
      els.graphWrap.hidden = true;
      els.graphTree.hidden = true;
      els.graphClusters.hidden = false;
      renderClusters();
      return;
    }
    els.graphWrap.hidden = false;
    els.graphTree.hidden = true;
    els.graphClusters.hidden = true;
    renderNetwork();
  }

  function applyGraphTransform() {
    var viewport = els.graph.querySelector('.graph-viewport');
    if (!viewport) return;
    viewport.setAttribute(
      'transform',
      'translate(' + state.graphPanX + ',' + state.graphPanY + ') scale(' + state.graphZoom + ')'
    );
  }

  function renderNetwork() {
    var data = graphVisibleData();
    var nodes = data.nodes;
    var edges = data.edges;
    var ghostCount = nodes.filter(function (node) { return node.ghost; }).length;
    var clusterCount = new Set(nodes.map(function (node) { return node.cluster; })).size;
    els.graphMeta.textContent = nodes.length + ' 个词 · ' + edges.length + ' 条关联 · ' +
      ghostCount + ' 个未学词 · ' + clusterCount + ' 个词簇 · 阈值 ' + els.graphThreshold.value;

    els.graph.innerHTML = '';
    if (nodes.length === 0) {
      els.graphMeta.textContent = '还没有可展示的词汇。';
      return;
    }
    var layout = graphLayout(nodes, edges);
    var viewport = svgElement('g', { class: 'graph-viewport' });

    layout.links.forEach(function (link) {
      var edge = link.edge;
      var line = svgElement('line', {
        x1: layout.positions[link.a].x,
        y1: layout.positions[link.a].y,
        x2: layout.positions[link.b].x,
        y2: layout.positions[link.b].y,
        'stroke-width': Math.min(4, 1 + edge.weight / 2),
      });
      var edgeClass = 'gedge' + (edge.positive ? '' : ' negative') +
        (edge.type === 'root' ? ' root' : edge.type === 'context' ? ' context' : '');
      line.setAttribute('class', edgeClass);
      line.setAttribute('data-source', edge.source);
      line.setAttribute('data-target', edge.target);
      var title = svgElement('title', {});
      title.textContent = edge.type + (edge.via ? ' · ' + edge.via : '') + ' · ' + edge.weight.toFixed(1);
      line.appendChild(title);
      viewport.appendChild(line);
    });

    nodes.forEach(function (node, index) {
      var radius = 7 + Math.min(10, node.degree * 1.3);
      var labelMode = els.graphLabels.value;
      var labelThreshold = nodes.length <= 30 ? 1 : nodes.length <= 80 ? 8 : 8;
      var showLabel = labelMode === 'all' || (labelMode === 'auto' && !node.ghost && node.degree >= labelThreshold);
      var classes = 'gnode' + (showLabel ? ' labeled' : '');
      if (node.ghost) classes += ' ghost';
      else if (node.status === 'known') classes += ' known';
      else if (node.status === 'suspended') classes += ' suspended';
      if (!node.ghost && node.dueLabel === '今天到期') classes += ' due';
      var group = svgElement('g', {
        class: classes,
        transform: 'translate(' + layout.positions[index].x + ',' + layout.positions[index].y + ')',
        'data-graph-node': node.id,
      });
      var title = svgElement('title', {});
      title.textContent = node.lemma + ' — ' + node.sense + (node.ghost ? ' · 未学习' : '');
      group.appendChild(title);
      group.appendChild(svgElement('circle', { r: radius }));
      var label = svgElement('text', { x: 0, y: radius + 12, 'text-anchor': 'middle' });
      label.textContent = node.lemma;
      group.appendChild(label);
      group.addEventListener('click', function (event) {
        event.stopPropagation();
        selectGraphNode(node.id);
      });
      viewport.appendChild(group);
    });

    els.graph.appendChild(viewport);
    state.graphPositions = layout.positions;
    state.graphNodes = nodes;
    state.graphEdges = edges;
    applyGraphTransform();
    applyGraphSearch();
    if (state.graphSelected) {
      if (nodes.some(function (node) { return node.id === state.graphSelected; })) selectGraphNode(state.graphSelected);
      else {
        state.graphSelected = null;
        els.graphDetail.hidden = true;
      }
    }
  }

  function graphNodeChip(node) {
    var classes = 'graph-word' +
      (node.status === 'known' ? ' known' : '') +
      (node.ghost ? ' ghost' : '') +
      (!node.ghost && node.dueLabel === '今天到期' ? ' due' : '');
    return '<button class="' + classes + '" type="button" data-graph-word="' + escapeHtml(node.id) + '">' +
      escapeHtml(node.lemma) + '</button>';
  }

  function reviewWordsUrl(nodes, label) {
    var ids = nodes.filter(function (node) { return !node.ghost; }).map(function (node) { return node.id; });
    if (ids.length === 0) return '';
    return '/?tab=review&words=' + ids.map(encodeURIComponent).join(',') + '&label=' + encodeURIComponent(label);
  }

  function renderFamilyTree() {
    var nodeById = {};
    state.graph.nodes.forEach(function (node) { nodeById[node.id] = node; });
    var hideKnown = els.graphHideKnown.checked;
    var families = (state.graph.families || [])
      .map(function (family) {
        var words = family.wordIds
          .map(function (id) { return nodeById[id]; })
          .filter(function (node) { return node && (!hideKnown || node.status !== 'known'); });
        return { family: family, words: words };
      })
      .filter(function (entry) { return entry.words.length >= 2; });
    els.graphMeta.textContent = families.length + ' 个词族 · 点击词查看网络';
    if (families.length === 0) {
      els.graphTree.innerHTML = '<div class="empty" style="padding:26px"><strong>还没有可聚合的词族</strong>词根、前缀或后缀相同的词达到两个后会出现在这里。</div>';
      return;
    }
    els.graphTree.innerHTML = families.map(function (entry) {
      var family = entry.family;
      var due = entry.words.filter(function (node) { return node.dueLabel === '今天到期'; }).length;
      var review = reviewWordsUrl(entry.words, family.form);
      return '<div class="family-card"><div class="family-head"><div class="family-hub"><strong>' +
        escapeHtml(family.form) + '</strong><span>' + escapeHtml(family.kind) +
        (family.meaning ? ' · ' + escapeHtml(family.meaning) : '') + ' · ' + entry.words.length + ' 词' +
        (due ? ' · ' + due + ' 到期' : '') + '</span></div>' +
        (review ? '<a class="family-review" href="' + escapeHtml(review) + '">复习这组</a>' : '') +
        '</div><div class="family-words">' + entry.words.map(graphNodeChip).join('') + '</div></div>';
    }).join('');
  }

  function renderClusters() {
    var data = graphVisibleData();
    var groups = {};
    data.nodes.forEach(function (node) {
      var key = String(node.cluster === undefined ? 0 : node.cluster);
      groups[key] = groups[key] || [];
      groups[key].push(node);
    });
    var clusters = Object.keys(groups)
      .map(function (key) { return groups[key]; })
      .sort(function (a, b) { return b.length - a.length; });
    els.graphMeta.textContent = clusters.length + ' 个词簇 · ' + data.nodes.length + ' 个词 · 点击词查看网络';
    if (clusters.length === 0) {
      els.graphClusters.innerHTML = '<div class="empty" style="padding:26px"><strong>还没有可聚合的词簇</strong>增加关联词或打开上下文层后再看。</div>';
      return;
    }
    els.graphClusters.innerHTML = clusters.map(function (nodes, index) {
      var learned = nodes.filter(function (node) { return !node.ghost; });
      var due = learned.filter(function (node) { return node.dueLabel === '今天到期'; }).length;
      var sources = [];
      nodes.forEach(function (node) {
        if (node.sourcePack && sources.indexOf(node.sourcePack.title) === -1) sources.push(node.sourcePack.title);
      });
      var label = sources.length === 1 ? sources[0] : '词簇 ' + (index + 1);
      var review = reviewWordsUrl(learned, label);
      return '<div class="cluster-card"><div class="cluster-head"><div><strong>' + escapeHtml(label) +
        '</strong><span>' + nodes.length + ' 个词 · ' + due + ' 到期 · ' +
        nodes.filter(function (node) { return node.ghost; }).length + ' 个未学词</span></div>' +
        (review ? '<a class="cluster-review" href="' + escapeHtml(review) + '">复习这组</a>' : '') +
        '</div><div class="cluster-words">' + nodes.map(graphNodeChip).join('') + '</div></div>';
    }).join('');
  }

  function showNodeInNetwork(id) {
    els.graphViewMode.value = 'network';
    syncCustomSelect(els.graphViewMode);
    saveGraphSettings();
    renderGraph();
    selectGraphNode(id);
  }

  function applyGraphSearch() {
    var query = els.graphSearch.value.trim().toLowerCase();
    state.graphQuery = query;
    document.querySelectorAll('#word-graph .gnode').forEach(function (group) {
      var node = (state.graphNodes || []).find(function (entry) {
        return entry.id === group.getAttribute('data-graph-node');
      });
      var hit = query && node && node.lemma.toLowerCase().indexOf(query) !== -1;
      group.classList.toggle('hit', Boolean(hit));
      group.classList.toggle('dim', Boolean(query && !hit));
    });
  }

  function graphNeighborhood(startId, hops) {
    var visited = {};
    var frontier = [startId];
    visited[startId] = 0;
    for (var depth = 0; depth < hops; depth++) {
      var next = [];
      frontier.forEach(function (id) {
        (state.graphEdges || []).forEach(function (edge) {
          var other = edge.source === id ? edge.target : edge.target === id ? edge.source : null;
          if (other && visited[other] === undefined) {
            visited[other] = depth + 1;
            next.push(other);
          }
        });
      });
      frontier = next;
    }
    return Object.keys(visited).filter(function (id) { return id !== startId; });
  }

  function findGraphPath(startId, endId) {
    if (startId === endId) return [startId];
    var queue = [startId];
    var parent = {};
    parent[startId] = null;
    while (queue.length > 0) {
      var current = queue.shift();
      for (var i = 0; i < (state.graphEdges || []).length; i++) {
        var edge = state.graphEdges[i];
        var other = edge.source === current ? edge.target : edge.target === current ? edge.source : null;
        if (!other || parent[other] !== undefined) continue;
        parent[other] = current;
        if (other === endId) {
          var path = [endId];
          var cursor = endId;
          while (parent[cursor] !== null && parent[cursor] !== undefined) {
            cursor = parent[cursor];
            path.unshift(cursor);
          }
          return path;
        }
        queue.push(other);
      }
    }
    return [];
  }

  function focusGraphWord() {
    if (!state.graphFocus) return;
    var lemma = String(state.graphFocus);
    state.graphFocus = null;
    var node = (state.graphNodes || []).find(function (entry) {
      return entry.lemma.toLowerCase() === lemma.toLowerCase();
    });
    if (!node) {
      toast('关系图里还没有「' + lemma + '」这个词');
      return;
    }
    if (els.graphSearch) els.graphSearch.value = node.lemma;
    applyGraphSearch();
    selectGraphNode(node.id);
  }

  function selectGraphNode(id) {
    var node = (state.graphNodes || []).find(function (entry) { return entry.id === id; });
    if (!node) return;
    state.graphSelected = id;

    if (state.graphPathStart && state.graphPathStart !== id) {
      var path = findGraphPath(state.graphPathStart, id);
      state.graphPath = path;
      if (path.length === 0) toast('这两个词之间还没有可用路径');
    }

    var pathSet = new Set(state.graphPath);
    var neighbors = pathSet.size > 1 ? [] : graphNeighborhood(id, state.graphHop);
    var visibleSet = new Set([id].concat(neighbors, Array.from(pathSet)));

    document.querySelectorAll('#word-graph .gnode').forEach(function (group) {
      var other = group.getAttribute('data-graph-node');
      group.classList.toggle('selected', other === id || pathSet.has(other));
      group.classList.toggle('neighbor', neighbors.indexOf(other) !== -1);
      group.classList.toggle('dim', !visibleSet.has(other));
    });
    document.querySelectorAll('#word-graph .gedge').forEach(function (line) {
      var a = line.getAttribute('data-source');
      var b = line.getAttribute('data-target');
      var inPath = false;
      for (var i = 0; i < state.graphPath.length - 1; i++) {
        if ((a === state.graphPath[i] && b === state.graphPath[i + 1]) ||
            (b === state.graphPath[i] && a === state.graphPath[i + 1])) inPath = true;
      }
      var related = a === id || b === id;
      line.classList.toggle('active', pathSet.size > 1 ? inPath : related);
      line.classList.toggle('dim', pathSet.size > 1 ? !inPath : !related);
    });

    var neighborNodes = neighbors
      .map(function (neighborId) {
        return (state.graphNodes || []).find(function (entry) { return entry.id === neighborId; });
      })
      .filter(Boolean);
    var chips = neighborNodes.map(graphNodeChip).join('');
    var hopButtons = '<button class="neighbor" data-graph-hop="1"' + (state.graphHop === 1 ? ' style="border-color:var(--accent)"' : '') + '>1 跳</button>' +
      '<button class="neighbor" data-graph-hop="2"' + (state.graphHop === 2 ? ' style="border-color:var(--accent)"' : '') + '>2 跳</button>';
    var pathSection = '';
    if (state.graphPath.length > 1) {
      pathSection = '<div class="detail-links">' + state.graphPath.map(function (pathId) {
        var pathNode = (state.graphNodes || []).find(function (entry) { return entry.id === pathId; });
        return pathNode ? graphNodeChip(pathNode) : '';
      }).join('<span class="due">→</span>') + '</div>' +
        '<div class="detail-links"><button class="neighbor" data-graph-path="clear">清除路径</button></div>';
    } else {
      pathSection = '<div class="detail-links">' + hopButtons +
        '<button class="neighbor" data-graph-path="start">设为路径起点</button></div>';
    }

    els.graphDetail.innerHTML =
      '<button class="detail-close" data-graph-close="1" type="button">×</button>' +
      '<h3>' + escapeHtml(node.lemma) + '</h3>' +
      '<div class="detail-sense">' + escapeHtml(node.sense) + '</div>' +
      (node.definitionZh ? '<div class="detail-zh">' + escapeHtml(node.definitionZh) + '</div>' : '') +
      '<div class="due">' + escapeHtml(node.ghost ? '尚未学习' : node.status === 'known' ? '已掌握' : node.dueLabel || '') +
        ' · 关联 ' + (chips ? neighborNodes.length : 0) + ' 个词</div>' +
      (chips ? '<div class="detail-links">' + chips + '</div>' : '<div class="result-meta">这个词还没有关联词。</div>') +
      (node.ghost ? '<div class="detail-links"><button class="neighbor" data-adopt-ghost="' + escapeHtml(node.lemma) + '">加入学习包</button></div>' : '') +
      (!node.ghost && node.degree < 3 ? '<div class="detail-links"><button class="neighbor" data-enrich-item="' + escapeHtml(node.id) + '">AI 补全关系</button></div>' : '') +
      pathSection +
      (node.sourcePack ? '<div class="detail-links"><a class="source-link" href="' + escapeHtml(node.sourcePack.url) + '">打开来源学习包</a></div>' : '');
    els.graphDetail.hidden = false;
  }

  var TAB_META = {
    read: ['READ', '精读'],
    packs: ['READ', '文章列表'],
    review: ['VOCAB', '背单词'],
    vocab: ['VOCAB', '背单词'],
    passport: ['PROGRESS', '成长'],
    insights: ['WEEKLY REVIEW', '复盘'],
    graph: ['WORD GRAPH', '词网'],
    import: ['NEW MATERIAL', '导入文章'],
    settings: ['SETTINGS', '设置']
  };
  var TAB_ALIASES = { home: 'read', library: 'vocab' };
  var TAB_VIEW = {
    read: 'view-home',
    packs: 'view-packs',
    vocab: 'view-library',
    review: 'view-review',
    import: 'view-import',
    settings: 'view-settings',
    passport: 'view-passport',
    insights: 'view-insights',
    graph: 'view-graph'
  };

  function normalizeTab(tab) {
    return TAB_ALIASES[tab] || tab;
  }

  function navTabFor(tab) {
    if (tab === 'read' || tab === 'packs' || tab === 'import') return 'read';
    if (tab === 'vocab' || tab === 'review') return 'vocab';
    if (tab === 'passport' || tab === 'insights' || tab === 'graph') return 'more';
    return '';
  }

  function switchTab(tab, fromHistory) {
    tab = normalizeTab(tab);
    if (!TAB_VIEW[tab]) tab = 'read';
    state.tab = tab;
    var navTab = navTabFor(tab);
    document.querySelectorAll('[data-tab]').forEach(function (button) {
      var active = button.getAttribute('data-tab') === navTab;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    var more = document.querySelector('[data-more]');
    if (more) {
      more.classList.toggle('active', navTab === 'more');
      if (navTab === 'more') more.setAttribute('open', '');
    }
    var meta = TAB_META[tab] || TAB_META.read;
    var title = document.getElementById('page-title');
    var eyebrow = document.getElementById('page-eyebrow');
    if (title) title.textContent = meta[1];
    if (eyebrow) eyebrow.textContent = meta[0];
    document.title = meta[1] + ' · CloseRead';
    document.body.setAttribute('data-tab', tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateUrl(!fromHistory);
    Object.keys(TAB_VIEW).forEach(function (key) {
      var view = document.getElementById(TAB_VIEW[key]);
      if (view) view.classList.toggle('active', key === tab);
    });
    if (tab === 'read') loadPlan();
    if (tab === 'vocab') loadLibrary();
    if (tab === 'packs') loadPacks();
    if (tab === 'passport') { loadPassport(); loadGrowthWeekly(); }
    if (tab === 'insights') loadInsights();
    if (tab === 'graph') loadGraph();
    if (tab === 'import') loadRecentImports();
    if (tab === 'settings') loadSettings();
    if (tab === 'review') {
      loadPlan();
      loadForecast();
      if (!state.current && state.queue.length === 0) loadQueue();
    }
  }

  function closeMobileMore() {
    var sheet = document.getElementById('mobile-more');
    if (sheet) sheet.hidden = true;
  }

  document.querySelectorAll('[data-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      switchTab(button.getAttribute('data-tab'));
      closeMobileMore();
    });
  });
  var mobileMoreButton = document.querySelector('[data-mobile-more]');
  if (mobileMoreButton) mobileMoreButton.addEventListener('click', function () {
    var sheet = document.getElementById('mobile-more');
    if (sheet) sheet.hidden = !sheet.hidden;
  });
  document.querySelectorAll('[data-mobile-more-close]').forEach(function (button) {
    button.addEventListener('click', closeMobileMore);
  });
  var mobileMore = document.getElementById('mobile-more');
  if (mobileMore) mobileMore.addEventListener('click', function (event) {
    if (event.target === mobileMore) closeMobileMore();
  });
  window.addEventListener('popstate', function () {
    var params = new URLSearchParams(location.search);
    var tab = normalizeTab(params.get('tab') || 'read');
    if (TAB_VIEW[tab]) switchTab(tab, true);
  });
  var passportStamps = document.getElementById('passport-stamps');
  if (passportStamps) {
    passportStamps.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-passport-share]') : null;
      if (target) openPassportCard(target.getAttribute('data-passport-share'));
    });
  }
  var passportClose = document.getElementById('passport-card-close');
  if (passportClose) passportClose.addEventListener('click', closePassportCard);
  var passportDownload = document.getElementById('passport-download');
  if (passportDownload) passportDownload.addEventListener('click', downloadPassportCard);
  var passportModal = document.getElementById('passport-modal');
  if (passportModal) {
    passportModal.addEventListener('click', function (event) {
      if (event.target === passportModal) closePassportCard();
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && passportModal && !passportModal.hidden) closePassportCard();
    if (event.key === 'Escape' && els.lanPanel && !els.lanPanel.hidden) els.lanPanel.hidden = true;
  });
  els.clearPack.addEventListener('click', clearPackFilter);
  if (els.undoReview) els.undoReview.addEventListener('click', undoReview);
  if (els.lanToggle) {
    els.lanToggle.addEventListener('click', function () {
      if (!els.lanPanel) return;
      els.lanPanel.hidden = !els.lanPanel.hidden;
      if (!els.lanPanel.hidden) loadLanStatus();
    });
  }
  var lanClose = document.getElementById('lan-close');
  if (lanClose) {
    lanClose.addEventListener('click', function () {
      if (els.lanPanel) els.lanPanel.hidden = true;
    });
  }
  if (els.saveRetention) {
    els.saveRetention.addEventListener('click', function () {
      var value = Number(els.reviewRetention && els.reviewRetention.value || 0.9);
      els.saveRetention.disabled = true;
      if (els.retentionState) els.retentionState.textContent = '保存中…';
      api('/api/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ desiredRetention: value }),
      }).then(function (result) {
        if (els.retentionState) els.retentionState.textContent = '已保存';
        if (result && result.preferences && els.reviewRetention) {
          els.reviewRetention.value = Number(result.preferences.desiredRetention).toFixed(2);
          syncCustomSelect(els.reviewRetention);
        }
        loadPlan();
      }).catch(function (error) {
        if (els.retentionState) els.retentionState.textContent = error.message;
      }).finally(function () {
        els.saveRetention.disabled = false;
      });
    });
  }
  var reviewSentenceOnly = document.getElementById('review-sentence-only');
  if (reviewSentenceOnly) {
    reviewSentenceOnly.addEventListener('click', function () {
      setSentenceOnlyReview(state.typeFilter !== 'sentence');
    });
    updateReviewMode();
  }
  els.resumeQueue.addEventListener('click', resumeQueue);
  els.clearQueue.addEventListener('click', discardSavedQueue);

  document.addEventListener('change', function (event) {
    var checkbox = event.target && event.target.closest ? event.target.closest('[data-queue-article]') : null;
    if (!checkbox) return;
    var index = Number(checkbox.getAttribute('data-queue-article'));
    if (checkbox.checked) state.selectedArticles[index] = true;
    else delete state.selectedArticles[index];
  });

  els.graphSearch.addEventListener('input', applyGraphSearch);
  els.graphSearch.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    var query = els.graphSearch.value.trim().toLowerCase();
    if (!query) return;
    var found = (state.graphNodes || []).find(function (node) {
      return node.lemma.toLowerCase().indexOf(query) !== -1;
    });
    if (!found) return;
    var index = (state.graphNodes || []).findIndex(function (node) { return node.id === found.id; });
    var position = (state.graphPositions || [])[index];
    if (position) {
      state.graphZoom = Math.max(1.35, state.graphZoom);
      state.graphPanX = 480 - position.x * state.graphZoom;
      state.graphPanY = 310 - position.y * state.graphZoom;
      applyGraphTransform();
    }
    selectGraphNode(found.id);
  });
  els.graphThreshold.addEventListener('input', function () {
    els.graphThresholdValue.textContent = els.graphThreshold.value;
  });  els.graphThreshold.addEventListener('change', loadGraph);
  els.graphNegative.addEventListener('change', loadGraph);
  els.graphGhosts.addEventListener('change', loadGraph);
  els.graphContext.addEventListener('change', loadGraph);
  els.graphRoots.addEventListener('change', function () { saveGraphSettings(); renderGraph(); });
  els.graphHideKnown.addEventListener('change', function () { saveGraphSettings(); renderGraph(); });
  els.graphHideIsolated.addEventListener('change', function () { saveGraphSettings(); renderGraph(); });
  els.graphViewMode.addEventListener('change', function () { saveGraphSettings(); renderGraph(); });
  els.graphLabels.addEventListener('change', function () { saveGraphSettings(); renderGraph(); });
  els.graphReset.addEventListener('click', function () {
    state.graphZoom = 1;
    state.graphPanX = 0;
    state.graphPanY = 0;
    renderGraph();
  });
  els.graphZoomIn.addEventListener('click', function () {
    state.graphZoom = Math.min(2.5, state.graphZoom * 1.15);
    applyGraphTransform();
  });
  els.graphZoomOut.addEventListener('click', function () {
    state.graphZoom = Math.max(0.4, state.graphZoom / 1.15);
    applyGraphTransform();
  });
  els.graphZoomReset.addEventListener('click', function () {
    state.graphZoom = 1;
    state.graphPanX = 0;
    state.graphPanY = 0;
    applyGraphTransform();
  });
  els.graph.addEventListener('wheel', function (event) {
    event.preventDefault();
    state.graphZoom = Math.max(0.4, Math.min(2.5, state.graphZoom * (event.deltaY < 0 ? 1.1 : 0.9)));
    applyGraphTransform();
  }, { passive: false });
  var graphPanning = false;
  var graphPanStart = null;
  els.graph.addEventListener('mousedown', function (event) {
    if (event.target.closest('.gnode')) return;
    graphPanning = true;
    graphPanStart = { x: event.clientX, y: event.clientY, panX: state.graphPanX, panY: state.graphPanY };
  });
  window.addEventListener('mousemove', function (event) {
    if (!graphPanning || !graphPanStart) return;
    state.graphPanX = graphPanStart.panX + (event.clientX - graphPanStart.x);
    state.graphPanY = graphPanStart.panY + (event.clientY - graphPanStart.y);
    applyGraphTransform();
  });
  window.addEventListener('mouseup', function () {
    graphPanning = false;
    graphPanStart = null;
  });
  [els.graphTree, els.graphClusters].forEach(function (container) {
    container.addEventListener('click', function (event) {
      var word = event.target.closest('[data-graph-word]');
      if (word) showNodeInNetwork(word.getAttribute('data-graph-word'));
    });
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    applyGraphSettings();
    if (state.tab === 'graph') loadGraph();
  });
  els.graphDetail.addEventListener('click', function (event) {
    var close = event.target.closest('[data-graph-close]');
    if (close) {
      state.graphSelected = null;
      state.graphPathStart = null;
      state.graphPath = [];
      els.graphDetail.hidden = true;
      document.querySelectorAll('#word-graph .gnode').forEach(function (group) {
        group.classList.remove('selected', 'dim', 'neighbor');
      });
      document.querySelectorAll('#word-graph .gedge').forEach(function (line) {
        line.classList.remove('active', 'dim');
      });
      return;
    }
    var hop = event.target.closest('[data-graph-hop]');
    if (hop) {
      state.graphHop = Number(hop.getAttribute('data-graph-hop'));
      selectGraphNode(state.graphSelected);
      return;
    }
    var pathAction = event.target.closest('[data-graph-path]');
    if (pathAction) {
      var action = pathAction.getAttribute('data-graph-path');
      if (action === 'start') {
        state.graphPathStart = state.graphSelected;
        state.graphPath = [];
        toast('已设为路径起点，点击另一个词查看关系路径');
        selectGraphNode(state.graphSelected);
      } else {
        state.graphPathStart = null;
        state.graphPath = [];
        selectGraphNode(state.graphSelected);
      }
      return;
    }
    var adopt = event.target.closest('[data-adopt-ghost]');
    if (adopt) {
      adopt.disabled = true;
      api('/api/graph/adopt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lemma: adopt.getAttribute('data-adopt-ghost') })
      }).then(function (result) {
        toast('已加入学习包：' + result.item.lemma);
        loadGraph();
      }).catch(function (error) {
        adopt.disabled = false;
        toast('加入失败：' + error.message);
      });
      return;
    }
    var enrich = event.target.closest('[data-enrich-item]');
    if (enrich) {
      enrich.disabled = true;
      api('/api/items/' + encodeURIComponent(enrich.getAttribute('data-enrich-item')) + '/enrich', {
        method: 'POST'
      }).then(function () {
        toast('关系已补全，正在刷新词网');
        loadGraph();
      }).catch(function (error) {
        enrich.disabled = false;
        toast('补全失败：' + error.message);
      });
      return;
    }
    var word = event.target.closest('[data-graph-word]');
    if (word) {
      selectGraphNode(word.getAttribute('data-graph-word'));
      return;
    }
    var neighbor = event.target.closest('[data-graph-node]');
    if (neighbor) selectGraphNode(neighbor.getAttribute('data-graph-node'));
  });

  var vocabSearchTimer = null;
  if (els.search) {
    els.search.addEventListener('input', function () {
      clearTimeout(vocabSearchTimer);
      vocabSearchTimer = setTimeout(function () {
        state.vocabQuery = els.search.value.trim();
        loadLibrary();
      }, 180);
    });
  }
  document.querySelectorAll('[data-vocab-group]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.vocabGroup = button.getAttribute('data-vocab-group') || 'all';
      document.querySelectorAll('[data-vocab-group]').forEach(function (entry) {
        entry.classList.toggle('active', entry === button);
      });
      loadLibrary();
    });
  });
  ['vocab-source', 'vocab-cefr', 'vocab-book', 'vocab-type', 'vocab-sort'].forEach(function (id) {
    var element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('change', function () {
      if (id === 'vocab-source') state.vocabSource = element.value;
      if (id === 'vocab-cefr') state.vocabCefr = element.value;
      if (id === 'vocab-book') state.vocabBook = element.value;
      if (id === 'vocab-sort') state.vocabSort = element.value;
      if (id === 'vocab-type') {
        state.vocabType = element.value;
        if (state.vocabType === 'sentence') {
          state.vocabGroup = 'all';
          document.querySelectorAll('[data-vocab-group]').forEach(function (entry) {
            entry.classList.toggle('active', entry.getAttribute('data-vocab-group') === 'all');
          });
        }
      }
      loadLibrary();
    });
  });
  var vocabStudyButton = document.getElementById('vocab-study');
  if (vocabStudyButton) vocabStudyButton.addEventListener('click', startStudy);
  var vocabBooksOpen = document.getElementById('vocab-books-open');
  if (vocabBooksOpen) vocabBooksOpen.addEventListener('click', openWordbooks);
  var vocabGraph = document.getElementById('vocab-graph');
  if (vocabGraph) vocabGraph.addEventListener('click', function () { location.href = '/?tab=graph'; });
  var vocabSelectToggle = document.getElementById('vocab-select-toggle');
  if (vocabSelectToggle) vocabSelectToggle.addEventListener('click', function () {
    state.vocabSelecting = !state.vocabSelecting;
    state.vocabSelected = {};
    renderVocabList(state.vocabItems);
    updateVocabSelectBar();
  });
  var vocabSelectClear = document.getElementById('vocab-select-clear');
  if (vocabSelectClear) vocabSelectClear.addEventListener('click', function () {
    state.vocabSelected = {};
    renderVocabList(state.vocabItems);
    updateVocabSelectBar();
  });
  var vocabSelectReview = document.getElementById('vocab-select-review');
  if (vocabSelectReview) vocabSelectReview.addEventListener('click', function () {
    var ids = selectedVocabIds();
    if (!ids.length) { toast('先选几个词'); return; }
    location.href = '/?tab=review&words=' + ids.map(encodeURIComponent).join(',') + '&label=' +
      encodeURIComponent('复习选中');
  });
  var bulkSuspend = document.getElementById('vocab-bulk-suspend');
  if (bulkSuspend) bulkSuspend.addEventListener('click', function () {
    runBulkAction('suspended', '已暂停', bulkSuspend);
  });
  var bulkKnown = document.getElementById('vocab-bulk-known');
  if (bulkKnown) bulkKnown.addEventListener('click', function () {
    runBulkAction('known', '已标记掌握', bulkKnown);
  });
  var bulkActive = document.getElementById('vocab-bulk-active');
  if (bulkActive) bulkActive.addEventListener('click', function () {
    runBulkAction('active', '已恢复', bulkActive);
  });
  var bulkFavorite = document.getElementById('vocab-bulk-favorite');
  if (bulkFavorite) bulkFavorite.addEventListener('click', function () {
    runBulkAction('favorite', '已收藏', bulkFavorite);
  });
  var backupDownload = document.getElementById('backup-download');
  if (backupDownload) backupDownload.addEventListener('click', function () { downloadBackup(backupDownload); });
  var wordbooksClose = document.getElementById('wordbooks-close');
  if (wordbooksClose) wordbooksClose.addEventListener('click', closeWordbooks);
  var wordbooksModal = document.getElementById('wordbooks-modal');
  if (wordbooksModal) wordbooksModal.addEventListener('click', function (event) { if (event.target === wordbooksModal) closeWordbooks(); });
  var knownOpen = document.getElementById('vocab-known-open');
  if (knownOpen) knownOpen.addEventListener('click', openKnown);
  var knownClose = document.getElementById('known-close');
  if (knownClose) knownClose.addEventListener('click', closeKnown);
  var knownModal = document.getElementById('known-modal');
  if (knownModal) knownModal.addEventListener('click', function (event) { if (event.target === knownModal) closeKnown(); });
  var knownRun = document.getElementById('known-run');
  if (knownRun) knownRun.addEventListener('click', function () { runKnown(knownRun); });
  var knownFile = document.getElementById('known-file');
  if (knownFile) knownFile.addEventListener('change', function () {
    var file = knownFile.files && knownFile.files[0];
    if (!file) return;
    file.text().then(function (text) {
      var input = document.getElementById('known-text');
      if (input) input.value = text;
    }).catch(function (error) { toast('读取文件失败：' + error.message); });
  });
  var qualityOpen = document.getElementById('vocab-quality-open');
  if (qualityOpen) qualityOpen.addEventListener('click', openQuality);
  var qualityClose = document.getElementById('quality-close');
  if (qualityClose) qualityClose.addEventListener('click', closeQuality);
  var qualityModal = document.getElementById('quality-modal');
  if (qualityModal) qualityModal.addEventListener('click', function (event) { if (event.target === qualityModal) closeQuality(); });
  var qualityRun = document.getElementById('quality-run');
  if (qualityRun) qualityRun.addEventListener('click', function () { runQuality(5, qualityRun); });
  var qualityRunTen = document.getElementById('quality-run-ten');
  if (qualityRunTen) qualityRunTen.addEventListener('click', function () { runQuality(10, qualityRunTen); });
  var vocabNewLimit = document.getElementById('vocab-new-limit');
  if (vocabNewLimit) {
    try {
      var savedNewLimit = localStorage.getItem('learn-vocab-new-limit');
      if (savedNewLimit) vocabNewLimit.value = savedNewLimit;
    } catch (error) {}
    vocabNewLimit.addEventListener('change', function () {
      try { localStorage.setItem('learn-vocab-new-limit', vocabNewLimit.value); } catch (error) {}
    });
  }
  if (els.libraryList) {
    els.libraryList.addEventListener('click', function (event) {
      var select = event.target.closest('[data-vocab-select]');
      if (select) {
        toggleVocabSelection(select.getAttribute('data-vocab-select'));
        return;
      }
      var star = event.target.closest('[data-vocab-star]');
      if (star) {
        event.stopPropagation();
        var starId = star.getAttribute('data-vocab-star');
        var next = !star.classList.contains('active');
        api('/api/favorite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId: starId, favorite: next })
        }).then(function (result) {
          star.classList.toggle('active', next);
          state.stats = result.summary;
          renderStats();
        }).catch(function (error) { toast(error.message); });
        return;
      }
      var row = event.target.closest('[data-vocab-id]');
      if (row) {
        if (state.vocabSelecting) toggleVocabSelection(row.getAttribute('data-vocab-id'));
        else openVocabDetail(row.getAttribute('data-vocab-id'));
      }
    });
    els.libraryList.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var row = event.target.closest('[data-vocab-id]');
      if (!row) return;
      event.preventDefault();
      if (state.vocabSelecting) toggleVocabSelection(row.getAttribute('data-vocab-id'));
      else openVocabDetail(row.getAttribute('data-vocab-id'));
    });
  }
  var vocabDetailClose = document.getElementById('vocab-detail-close');
  if (vocabDetailClose) vocabDetailClose.addEventListener('click', closeVocabDetail);
  var vocabDetail = document.getElementById('vocab-detail');
  if (vocabDetail) vocabDetail.addEventListener('click', function (event) { if (event.target === vocabDetail) closeVocabDetail(); });
  var studyClose = document.getElementById('study-close');
  if (studyClose) studyClose.addEventListener('click', closeStudy);
  var studyOverlay = document.getElementById('study-session');
  if (studyOverlay) studyOverlay.addEventListener('click', function (event) { if (event.target === studyOverlay) closeStudy(); });
  document.addEventListener('keydown', function (event) {
    if (document.getElementById('study-session') && !document.getElementById('study-session').hidden) {
      if (event.key === 'Escape') { closeStudy(); return; }
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === ' ' && state.study && !state.study.revealed && state.study.mode === 'recognize') {
        event.preventDefault();
        state.study.revealed = true;
        renderStudy();
        return;
      }
      if (state.study && state.study.revealed && ['1', '2', '3', '4'].indexOf(event.key) !== -1) {
        event.preventDefault();
        rateStudy(Number(event.key));
      }
    }
  });

  document.addEventListener('keydown', function (event) {
    if (state.tab !== 'review') return;
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (
      state.canUndo &&
      (event.key === 'u' || event.key === 'U' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z'))
    ) {
      event.preventDefault();
      undoReview();
      return;
    }
    if (event.code === 'Space') { event.preventDefault(); reveal(); return; }
    if (event.key === 's' || event.key === 'S') { event.preventDefault(); toggleFavorite(); return; }
    if (event.key === 'k' || event.key === 'K') { event.preventDefault(); setStatus('known'); return; }
    if (state.revealed && ['1', '2', '3', '4'].indexOf(event.key) !== -1) {
      event.preventDefault();
      rate(Number(event.key));
    }
  });

  var initialParams = new URLSearchParams(location.search);
  var initialTab = normalizeTab(initialParams.get('tab') || 'read');
  var initialShare = initialParams.get('share');
  var initialImport = initialParams.get('import');
  applyGraphSettings();
  state.packFilter = initialParams.get('pack');
  state.wordFilter = initialParams.get('words');
  state.wordFilterLabel = initialParams.get('label') || '自定义词组';
  state.graphFocus = initialParams.get('word');
  state.reviewScope = initialParams.get('scope') || 'all';
  state.reviewBook = initialParams.get('book') || '';
  var requestedNewLimit = Number(initialParams.get('newLimit'));
  if (Number.isFinite(requestedNewLimit) && requestedNewLimit > 0) state.reviewNewLimit = Math.min(30, Math.floor(requestedNewLimit));
  state.importResource = initialParams.get('resource');
  state.importArticlesView = initialParams.get('articles') === '1';
  var articleParam = initialParams.get('article');
  var initialArticle = articleParam === null ? NaN : Number(articleParam);
  state.importArticle = Number.isFinite(initialArticle) ? initialArticle : null;
  if (initialImport) {
    state.tab = 'import';
  }
  if (TAB_VIEW[initialTab]) {
    state.tab = initialTab;
  }
  if (state.tab === 'read') {
    loadPlan();
  } else if (state.tab === 'review') {
    loadPlan().then(function () { switchTab('review'); });
  } else {
    switchTab(state.tab);
    if (state.tab === 'read') loadPlan();
    if (state.tab === 'passport' && initialShare) {
      loadPassport().then(function () { openPassportCard(initialShare); });
    }
    if (state.tab === 'import' && state.importArticlesView && state.importResource) {
      openArticleList(state.importResource, state.importArticle);
    }
  }
  if (initialImport && els.urlInput) {
    setImportSource('url', false)
    els.urlInput.value = initialImport;
    els.urlInput.focus();
  }
  initCustomSelects();
  if (els.llmProvider) {
    els.llmProvider.addEventListener('change', function () {
      var preset = llmPreset(els.llmProvider.value);
      if (preset) {
        if (els.llmModel) els.llmModel.value = preset.model;
        if (els.llmBaseUrl) els.llmBaseUrl.value = preset.baseUrl;
        if (els.llmApiKey) els.llmApiKey.placeholder = '填写 ' + preset.label + ' 的 API Key';
        renderModelOptions(preset.id, preset.model);
      }
    });
  }
  if (els.llmModel) {
    els.llmModel.addEventListener('input', function () {
      renderModelOptions(els.llmProvider ? els.llmProvider.value : 'openai', els.llmModel.value.trim());
    });
  }
  if (els.llmSave) els.llmSave.addEventListener('click', saveLlmSettings);
  var nuanceModal = document.getElementById('nuance-modal');
  var nuanceClose = document.getElementById('nuance-close');
  if (nuanceClose) nuanceClose.addEventListener('click', closeNuance);
  if (nuanceModal) {
    nuanceModal.addEventListener('click', function (event) {
      if (event.target === nuanceModal) closeNuance();
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && nuanceModal && !nuanceModal.hidden) closeNuance();
  });
  if (els.llmRefresh) els.llmRefresh.addEventListener('click', refreshModels);
  loadLlmSettings();
  var themeButton = document.getElementById('theme-toggle');
  if (themeButton) themeButton.addEventListener('click', cycleReviewTheme);
  var settingsOpen = document.getElementById('settings-open');
  if (settingsOpen) settingsOpen.addEventListener('click', function () { switchTab('settings'); });
  applyReviewTheme(themeChoice());
  if (window.matchMedia) {
    var reviewThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    var onReviewThemeChange = function () {
      if (themeChoice() === 'auto') applyReviewTheme('auto');
    };
    if (reviewThemeMedia.addEventListener) reviewThemeMedia.addEventListener('change', onReviewThemeChange);
    else if (reviewThemeMedia.addListener) reviewThemeMedia.addListener(onReviewThemeChange);
  }
  loadLanStatus();
  if (els.selectionSize) {
    try {
      var savedSize = localStorage.getItem('learn-selection-size');
      if (savedSize && customSelectHasValue(els.selectionSize, savedSize)) {
        els.selectionSize.value = savedSize;
        syncCustomSelect(els.selectionSize);
      }
    } catch (error) {}
    els.selectionSize.addEventListener('change', function () {
      try {
        localStorage.setItem('learn-selection-size', els.selectionSize.value);
      } catch (error) {}
    });
  }
  if (els.buildStyle) {
    els.buildStyle.addEventListener('change', function () {
      try {
        localStorage.setItem('learn-build-style', els.buildStyle.value);
      } catch (error) {}
    });
  }
  loadQueueBanner();
})();
</script>
${i18nScript('review')}
</body>
</html>`
}
