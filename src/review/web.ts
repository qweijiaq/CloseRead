import { TTS_PROVIDERS } from '../audio/providers.js'
import { i18nScript } from '../i18n.js'
import { LLM_PROVIDERS } from '../llm/providers.js'
import { themeBootScript } from '../theme.js'
import { pwaHead } from './pwa.js'

const GITHUB_REPO = 'https://github.com/qweijiaq/CloseRead'
const GITHUB_ISSUES = `${GITHUB_REPO}/issues/new`
const GITHUB_FORK = `${GITHUB_REPO}/fork`

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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>精读 · CloseRead</title>
${themeBootScript()}
${pwaHead()}
<style>
  :root {
    --paper: #f7f6f3;
    --paper-2: #efece6;
    --bg: var(--paper);
    --bg-2: var(--paper-2);
    --ink-70: #3b3d40;
    --ochre: #8a6a2f;
    --sans: var(--ui);
    --card: #ffffff;
    --surface: var(--card);
    --surface-2: #f5f4f0;
    --ink: #17181a;
    --muted: #6e6b66;
    --line: #e4e1da;
    --line-strong: #cfcbc2;
    --accent: #243b53;
    --accent-strong: #16283a;
    --accent-soft: #e9eef3;
    --lime: #c8b27c;
    --rust: #a6453a;
    --rust-soft: #f6e9e6;
    --danger: var(--rust);
    --warn: #8a6420;
    --shadow: 0 1px 2px rgba(23, 24, 26, .04), 0 12px 30px rgba(23, 24, 26, .05);
    --ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --display: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
    --read: 'Iowan Old Style', Charter, 'Songti SC', 'Noto Serif SC', serif;
    --mono: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --paper: #0e0f11;
    --paper-2: #15171a;
    --ink-70: #c6c4be;
    --ochre: #d3b274;
    --card: #1a1c20;
    --surface-2: #202328;
    --ink: #eceae4;
    --muted: #9a978f;
    --line: #2a2d32;
    --line-strong: #3d4148;
    --accent: #9db6c9;
    --accent-strong: #c2d4e1;
    --accent-soft: #1b2833;
    --lime: #d9c79b;
    --rust: #e08b80;
    --rust-soft: #2d1f1d;
    --warn: #d3b274;
    --shadow: 0 1px 2px rgba(0, 0, 0, .25), 0 18px 40px rgba(0, 0, 0, .22);
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
  html[data-theme="dark"] .btn-primary { color: #101214; }
  html[data-theme="dark"] .btn-primary:hover { background: var(--accent-strong); color: #101214; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    margin: 0; background: var(--paper);
    color: var(--ink); font-family: var(--ui);
    line-height: 1.6;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 34px 20px 70px; }
  .store-warning { margin: 0 0 18px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--rust) 35%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--rust) 8%, transparent); color: var(--ink); font-size: 12.5px; line-height: 1.65; }
  .store-warning strong { display: block; margin-bottom: 4px; color: var(--rust); }
  .store-warning code { display: block; margin-top: 6px; font-family: var(--mono); font-size: 11px; word-break: break-all; color: var(--muted); }
  .phone-mode-banner { margin: 0 0 18px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; line-height: 1.6; }
  body.phone-mode .side-import,
  body.phone-mode .header-import,
  body.phone-mode [data-go-tab="import"],
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
  .brand { font-family: var(--read); font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
  .brand span { color: var(--accent); }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stat { border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 88%, transparent); border-radius: 999px; padding: 5px 10px; font-size: 12px; color: var(--muted); }
  .stat strong { color: var(--ink); }
  nav { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 24px; overflow-x: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar { display: none; }
  nav button { flex: 0 0 auto; white-space: nowrap; border: 0; background: transparent; padding: 10px 14px; font-size: 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
  nav button.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .view { display: none; }
  .view.active { display: block; }
  .first-accuracy { margin-left: auto; color: var(--accent); }
  .progress { display: flex; justify-content: space-between; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
  .progress .link-button { margin-left: auto; }
  .forecast { display: flex; align-items: flex-end; gap: 10px; margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: color-mix(in srgb, var(--surface) 86%, transparent); }
  .forecast[hidden] { display: none; }
  .forecast-title { flex: 0 0 auto; color: var(--muted); font-size: 10.5px; line-height: 1.4; }
  .forecast-days { display: flex; flex: 1; align-items: flex-end; gap: 6px; min-width: 0; }
  .forecast-day { display: flex; flex: 1; min-width: 0; flex-direction: column; align-items: center; gap: 3px; }
  .forecast-bar { width: 100%; max-width: 28px; min-height: 3px; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--accent) 28%, transparent); }
  .forecast-day.is-today .forecast-bar { background: var(--rust); }
  .forecast-day b { color: var(--muted); font-size: 9px; font-weight: 400; white-space: nowrap; }
  .forecast-day small { color: var(--muted); font-size: 9px; }
  .forecast-overdue { flex: 0 0 auto; color: var(--muted); font-size: 10px; }
  .badge.leech { color: var(--rust); border-color: color-mix(in srgb, var(--rust) 35%, transparent); background: color-mix(in srgb, var(--rust) 9%, transparent); }
  .leech-hint { margin: 10px 0 0; padding: 9px 11px; border-left: 2px solid var(--rust); background: color-mix(in srgb, var(--rust) 7%, transparent); color: var(--muted); font-size: 12px; line-height: 1.65; }
  .today-plan { margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--muted); font-size: 12.5px; }
  .today-plan strong { color: var(--ink); margin-right: 6px; }
  .today-plan a { color: var(--accent); text-decoration: none; font-weight: 600; }
  .today-plan a:hover { text-decoration: underline; }
  .home-hero {
    margin-bottom: 14px; padding: 26px 28px; border: 1px solid var(--line); border-radius: 20px;
    background: linear-gradient(135deg, var(--surface), var(--paper-2)); box-shadow: var(--shadow);
  }
  .home-eyebrow { color: var(--rust); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
  .home-title { margin: 0; font-family: var(--read); font-size: clamp(26px, 4vw, 38px); line-height: 1.2; letter-spacing: -.02em; }
  .home-meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
  .home-progress { display: flex; align-items: center; gap: 10px; margin-top: 18px; color: var(--muted); font-size: 12px; }
  .home-track { flex: 1; max-width: 320px; height: 7px; border-radius: 999px; background: rgba(28,26,22,.1); overflow: hidden; }
  .home-fill { height: 100%; width: 0; background: var(--rust); border-radius: 999px; }
  .home-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .read-home-links { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; }
  .home-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; }
  .home-card { border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--surface) 88%, transparent); padding: 16px 18px; }
  .home-card h2 { margin: 0 0 10px; font-family: var(--read); font-size: 16px; }
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
  .tts-details { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
  .tts-details summary { cursor: pointer; font-size: 12px; color: var(--ink); }
  .tts-form { display: grid; gap: 8px; margin-top: 10px; }
  .tts-providers, .tts-voice-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .tts-provider, .tts-voice { border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--muted); padding: 4px 10px; font: inherit; font-size: 11px; cursor: pointer; }
  .tts-provider:hover, .tts-provider.active, .tts-voice:hover, .tts-voice.active { border-color: var(--accent-strong); color: var(--ink); }
  .tts-form label { display: grid; gap: 4px; color: var(--muted); font-size: 11px; }
  .tts-form input { width: 100%; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); padding: 7px 9px; font: inherit; font-size: 12px; }
  .tts-form input:focus { outline: none; border-color: var(--accent-strong); }
  .trash-entry { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 12px; }
  .trash-entry:first-of-type { border-top: 0; }
  .trash-entry small { display: block; color: var(--muted); font-size: 10px; }
  .trash-entry .row-actions { display: flex; gap: 5px; flex: 0 0 auto; }
  @media (max-width: 760px) { .settings-grid { grid-template-columns: 1fr; } }
  .home-recent-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 -8px; padding: 10px 8px; border-top: 1px solid var(--line); border-radius: 9px; font-size: 13px; transition: background .15s ease; }
  .home-recent-row:first-of-type { border-top: 0; }
  .home-recent-row:hover { background: var(--surface-2); }
  .home-recent-row a { color: var(--ink); text-decoration: none; font-weight: 600; }
  .home-recent-row a::after { content: ' ↗'; color: var(--muted); font-weight: 400; opacity: 0; transition: opacity .15s ease; }
  .home-recent-row:hover a::after { opacity: 1; }
  .home-recent-row a:hover { color: var(--accent); }
  .home-recent-row .mini-progress { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .reading-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0 0 18px; }
  .reading-stat { padding: 14px 16px; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); box-shadow: var(--shadow); transition: transform .16s ease, border-color .16s ease; }
  .reading-stat:hover { transform: translateY(-2px); border-color: var(--line-strong); }
  .reading-stat:first-child { border-color: color-mix(in srgb, var(--accent) 22%, var(--line)); background: var(--accent-soft); }
  .reading-stat b { display: block; font-family: var(--display); font-size: 26px; font-weight: 720; line-height: 1.1; letter-spacing: -.03em; }
  .reading-stat span { display: block; margin-top: 4px; color: var(--muted); font-size: 10.5px; letter-spacing: .01em; }
  @media (max-width: 760px) { .reading-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .home-review-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .home-review-line strong { font-family: var(--read); font-size: 28px; }
  .home-review-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .home-outputs { margin-top: 14px; }
  .insights-card { margin-bottom: 16px; }
  .home-diagnosis { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 0 0 14px; padding: 12px 16px; border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); border-radius: 14px; background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .home-diagnosis strong { display: block; font-size: 13px; }
  .home-diagnosis span { display: block; margin-top: 2px; color: var(--muted); font-size: 11.5px; }
  .insight-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .insight-head h2 { margin: 0; font-family: var(--read); font-size: 19px; }
  .insight-head span { color: var(--muted); font-size: 11.5px; }
  .insight-copy { margin: 0 0 12px; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .insight-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 14px 0 4px; }
  .insight-stat { padding: 11px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper-2); }
  .insight-stat strong { display: block; font-family: var(--read); font-size: 22px; line-height: 1.2; }
  .insight-stat span { display: block; margin-top: 3px; color: var(--muted); font-size: 10.5px; }
  .insight-block { margin-top: 16px; }
  .insight-block h3 { margin: 0 0 7px; font-size: 12.5px; color: var(--ink); }
  .insight-block p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .insight-actions { display: flex; justify-content: flex-end; margin-top: 14px; }
  .insight-list { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12.5px; line-height: 1.8; }
  .insight-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .insight-chip { padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); font-size: 12px; }
  .insight-chip em { margin-left: 5px; color: var(--rust); font-style: normal; font-size: 11px; }
  .diagnosis-words { display: grid; grid-template-columns: repeat(auto-fit, minmax(142px, 1fr)); gap: 7px; margin-top: 12px; }
  .diagnosis-word { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .diagnosis-word b { font-family: var(--read); font-size: 14px; }
  .diagnosis-word span { color: var(--muted); font-size: 10.5px; }
  .diagnosis-words:not(.is-revealed) .diagnosis-gloss { display: none; }
  .diagnosis-words.is-revealed .diagnosis-word { min-height: 54px; }
  .diagnosis-word.is-known { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); }
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
  .passport-block h2 { margin: 0; font-family: var(--read); font-size: 18px; }
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
  html[data-theme="dark"] .btn.primary { color: var(--bg) !important; }
  html[data-theme="dark"] .brand-mark { background: var(--accent); color: var(--bg); }

  .passport-eyebrow { color: var(--rust); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; }
  .passport-head h1 { margin: 6px 0 4px; font-family: var(--read); font-size: clamp(26px, 4vw, 36px); line-height: 1.2; letter-spacing: -.02em; }
  .passport-intro { margin: 0; color: var(--muted); font-size: 12.5px; max-width: 420px; }
  .passport-stats { display: grid; grid-template-columns: repeat(3, minmax(82px, 1fr)); gap: 12px 24px; align-content: center; flex: 1 1 260px; }
  .passport-stat { min-width: 0; }
  .passport-stat strong { display: block; font-family: var(--read); font-size: 24px; line-height: 1.2; color: var(--ink); }
  .passport-stat span { color: var(--muted); font-size: 11.5px; }
  .passport-links { display: flex; justify-content: flex-end; margin: 0 0 10px; }
  .passport-weekly-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .passport-stamps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
  .passport-stamp { display: flex; flex-direction: column; gap: 7px; min-height: 178px; padding: 16px 17px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--shadow); transition: border-color .15s ease, transform .15s ease; }
  .passport-stamp:hover { border-color: var(--accent); transform: translateY(-1px); }
  .passport-stamp .stamp-date { color: var(--rust); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .passport-stamp .stamp-date.reading { color: var(--accent); }
  .passport-stamp .stamp-title { display: block; font-family: var(--read); font-size: 16px; line-height: 1.35; }
  .passport-stamp .stamp-zh { color: var(--muted); font-size: 11.5px; }
  .passport-stamp .stamp-quote { flex: 1; margin: 2px 0 0; color: var(--muted); font-family: var(--read); font-size: 12px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .passport-stamp .stamp-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10.5px; }
  .passport-stamp .stamp-share { color: var(--accent); }
  .passport-empty { grid-column: 1 / -1; padding: 34px 24px; border: 1px dashed var(--line); border-radius: 14px; color: var(--muted); font-size: 13px; text-align: center; }
  .lan-panel { position: fixed; top: 64px; right: 24px; z-index: 95; width: min(440px, calc(100vw - 32px)); padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); box-shadow: 0 18px 50px rgba(28,26,22,.18); }
  .lan-panel[hidden] { display: none; }
  .lan-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
  .lan-panel-head strong { font-family: var(--read); font-size: 16px; }
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
  .nuance-option.correct { border-color: var(--accent); background: var(--accent-soft); }
  .nuance-option.wrong { border-color: var(--rust); background: var(--rust-soft); }
  .nuance-option:disabled { cursor: default; opacity: .9; }
  .nuance-feedback { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper-2); font-size: 12.5px; line-height: 1.75; }
  .nuance-feedback strong { color: var(--accent); }
  .nuance-feedback.bad strong { color: var(--rust); }
  .nuance-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
  .nuance-combo { color: var(--muted); font-size: 11.5px; }
  .nuance-loading { padding: 18px 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
  html[data-theme="dark"] .nuance-option.correct { border-color: var(--accent); background: var(--accent-soft); }
  html[data-theme="dark"] .nuance-feedback strong { color: var(--accent); }
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
    .passport-sheet { width: 100%; max-height: 100dvh; border: 0; border-radius: 0; }
  }
  .output-entry { padding: 9px 0; border-top: 1px solid var(--line); }
  .output-entry:first-of-type { border-top: 0; }
  .output-meta { color: var(--muted); font-size: 11.5px; }
  .output-entry summary { cursor: pointer; color: var(--ink); font-size: 13px; margin-top: 3px; }
  .output-text { margin-top: 7px; padding: 10px 12px; border-radius: 9px; background: var(--accent-soft); color: var(--ink); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
  .output-feedback { margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .output-feedback p { margin: 5px 0; }
  .output-feedback p b { color: var(--ink); font-weight: 600; }
  .output-feedback blockquote { margin: 7px 0; padding-left: 10px; border-left: 1px solid var(--line-strong); color: var(--ink); font-family: var(--read); }
  .output-feedback .link-button { margin-top: 2px; }
  .output-revision { margin-top: 10px; padding: 10px 0 0 12px; border-top: 1px dashed var(--line); border-left: 2px solid var(--line); }
  .output-revise { margin-top: 10px; }
  .output-revise summary { color: var(--muted); font-size: 11.5px; cursor: pointer; }
  .output-revise textarea { width: 100%; min-height: 92px; margin-top: 7px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); color: var(--ink); padding: 9px 11px; font: inherit; font-size: 13px; line-height: 1.65; resize: vertical; }
  .output-revise .btn { margin-top: 7px; }
  .today-output-input { width: 100%; min-height: 92px; margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); padding: 10px 12px; font: inherit; font-size: 13.5px; line-height: 1.65; resize: vertical; outline: none; }
  .today-output-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
  .today-output-text { margin-top: 8px; padding: 9px 11px; border-radius: 9px; background: var(--accent-soft); color: var(--ink); font-size: 12.5px; line-height: 1.65; white-space: pre-wrap; }
  @media (max-width: 700px) {
    .home-grid { grid-template-columns: 1fr; }
    .home-hero { padding: 20px 18px; }
  }
  .today-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .today-head strong { font-family: var(--read); font-size: 15px; }
  .today-streak { color: var(--rust); font-size: 11.5px; }
  .today-steps { display: flex; flex-direction: column; gap: 7px; }
  .today-step { display: flex; align-items: flex-start; gap: 8px; }
  .today-step .tick { width: 18px; height: 18px; border: 1px solid var(--line); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: var(--muted); flex: none; margin-top: 1px; }
  .today-step.done .tick { background: var(--accent); border-color: var(--accent); color: #fff; }
  .today-step-body { flex: 1; min-width: 0; }
  .today-step-body b { color: var(--ink); }
  .today-step .btn { padding: 3px 9px; font-size: 11.5px; flex: none; }
  .today-output-prompt { margin-top: 4px; padding: 8px 10px; border-left: 2px solid var(--rust); background: color-mix(in srgb, var(--paper-2) 55%, transparent); border-radius: 0 8px 8px 0; color: var(--ink); font-size: 12.5px; }
  .today-output-prompt details { margin-top: 5px; color: var(--muted); }
  .today-complete { margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--line); color: var(--accent); font-weight: 600; }
  .speak-btn { padding: 6px 11px; font-size: 12px; margin-left: 8px; vertical-align: middle; }
  .practice { margin-top: 12px; padding: 12px 14px; border: 1px dashed var(--line); border-radius: 12px; background: color-mix(in srgb, var(--surface) 86%, transparent); }
  .practice-label { font-size: 11.5px; color: var(--muted); margin-bottom: 7px; }
  .practice-row { display: flex; gap: 7px; flex-wrap: wrap; }
  .practice-row input { flex: 1 1 200px; border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 9px 11px; font: inherit; font-size: 14px; outline: none; }
  .practice-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
  .practice-row .btn { padding: 8px 12px; font-size: 12.5px; }
  .practice-feedback { margin-top: 7px; font-size: 12px; min-height: 17px; }
  .practice-feedback.ok { color: var(--accent); }
  .practice-feedback.bad { color: var(--rust); }
  .practice-cloze { margin-top: 7px; color: var(--muted); font-size: 12.5px; font-family: var(--read); }
  .card.revealed .practice { display: none; }
  .relations { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; font-size: 12.5px; color: var(--muted); }
  .relations b { color: var(--ink); font-weight: 600; margin-right: 4px; }
  .memory-hook { margin: 12px 0 0; padding: 9px 12px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); font-size: 13px; }
  .formation { margin-top: 10px; color: var(--muted); font-size: 12.5px; }
  .formation b { color: var(--ink); }
  .sentence-eyebrow { color: var(--rust); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
  .sentence-title { font-family: var(--read); font-size: clamp(26px, 5vw, 38px); line-height: 1.2; }
  .sentence-prompt { font-size: 18px; }
  .sentence-answer-original { margin: 0 0 12px; padding: 12px 16px; border-left: 3px solid var(--accent); background: var(--accent-soft); font-family: var(--read); font-size: 18px; line-height: 1.65; border-radius: 0 10px 10px 0; }
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
  .practice textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
  .pack-filter { display: flex; align-items: center; gap: 10px; margin: -2px 0 12px; color: var(--muted); font-size: 12.5px; }
  .link-button { border: 0; background: transparent; color: var(--accent); font: inherit; font-size: 12.5px; padding: 0; cursor: pointer; text-decoration: underline; }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 30px 30px 24px;
    box-shadow: var(--shadow); min-height: 360px; display: flex; flex-direction: column;
  }
  .card-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .word { font-family: var(--read); font-size: clamp(38px, 7vw, 62px); line-height: 1.05; letter-spacing: -.025em; }
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
  .context { margin: 26px 0 18px; padding: 16px 18px; border-left: 3px solid var(--rust); background: color-mix(in srgb, var(--paper-2) 55%, transparent); border-radius: 0 12px 12px 0; font-family: var(--read); font-size: 19px; line-height: 1.6; }
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
  .btn-primary:hover { background: var(--accent-strong); color: #fff; }
  .rating { border: 1px solid var(--line); background: var(--card); border-radius: 11px; padding: 12px 8px; cursor: pointer; text-align: center; font-size: 13px; }
  .rating small { display: block; color: var(--muted); font-size: 10.5px; margin-top: 2px; }
  .rating[data-r="1"]:hover { border-color: #c0392b; color: #c0392b; }
  .rating[data-r="2"]:hover { border-color: var(--rust); color: var(--rust); }
  .rating[data-r="3"]:hover { border-color: var(--accent); color: var(--accent); }
  .rating[data-r="4"]:hover { border-color: #2d6cdf; color: #2d6cdf; }
  .hint { text-align: center; color: var(--muted); font-size: 12px; margin-top: 14px; }
  .empty { text-align: center; padding: 70px 20px; color: var(--muted); }
  .empty strong { display: block; font-family: var(--read); font-size: 26px; color: var(--ink); margin-bottom: 8px; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
  .badge.stale { background: var(--rust-soft); color: var(--rust); }
  .toolbar input { flex: 1; border: 1px solid var(--line); background: var(--card); border-radius: 11px; padding: 11px 14px; font-size: 14px; outline: none; }
  .toolbar input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(31,111,92,.12); }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; }
  .row .lemma { font-family: var(--read); font-size: 18px; font-weight: 600; min-width: 130px; }
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
  .sentence-original { font-family: var(--read); font-size: 16px; line-height: 1.7; color: var(--ink); }
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
  .pack-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 15px; padding: 16px 18px; box-shadow: var(--shadow); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
  .pack-row:hover { transform: translateY(-2px); border-color: var(--line-strong); box-shadow: 0 10px 26px rgba(20, 24, 21, .08); }
  .pack-row > div:first-child { min-width: 0; }
  .pack-row a { color: var(--ink); font-weight: 650; text-decoration: none; }
  .pack-row a:hover { color: var(--accent); }
  .pack-row .due { margin-top: 4px; }
  .pack-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .pack-group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 4px 2px; }
  .pack-group-head { padding: 6px 2px 2px; }
  .pack-group-head strong { font-family: var(--display); font-size: 15px; font-weight: 700; letter-spacing: -.02em; }
  .pack-group-head span { border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; color: var(--muted); font-family: var(--mono); font-size: 9.5px; }
  .pack-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: none; }
  .pack-actions .btn { white-space: nowrap; }
  .pack-shared-tag { padding: 4px 9px; border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line)); border-radius: 999px; color: var(--accent); font-family: var(--mono); font-size: 9.5px; letter-spacing: .06em; }
  @media (max-width: 760px) {
    .pack-row { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px 15px; }
    .pack-actions { width: 100%; }
    .pack-actions .btn { flex: 0 0 auto; }
  }
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
  .llm-field input { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 2px; padding: 7px 9px; font: inherit; font-size: 12.5px; outline: none; }
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
  .queue-banner .btn { padding: 6px 10px; font-size: 12px; }
  .import-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .import-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .import-card.wide { grid-column: 1 / -1; }
  .import-card h2, .recent h2 { margin: 0; font-family: var(--read); font-size: 19px; }
  .import-card p { margin: 0; color: var(--muted); font-size: 12.5px; }
  .import-card input[type="text"], .import-card input[type="url"], .import-card textarea {
    width: 100%; border: 1px solid var(--line); background: var(--surface); border-radius: 10px;
    padding: 10px 12px; font: inherit; font-size: 14px; color: var(--ink);
  }
  .import-card textarea { min-height: 150px; resize: vertical; line-height: 1.65; }
  .import-card input:focus, .import-card textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
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
  .result-title { font-family: var(--read); font-size: 20px; font-weight: 600; }
  .result-meta { color: var(--muted); font-size: 12px; margin-top: 3px; }
  .result-insight { display: flex; flex-wrap: wrap; gap: 6px; }
  .result-insight span { padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-family: var(--mono); font-size: 10px; letter-spacing: .02em; }
  .result-insight span.good { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-strong); }
  .result-preview { margin: 0; color: var(--muted); font-size: 13.5px; }
  .result-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .article-panel { gap: 12px; }
  .article-search {
    width: 100%; border: 1px solid var(--line); background: var(--surface); border-radius: 10px;
    padding: 9px 12px; font: inherit; font-size: 13.5px; outline: none;
  }
  .article-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
  .article-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .article-tools .article-search { flex: 1 1 220px; width: auto; }
  .article-tools .cselect-trigger { padding: 8px 10px; font-size: 12.5px; }
  .article-tools .cselect-menu { min-width: 150px; }
  .article-toggle { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
  .article-section { margin-left: 7px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 1px 7px; }
  .article-row.hidden-article { opacity: .62; border-style: dashed; }
  .article-title .badge { margin-left: 6px; vertical-align: 1px; }
  .article-list { display: flex; flex-direction: column; gap: 6px; max-height: 460px; overflow: auto; padding-right: 4px; }
  .article-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); }
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
  .upload-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .upload-track { height: 4px; border-radius: 999px; background: var(--accent-soft); overflow: hidden; }
  .upload-track i { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--accent); transition: width .2s ease; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .recent { margin-top: 26px; }
  .recent h2 { margin-bottom: 10px; }
  .resource-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; }
  .resource-main { min-width: 0; cursor: pointer; }
  .resource-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resource-row .due { margin-top: 2px; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
  .graph-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
  .graph-controls input[type="search"] { flex: 1 1 180px; border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 8px 11px; font: inherit; font-size: 13px; outline: none; }
  .graph-controls input[type="search"]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
  .graph-controls select { border: 1px solid var(--line); background: var(--card); border-radius: 9px; padding: 7px 9px; font: inherit; font-size: 12.5px; }
  .graph-zoom { display: flex; gap: 4px; }
  .graph-zoom .btn { padding: 6px 9px; font-size: 12px; }
  .graph-slider { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
  .graph-slider input { width: 90px; accent-color: var(--accent); }
  .graph-meta { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
  .graph-wrap { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
  #word-graph { display: block; width: 100%; height: auto; min-height: 420px; background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 65%); }
  .gedge { stroke: rgba(63, 95, 127, .32); stroke-width: 1.2; }
  .gedge.negative { stroke: rgba(176, 58, 46, .42); stroke-dasharray: 4 4; }
  .gedge.root { stroke: rgba(168, 115, 47, .45); }
  .gedge.context { stroke: rgba(28, 26, 22, .18); stroke-dasharray: 2 4; }
  .gedge.active { stroke: var(--accent); stroke-width: 2.2; }
  .gedge.dim { opacity: .08; }
  .gnode { cursor: pointer; }
  .gnode circle { fill: var(--accent); stroke: var(--card); stroke-width: 2; }
  .gnode.known circle { fill: var(--accent-strong); }
  .gnode.suspended circle { fill: #b8b0a0; }
  .gnode.ghost circle { fill: color-mix(in srgb, var(--surface) 90%, transparent); stroke: var(--accent); stroke-width: 1.6; stroke-dasharray: 3 3; }
  .gnode.ghost text { fill: var(--muted); font-style: italic; }
  .gnode.due circle { stroke: var(--rust); stroke-width: 3; }
  .gnode.ghost.due circle { stroke: var(--accent); }
  .gnode text { fill: var(--ink); font-size: 10px; font-family: var(--sans); pointer-events: none; paint-order: stroke; stroke: var(--card); stroke-width: 3px; stroke-linejoin: round; opacity: 0; transition: opacity .15s ease; }
  .gnode.labeled text, .gnode:hover text, .gnode.selected text, .gnode.neighbor text, .gnode.hit text { opacity: 1; }
  .gnode.dim { opacity: .16; }
  .gnode.hit circle { stroke: var(--rust); stroke-width: 3; }
  .gnode.selected circle { stroke: var(--rust); stroke-width: 4; }
  .graph-detail { position: absolute; top: 12px; right: 12px; width: min(250px, 70%); max-height: calc(100% - 24px); overflow: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 6px 24px rgba(28,26,22,.12); font-size: 12.5px; }
  .graph-detail h3 { margin: 0 0 4px; font-family: var(--read); font-size: 18px; }
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
  .legend-dot.known { background: var(--accent-strong); }
  .legend-dot.learning { background: var(--accent); }
  .legend-dot.ghost { background: transparent; border: 1px dashed var(--accent); }
  .legend-line { width: 18px; height: 0; border-top: 2px solid color-mix(in srgb, var(--accent) 50%, transparent); display: inline-block; }
  .legend-line.negative { border-top-style: dashed; border-color: color-mix(in srgb, var(--rust) 60%, transparent); }
  .legend-line.root { border-top-color: rgba(168,115,47,.7); }
  .graph-tree, .graph-clusters { display: flex; flex-direction: column; gap: 10px; }
  .family-card, .cluster-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 15px; }
  .family-head, .cluster-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .family-hub { font-family: var(--mono); font-size: 14px; color: var(--ochre, #a8732f); }
  .family-hub strong { font-size: 16px; }
  .family-head span, .cluster-head span { color: var(--muted); font-size: 11.5px; font-weight: normal; margin-left: 6px; }
  .family-words, .cluster-words { display: flex; flex-wrap: wrap; gap: 5px; }
  .graph-word { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 3px 9px; font-size: 12px; cursor: pointer; color: var(--ink); }
  .graph-word.known { color: var(--accent-strong); border-color: color-mix(in srgb, var(--accent-strong) 35%, transparent); }
  .graph-word.ghost { border-style: dashed; color: var(--muted); }
  .graph-word.due { border-color: color-mix(in srgb, var(--rust) 35%, transparent); }
  .family-review, .cluster-review { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 3px 9px; font: inherit; font-size: 11.5px; color: var(--accent); cursor: pointer; }
  .cluster-card button.cluster-focus { border: 0; background: transparent; color: var(--accent); font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: underline; }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); display: flex; align-items: center; gap: 12px; max-width: min(440px, calc(100vw - 32px)); background: var(--ink); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 13px; opacity: 0; transition: all .2s ease; pointer-events: none; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast.with-action.show { pointer-events: auto; border-radius: 12px; padding: 10px 12px 10px 16px; }
  .toast button { flex: none; padding: 4px 10px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(255,255,255,.1); color: inherit; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
  .toast button:hover { background: rgba(255,255,255,.18); }
  @media (max-width: 620px) {
    .card { padding: 22px 18px 18px; }
    .row .lemma { min-width: 90px; }
    .row .due { display: none; }
    .import-grid { grid-template-columns: 1fr; }
    .result-head { flex-direction: column; }
  }
  @media (max-width: 480px) {
    .gnode.labeled text { opacity: 0; }
    .gnode.selected text, .gnode.hit text, .gnode:hover text, .gnode.neighbor text { opacity: 1; }
  }

  /* ---------- App shell ---------- */
  :root {
    --bg: #f7f6f3;
    --bg-2: #efece6;
    --surface: #ffffff;
    --surface-2: #f5f4f0;
    --ink: #17181a;
    --muted: #6e6b66;
    --line: #e4e1da;
    --line-strong: #cfcbc2;
    --accent: #243b53;
    --accent-strong: #16283a;
    --accent-soft: #e9eef3;
    --lime: #c8b27c;
    --lime-ink: #2a2416;
    --danger: #a6453a;
    --warn: #8a6420;
    --paper: var(--bg);
    --paper-2: var(--bg-2);
    --card: var(--surface);
    --rust: var(--danger);
    --rust-soft: #f6e9e6;
    --shadow: 0 1px 2px rgba(23, 24, 26, .04), 0 14px 34px rgba(23, 24, 26, .05);
    --ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --display: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
    --read: 'Iowan Old Style', Charter, 'Songti SC', 'Noto Serif SC', serif;
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0e0f11;
    --bg-2: #15171a;
    --surface: #1a1c20;
    --surface-2: #202328;
    --ink: #eceae4;
    --muted: #9a978f;
    --line: #2a2d32;
    --line-strong: #3d4148;
    --accent: #9db6c9;
    --accent-strong: #c2d4e1;
    --accent-soft: #1b2833;
    --lime: #d9c79b;
    --lime-ink: #1d1a12;
    --danger: #e08b80;
    --warn: #d3b274;
    --paper: var(--bg);
    --paper-2: var(--bg-2);
    --card: var(--surface);
    --rust: var(--danger);
    --rust-soft: #2d1f1d;
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
  .app-shell { display: grid; grid-template-columns: 238px minmax(0, 1fr); min-height: 100vh; min-height: 100dvh; }
  .sidebar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: 100vh;
    height: 100dvh;
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
  .resource-row, .pack-card, .store-warning {
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
    background: var(--surface) !important;
  }
  .home-hero::after { content: none; }
  .home-eyebrow { margin-bottom: 12px; color: var(--accent); font-family: var(--mono); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; }
  .home-title { max-width: 22ch; margin: 0; font-family: var(--display); font-size: clamp(32px, 4.6vw, 58px); font-weight: 760; line-height: 1.04; letter-spacing: -.055em; }
  .home-title a { color: inherit !important; }
  .home-meta { margin-top: 12px; color: var(--muted); font-size: 12px; }
  .home-progress { display: flex; align-items: center; gap: 10px; max-width: 480px; margin-top: 22px; }
  .home-track { flex: 1; height: 6px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
  .home-fill { height: 100%; border-radius: inherit; background: var(--accent); transition: width .25s ease; }
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
    box-shadow: none; transition: background .15s ease, border-color .15s ease, color .15s ease, transform .12s ease;
  }
  .btn:hover { border-color: var(--ink); background: var(--surface); }
  .btn:active { transform: translateY(1px); }
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

  /* Library / packs */
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
  @media (max-width: 980px) {
    .app-shell { grid-template-columns: 205px minmax(0, 1fr); }
    .content { width: calc(100% - 40px); }
    .topbar { padding: 12px 20px; }
    .sidebar { padding-left: 10px; padding-right: 10px; }
  }
  @media (max-width: 760px) {
    .app-shell { display: block; min-height: 100dvh; }
    .sidebar { display: none; }
    .topbar {
      min-height: 58px;
      gap: 10px;
      padding: calc(8px + env(safe-area-inset-top)) 14px 8px;
    }
    .topbar-title { min-width: 0; }
    .topbar-eyebrow { font-size: 8px; }
    .topbar-title h1 { overflow: hidden; font-size: 19px; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-actions { gap: 5px; }
    .topbar-actions .icon-btn { min-width: 40px; min-height: 40px; padding: 8px; border-radius: 11px; }
    .topbar-actions .header-import { min-height: 40px; padding: 8px 11px; font-size: 12px; }
    .topbar-lab { display: none; }
    .content {
      width: 100%;
      padding: 14px 14px calc(104px + env(safe-area-inset-bottom));
    }
    .mobile-nav {
      position: fixed;
      left: max(8px, env(safe-area-inset-left));
      right: max(8px, env(safe-area-inset-right));
      bottom: calc(8px + env(safe-area-inset-bottom));
      width: auto;
      max-width: none;
      z-index: 60;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 2px;
      padding: 5px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      box-shadow: 0 14px 36px color-mix(in srgb, var(--ink) 16%, transparent);
      backdrop-filter: blur(18px);
    }
    .mobile-nav button, .mobile-nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-width: 0;
      min-height: 54px;
      border: 0;
      border-radius: 13px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 10px;
      padding: 6px 2px;
      cursor: pointer;
      text-decoration: none;
      overflow: hidden;
      white-space: nowrap;
      touch-action: manipulation;
    }
    .mobile-nav button span, .mobile-nav a span { font-size: 19px; line-height: 1.05; }
    .mobile-nav button.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 650; }
    .mobile-nav a:hover { color: var(--ink); }
    .home-hero { padding: 24px 20px; border-radius: 19px; }
    .home-title { font-size: 34px; }
    .home-grid { grid-template-columns: 1fr; }
    .home-card { padding: 16px; }
    .home-actions .btn, .home-actions .link-button { min-height: 42px; }
    .import-grid { grid-template-columns: 1fr; }
    .passport-head { padding: 20px; }
    .passport-head h1 { font-size: 28px; }
    .passport-stats { grid-template-columns: repeat(2, 1fr); }
    input, textarea, select, .graph-controls input[type="search"] { font-size: 16px; }
    .btn, .icon-btn, .link-button, .article-override { touch-action: manipulation; }
    .article-actions .btn, .result-actions .btn, .row .btn, .settings-save { min-height: 42px; }
    .graph-controls { gap: 8px; }
    .graph-controls input[type="search"] { flex: 1 1 100%; }
    .graph-controls select { flex: 1 1 auto; min-width: 0; }
    .graph-slider { flex: 1 1 100%; }
    .graph-slider input { flex: 1; width: auto; }
    .article-toggle { display: flex; align-items: center; gap: 6px; min-height: 36px; font-size: 12px; }
    #word-graph { min-height: 300px; }
    .graph-detail { top: auto; right: 8px; bottom: 8px; left: 8px; width: auto; max-height: 52%; }
    .mobile-more { padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); }
    .mobile-more-panel { width: 100%; max-height: 72vh; max-height: 72dvh; overflow: auto; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
    .mobile-more-panel a, .mobile-more-panel button { min-height: 48px; }
    .passport-modal, .nuance-modal { padding: 0; align-items: stretch; }
    .passport-sheet, .nuance-sheet { width: 100%; max-height: 100dvh; border-radius: 0; }
    .passport-sheet-bar button, .nuance-bar button, .passport-card-actions .btn { min-height: 44px; }
  }


  ::selection { background: var(--accent-soft); color: var(--ink); }
  .side-nav button.active { box-shadow: inset 2px 0 0 var(--accent); }
  .topbar { box-shadow: 0 1px 0 var(--line); }
  .btn.btn-primary, .btn.primary { box-shadow: none; }
  .empty { padding: 56px 20px; border: 1px dashed var(--line); border-radius: 18px; background: color-mix(in srgb, var(--surface) 70%, transparent); }
  .empty .btn { margin-top: 14px; }
  .empty.loading { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 12px; }
  .home-card { background: var(--surface) !important; transition: border-color .16s ease; }
  .home-card:hover { border-color: var(--line-strong); }
  .read-home-links .btn { background: var(--surface); }
  .read-home-links .btn:hover { border-color: var(--accent); color: var(--accent); }
  .cselect-menu { box-shadow: 0 14px 34px color-mix(in srgb, var(--ink) 16%, transparent); }
  .settings-goals input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }
  .home-hero { padding: 30px 32px 28px; border-radius: 16px; }
  .home-card, .reading-stat, .pack-row, .result-card, .import-card, .settings-card, .passport-block, .insights-card { border-radius: 14px; }
  .home-card, .reading-stat, .pack-row { box-shadow: none; }
  .btn, .cselect-trigger, .icon-btn, .side-import, .mobile-nav { border-radius: 9px; }
  .reading-stat:hover, .pack-row:hover { box-shadow: 0 8px 22px color-mix(in srgb, var(--ink) 7%, transparent); }
  .home-eyebrow { letter-spacing: .14em; }
  .home-title { letter-spacing: -.045em; }

  .sidebar { background: transparent; padding: 24px 18px 18px; }
  .brand-mark { width: 30px; height: 30px; border-radius: 3px; font-family: var(--read); font-size: 12px; letter-spacing: 0; }
  .brand-copy small { font-size: 8.5px; letter-spacing: .16em; }
  .side-import { border-radius: 4px; box-shadow: none; font-size: 12px; font-weight: 600; letter-spacing: .02em; }
  .side-label { margin: 18px 8px 4px; }
  .side-nav button, .side-nav .nav-link { border-radius: 4px; padding: 7px 8px; }
  .nav-icon { display: none; }
  .side-nav button.active { border-radius: 0; background: transparent; color: var(--ink); box-shadow: inset 2px 0 0 var(--accent); }
  .side-stats { padding: 12px 0 0; }
  .side-stats .stats { display: block; }
  .side-stats .stat { display: flex; align-items: baseline; justify-content: space-between; padding: 6px 2px; border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; font-size: 10px; }
  .side-stats .stat:last-child { grid-column: auto; }
  .side-stats .stat strong { font-size: 11px; }
  .sidebar-footer { padding: 10px 2px 0; border-top: 0; }
  .side-utility { border: 0; padding: 4px 2px; text-align: left; }

  .topbar { background: var(--bg); backdrop-filter: none; box-shadow: none; }
  .topbar-eyebrow { display: none; }
  .topbar-title h1 { font-family: var(--read); font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  .icon-btn, .topbar-lab { border-radius: 4px; }
  .content { width: min(1080px, calc(100% - 68px)); padding-top: 30px; }

  .home-hero {
    padding: 4px 0 26px !important;
    border: 0 !important; border-bottom: 1px solid var(--line) !important;
    border-radius: 0 !important; background: transparent !important; box-shadow: none !important;
  }
  html[data-theme="dark"] .home-hero { background: transparent !important; }
  .home-eyebrow { color: var(--rust); font-family: var(--ui); font-size: 10px; font-weight: 600; letter-spacing: .18em; }
  .home-title { font-family: var(--read); font-size: clamp(30px, 4vw, 44px); font-weight: 600; line-height: 1.16; letter-spacing: -.015em; }
  .home-meta { margin-top: 10px; font-size: 12.5px; }
  .home-progress { margin-top: 18px; }
  .home-actions { margin-top: 18px; }
  .read-home-links { gap: 18px; align-items: baseline; }
  .read-home-links .btn { min-height: 0; padding: 0; border: 0; background: none; color: var(--muted); font-size: 11.5px; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; }
  .read-home-links .btn:hover { color: var(--ink); background: none; }

  .reading-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0; margin: 0 0 26px;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .reading-stat {
    padding: 16px 20px;
    border: 0; border-left: 1px solid var(--line); border-radius: 0;
    background: transparent !important; box-shadow: none; transform: none;
  }
  .reading-stat:hover { transform: none; border-color: var(--line); }
  .reading-stat:first-child { padding-left: 0; border-left: 0; border-color: var(--line); background: transparent; }
  .reading-stat b { font-family: var(--read); font-size: 30px; font-weight: 600; letter-spacing: 0; }
  .reading-stat span { margin-top: 6px; font-size: 10.5px; letter-spacing: .02em; }
  @media (max-width: 760px) {
    .reading-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .reading-stat { padding: 14px 14px; }
    .reading-stat:nth-child(odd) { padding-left: 0; border-left: 0; }
    .reading-stat:nth-child(n+3) { border-top: 1px solid var(--line); }
  }

  .home-card, .insights-card, .settings-card, .passport-block {
    padding: 22px 0 !important;
    border: 0 !important; border-top: 1px solid var(--line) !important;
    border-radius: 0 !important; background: transparent !important; box-shadow: none !important;
  }
  .settings-grid { grid-template-columns: 1fr; gap: 0; max-width: 780px; }
  .settings-card h2 { font-family: var(--read); font-size: 19px; font-weight: 600; letter-spacing: -.01em; }

  .insight-stats {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0; margin: 16px 0 8px;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .insight-stat { padding: 12px 16px; border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; }
  .insight-stat:first-child { padding-left: 0; border-left: 0; }
  .insight-stat strong { font-family: var(--read); font-size: 24px; font-weight: 600; }
  @media (max-width: 620px) {
    .insight-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .insight-stat:nth-child(odd) { padding-left: 0; border-left: 0; }
    .insight-stat:nth-child(n+3) { border-top: 1px solid var(--line); }
  }
  .diagnosis-words { gap: 0; border-top: 1px solid var(--line); }
  .diagnosis-word { padding: 9px 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; }
  .diagnosis-word.is-known { border-color: var(--line); background: transparent; }

  .badge, .chip, .insight-chip, .tts-provider, .tts-voice, .pack-group-head span { border-radius: 3px; }
  .btn, .rating, .toolbar input, .tts-form input, input, textarea, select, .cselect-trigger, .mobile-nav { border-radius: 4px; }
  .btn { font-weight: 600; letter-spacing: .01em; }
  .card { border-radius: 6px; box-shadow: none; padding: 28px 28px 22px; }
  .list { gap: 0; }
  .row, .sentence-row, .pack-row, .article-row, .resource-row {
    padding: 14px 0;
    border: 0 !important; border-top: 1px solid var(--line) !important; border-radius: 0 !important;
    background: transparent !important; box-shadow: none !important; transform: none;
  }
  .row:first-child, .sentence-row:first-child, .pack-row:first-child, .article-row:first-child, .resource-row:first-child { border-top: 0 !important; }
  .row:hover, .pack-row:hover, .article-row:hover { transform: none; background: transparent; }
  .pack-row:hover { box-shadow: none; }

  .passport-head { padding: 4px 0 24px !important; border: 0 !important; border-bottom: 1px solid var(--line) !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
  .passport-head h1 { font-family: var(--read); font-weight: 600; letter-spacing: -.015em; }
  .passport-stamps { gap: 0; margin-top: 0; border-top: 1px solid var(--line); }
  .passport-stamp { padding: 16px 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; box-shadow: none; }
  .passport-stamp:hover { transform: none; border-color: var(--line); }
  .achievement-grid { gap: 0; }
  .achievement { padding: 12px 0; border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; }
  .achievement.earned { border-color: var(--line); background: transparent; }
  .achievement-icon { display: none; }
  .graph-wrap, .import-card, .result-card { border-radius: 6px; box-shadow: none; }
  .empty { border-radius: 0; background: transparent; }

  .github-invite {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
    margin: 0; padding: 20px 0 20px 20px;
    border-top: 1px solid var(--line);
    border-left: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent-soft) 45%, transparent);
  }
  .github-invite-copy { max-width: 56ch; }
  .github-invite-kicker { color: var(--accent); font-family: var(--mono); font-size: 9.5px; letter-spacing: .16em; }
  .github-invite h2 { margin: 6px 0 4px; font-family: var(--read); font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  .github-invite p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .github-invite-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; flex: none; }
  .github-invite-actions .link-button { font-size: 11.5px; }
  .side-github {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin: 0 8px 8px; padding: 9px 2px 0; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 10.5px; text-decoration: none;
  }
  .side-github:hover { color: var(--ink); }
  .community {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px;
    margin: 0 8px 8px; color: var(--muted);
    font-family: var(--mono); font-size: 9.5px; letter-spacing: .04em;
  }
  .community[hidden] { display: none; }
  .community b { color: var(--ink); font-weight: 600; }
  .community .live { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #3f8f5a; vertical-align: 1px; }
  .community span + span::before { content: "· "; color: var(--line-strong); }
  .community-inline { display: none; }
  .onboarding {
    margin: 0 0 18px; padding: 18px 20px;
    border: 1px solid var(--line); border-left: 3px solid var(--accent);
    border-radius: 14px; background: var(--surface);
  }
  .onboarding[hidden] { display: none; }
  .onboarding-kicker { display: block; margin-bottom: 4px; color: var(--accent); font-family: var(--mono); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; }
  .onboarding h2 { margin: 0 0 10px; font-family: var(--display); font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
  .onboarding-list { margin: 0 0 14px; padding-left: 18px; color: var(--muted); font-size: 12.5px; line-height: 1.8; }
  .onboarding-list b { color: var(--ink); font-weight: 600; }
  .onboarding-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .onboarding-actions .link-button { font-size: 11.5px; }
  .onboarding-warning {
    margin: 0 0 14px; padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--rust) 32%, var(--line));
    border-radius: 10px; background: color-mix(in srgb, var(--rust) 6%, var(--surface));
    color: var(--ink); font-size: 12px; line-height: 1.7;
  }
  .onboarding-warning b { color: var(--rust); }
  .backup-reminder {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
    margin: 0 0 18px; padding: 14px 16px;
    border: 1px solid color-mix(in srgb, var(--rust) 32%, var(--line));
    border-left: 3px solid var(--rust);
    border-radius: 14px; background: color-mix(in srgb, var(--rust) 5%, var(--surface));
  }
  .backup-reminder[hidden] { display: none; }
  .backup-reminder b { display: block; margin-bottom: 3px; font-size: 13px; }
  .backup-reminder p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; max-width: 62ch; }
  .backup-reminder-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .backup-reminder-actions .link-button { font-size: 11.5px; }
  .settings-warning {
    margin: 10px 0 0; padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--rust) 32%, var(--line));
    border-radius: 10px; background: color-mix(in srgb, var(--rust) 6%, var(--surface));
    color: var(--ink); font-size: 12px; line-height: 1.7;
  }
  .settings-storage { margin: 14px 0 0; }
  .settings-storage h3 { margin: 0 0 6px; font-size: 12.5px; font-weight: 650; }
  .settings-storage .settings-row { padding: 6px 0; }
  .settings-details {
    margin: 12px 0 0; padding: 10px 12px;
    border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2);
  }
  .settings-details summary { cursor: pointer; color: var(--ink); font-size: 12px; }
  .settings-details p { margin: 8px 0 6px; color: var(--muted); font-size: 12px; line-height: 1.8; }
  .settings-details ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12px; line-height: 1.8; }
  .import-note { margin: -4px 0 14px; }
  .llm-hint { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; line-height: 1.6; }
  .llm-hint[hidden] { display: none; }
  @media (max-width: 760px) {
    .community-inline { display: flex; margin: 0 2px 18px; font-size: 11.5px; gap: 0 10px; }
    .community-inline b { font-size: 13px; }
  }
  .settings-about-copy { margin: 0 0 12px; color: var(--muted); font-size: 12.5px; line-height: 1.7; max-width: 64ch; }
  .settings-about-links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
  .settings-about-meta { margin-top: 12px; color: var(--muted); font-family: var(--mono); font-size: 9.5px; letter-spacing: .06em; }

  .view { animation: fadeIn .2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 760px) {
    .mobile-nav { border-radius: 4px; background: var(--surface); box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 12%, transparent); }
    .mobile-nav button, .mobile-nav a, .mobile-nav button.active { border-radius: 2px; }
    .mobile-nav button span, .mobile-nav a span { display: none; }
    .topbar-actions .icon-btn { border-radius: 4px; }
    .content { padding-top: 16px; }
    .home-hero { padding: 2px 0 22px !important; }
    .home-card, .insights-card, .settings-card, .passport-block { padding: 18px 0 !important; }
    .github-invite { flex-direction: column; align-items: stretch; gap: 14px; padding: 18px 14px; }
    .github-invite h2 { font-size: 20px; }
    .github-invite-actions { gap: 8px; }
    .github-invite-actions .btn { min-height: 44px; }
    .github-invite-actions .link-button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 2px; }
    .settings-about-links .btn { min-height: 44px; }
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
    <button class="side-import" type="button" data-go-tab="import">导入文章</button>
    <div class="side-label">学习</div>
    <nav class="side-nav" aria-label="学习">
      <button class="active" data-tab="read" type="button"><span>精读</span></button>
      <button data-tab="packs" type="button"><span>文章</span></button>
    </nav>
    <details class="side-more" data-more>
      <summary>更多</summary>
      <nav class="side-nav side-more-list" aria-label="更多">
        <button data-tab="passport" type="button"><span>成长</span></button>
        <button data-tab="insights" type="button"><span>复盘</span></button>
      </nav>
    </details>
    <div class="sidebar-spacer"></div>
    <div class="side-stats" hidden><div class="stats" id="stats"></div></div>
    <div class="community" id="community" hidden aria-live="polite"></div>
    <a class="side-github" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 打开 CloseRead 仓库（新窗口）">
      <span>GitHub</span><span aria-hidden="true">↗</span>
    </a>
    <div class="sidebar-footer">
      <button class="side-utility" id="lan-toggle" type="button" hidden>手机</button>
      <button class="side-utility" data-tab="settings" type="button">设置</button>
      <button class="side-utility" id="lang-toggle" type="button">EN</button>
    </div>
  </aside>

  <div class="app-main">
    <header class="topbar">
      <div class="topbar-title">
        <span class="topbar-eyebrow" id="page-eyebrow">READ</span>
        <h1 id="page-title">精读</h1>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换主题">自动</button>
        <button class="icon-btn" id="settings-open" type="button" aria-label="设置" title="设置">设置</button>
        <button class="btn btn-primary header-import" type="button" data-go-tab="import">导入</button>
      </div>
    </header>
    <main class="content" id="main-content" tabindex="-1">
      <div class="store-warning" id="store-warning" hidden></div>
      <div class="phone-mode-banner" id="phone-mode-banner" hidden>手机模式：可继续精读、看释义和记批注；导入、删除和设置请回到电脑。</div>

  <section class="view active" id="view-home">
    <section class="onboarding" id="onboarding" aria-labelledby="onboarding-title" hidden>
      <div class="onboarding-head">
        <span class="onboarding-kicker">第一次来</span>
        <h2 id="onboarding-title">三件事，三十秒看完</h2>
      </div>
      <ol class="onboarding-list">
        <li><b>内容存在这个浏览器里。</b>换手机或换电脑打开是空的，要迁移请在「设置 → 设备迁移」导出再导入。</li>
        <li><b>需要自己的模型 Key。</b>没有 Key 时只会挑出候选词，<b>不会生成中文译文</b>，基本没法精读；填了之后才有逐段翻译、释义和练习。Key 只存在这个浏览器。</li>
        <li><b>从一篇文章开始。</b>粘贴文本、贴一个链接，或上传 PDF / EPUB / DOCX。</li>
      </ol>
      <p class="onboarding-warning"><b>务必定期导出。</b>清浏览器数据、换设备，或在 iPhone 上超过 7 天不打开，本地内容都可能被清掉。导出文件存在你自己的电脑或网盘里，随时能导回来。</p>
      <div class="onboarding-actions">
        <button class="btn btn-primary" id="onboarding-start" type="button">导入第一篇</button>
        <button class="link-button" id="onboarding-dismiss" type="button">知道了，别再显示</button>
      </div>
    </section>
    <section class="backup-reminder" id="backup-reminder" aria-live="polite" hidden>
      <div>
        <b>你的文章只存在这个浏览器里</b>
        <p>清浏览器数据、换手机，或在 iPhone 上超过 7 天不打开，都可能丢失。建议现在导出一份，以后随时能导回来。</p>
      </div>
      <div class="backup-reminder-actions">
        <button class="btn btn-primary" id="backup-reminder-export" type="button">立即导出</button>
        <button class="link-button" id="backup-reminder-snooze" type="button">7 天后再提醒</button>
      </div>
    </section>
    <div class="home-hero" id="home-hero"></div>
    <div class="community community-inline" id="community-inline" hidden aria-live="polite"></div>
    <div class="reading-stats" id="reading-stats"></div>
    <div class="read-home-links">
      <button class="btn" data-go-tab="packs" type="button">全部文章</button>
      <button class="btn" data-go-tab="import" type="button">导入新材料</button>
      <button class="btn" data-go-tab="insights" type="button">阅读复盘</button>
    </div>
    <div class="home-card" id="home-recent"></div>
    <section class="github-invite" id="github-invite" aria-labelledby="github-invite-title">
      <div class="github-invite-copy">
        <div class="github-invite-kicker">开源项目</div>
        <h2 id="github-invite-title">喜欢 CloseRead？</h2>
        <p>如果它对你的英语学习有帮助，欢迎在 GitHub 点亮 Star、Fork 一份，或直接提建议。</p>
      </div>
      <div class="github-invite-actions">
        <a class="btn btn-primary" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">在 GitHub 点亮 Star</a>
        <a class="btn" href="${GITHUB_FORK}" target="_blank" rel="noopener noreferrer">Fork</a>
        <a class="link-button" href="${GITHUB_ISSUES}" target="_blank" rel="noopener noreferrer">提建议</a>
      </div>
    </section>
  </section>

  <section class="view" id="view-packs">
    <div class="read-home-links"><button class="btn" data-go-tab="read" type="button">← 精读</button><button class="btn" data-go-tab="import" type="button">导入新材料</button></div>
    <div class="list" id="packs-list"></div>
  </section>

  <section class="view" id="view-passport">
    <div class="passport-links"><button class="btn" data-go-tab="insights" type="button">查看本周复盘</button><button class="btn" id="backup-download" type="button">导出全部内容</button></div>
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
      <div class="home-card settings-card settings-about" id="settings-about">
        <h2>关于 CloseRead</h2>
        <p class="settings-about-copy" id="settings-about-copy">开源英语精读工具。内容存在你的浏览器里，服务器不保存你的文章；模型由你自己选择，也可以随时导出换设备。</p>
        <div class="settings-about-links">
          <a class="btn btn-primary" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">在 GitHub 点亮 Star</a>
          <a class="btn" href="${GITHUB_FORK}" target="_blank" rel="noopener noreferrer">Fork</a>
          <a class="btn" href="${GITHUB_ISSUES}" target="_blank" rel="noopener noreferrer">提建议</a>
        </div>
        <div class="settings-about-meta">MIT License · 本地优先 · 开源仓库</div>
      </div>
    </div>
  </section>

  <section class="view" id="view-insights">
    <div class="home-card insights-card" id="insight-weekly">加载中…</div>
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
    <p class="small muted import-note">导入的文字会由服务器解析并生成学习包，结果只保存在你的浏览器里，服务器不留存。</p>
    <div class="source-tabs" id="source-tabs" role="tablist" aria-label="导入来源">
      <button class="active" type="button" data-source="text" role="tab">粘贴文本</button>
      <button type="button" data-source="url" role="tab">网页链接</button>
      <button type="button" data-source="pdf" role="tab">PDF</button>
      <button type="button" data-source="ebook" role="tab">电子书 / 文件</button>
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
          <small class="llm-hint" id="llm-base-hint" hidden></small>
        </label>
      </div>
      <div class="llm-settings-actions">
        <button class="btn btn-primary" id="llm-save" type="button">保存模型设置</button>
        <span class="muted" id="llm-settings-message">Key 只保存在这个浏览器里，调用模型时随请求发送，不会写入服务器磁盘。</span>
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
    <label class="article-toggle audio-toggle"><input type="checkbox" id="only-new"> 只选生词（已收录的词不进入本包）</label>
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
        <label class="import-option"><input type="checkbox" id="import-text-ai-clean" checked> 清理正文 <span>去导航、订阅、相关推荐；需要模型</span></label>
        <button class="btn btn-primary" type="submit">导入文本</button>
      </form>
      <form class="import-card wide" id="import-url-form" data-source-panel="url">
        <h2>网页链接</h2>
        <p>支持普通文章页、RSS/Atom 订阅链接和直链 PDF；订阅会导入最新一篇。付费墙、登录页和机器人验证页无法抓取。</p>
        <input id="import-url" type="text" inputmode="url" placeholder="https://example.com/article">
        <input id="import-url-title" type="text" placeholder="标题（可选）">
        <label class="import-option"><input type="checkbox" id="import-url-ai-clean" checked> 清理正文 <span>去导航、订阅、相关推荐；需要模型</span></label>
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
        <input id="import-ebook" type="file" accept=".epub,.mobi,.azw,.azw3,.docx,.html,.htm,.txt,.md,.markdown,application/epub+zip,application/x-mobipocket-ebook,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain,text/markdown">
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
    <button class="active" data-tab="read" type="button">精读</button>
    <button data-tab="packs" type="button">文章</button>
    <button data-mobile-more type="button">更多</button>
  </nav>
  <div class="mobile-more" id="mobile-more" hidden>
    <div class="mobile-more-panel" role="dialog" aria-modal="true" aria-label="更多">
      <div class="mobile-more-head"><strong>更多</strong><button class="link-button" data-mobile-more-close type="button">关闭</button></div>
      <button data-tab="passport" type="button">成长</button>
      <button data-tab="insights" type="button">复盘</button>
      <button data-tab="settings" type="button">设置</button>
      <a href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">GitHub 开源仓库 <span aria-hidden="true">↗</span></a>
    </div>
  </div>
</div>
<div class="lan-panel" id="lan-panel" hidden>
  <div class="lan-panel-head"><strong>手机访问</strong><button class="link-button" id="lan-close" type="button">关闭</button></div>
  <div id="lan-body"></div>
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
    tab: 'home', stats: {},
    today: null, passport: null, shareStamp: null,
    resources: [], building: null, currentJobId: null, buildFromQueue: false,
    buildQueue: [], selectedArticles: {}, queueStats: null, savedQueue: [],
    articleResource: null, articles: [], articlePacks: [], articleHidden: [],
    graph: null, graphSelected: null, graphQuery: '', graphFocus: null,
    graphPositions: [], graphNodes: [], graphEdges: [],
    graphZoom: 1, graphPanX: 0, graphPanY: 0, graphHop: 1, graphPathStart: null, graphPath: [],
    lan: null, nuanceCombo: 0, publicMode: false,
    importResource: null, importArticle: null, importArticlesView: false,
    upload: null, lastUpload: null
  };
  var LLM_PRESETS = ${JSON.stringify(LLM_PROVIDERS.map((provider) => ({ id: provider.id, label: provider.label, baseUrl: provider.baseUrl, model: provider.model, models: provider.models, api: provider.api, hint: provider.hint ?? '' })))};
  var TTS_PRESETS = ${JSON.stringify(TTS_PROVIDERS.map((provider) => ({ id: provider.id, label: provider.label, baseUrl: provider.baseUrl, model: provider.model, voice: provider.voice, voices: provider.voices, instructions: provider.instructions, hint: provider.hint })))};
  var els = {
    stats: document.getElementById('stats'),
    community: document.getElementById('community'),
    communityInline: document.getElementById('community-inline'),
    lanToggle: document.getElementById('lan-toggle'),
    lanPanel: document.getElementById('lan-panel'),
    lanBody: document.getElementById('lan-body'),
    todayPlan: document.getElementById('today-plan'),
    homeHero: document.getElementById('home-hero'),
    homeRecent: document.getElementById('home-recent'),
    homeReview: document.getElementById('home-review'),
    homeOutputs: document.getElementById('home-outputs'),
    packsList: document.getElementById('packs-list'),
    toast: document.getElementById('toast'),
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

  function toast(message, actionLabel, action) {
    clearTimeout(toast.timer);
    els.toast.textContent = '';
    var text = document.createElement('span');
    text.textContent = message;
    els.toast.appendChild(text);
    var button = null;
    if (actionLabel && action) {
      button = document.createElement('button');
      button.type = 'button';
      button.textContent = actionLabel;
      button.addEventListener('click', function () {
        els.toast.classList.remove('show');
        action();
      });
      els.toast.appendChild(button);
    }
    els.toast.classList.toggle('with-action', Boolean(button));
    els.toast.classList.add('show');
    toast.timer = setTimeout(function () { els.toast.classList.remove('show'); }, button ? 6500 : 1600);
  }

  function api(path, options) {
    return fetch(path, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        var method = (options && options.method) || 'GET';
        if (method !== 'GET' && method !== 'HEAD') scheduleCheckpoint();
        // Build jobs finish after their request returned, so pull the result
        // as soon as the job reports done.
        if (path.indexOf('/api/jobs/') === 0 && data && (data.status === 'done' || (data.job && data.job.status === 'done'))) {
          scheduleCheckpoint();
        }
        return data;
      });
    });
  }

  var localDbPromise = null;
  function localDb() {
    if (!localDbPromise) localDbPromise = import('/local-file-db.js');
    return localDbPromise;
  }

  var checkpointTimer = null;
  var checkpointRunning = false;

  function scheduleCheckpoint() {
    if (checkpointTimer) clearTimeout(checkpointTimer);
    checkpointTimer = setTimeout(function () {
      checkpointTimer = null;
      checkpointNow();
    }, 500);
  }

  // The server keeps a scratch copy; this pulls whatever it changed back into
  // IndexedDB, which is the copy that survives a restart.
  function checkpointNow() {
    if (checkpointRunning) return Promise.resolve();
    checkpointRunning = true;
    return api('/api/checkpoint').then(function (data) {
      if (!data || !data.files || !data.files.length) return;
      return localDb().then(function (db) { return db.saveFiles(data.files); });
    }).catch(function () {}).finally(function () { checkpointRunning = false; });
  }

  // After a restart the scratch copy is gone; push the browser's copy back up.
  function syncFromBrowser() {
    return localDb().then(function (db) {
      return db.loadAll().then(function (files) {
        if (!files || Object.keys(files).length === 0) return false;
        return api('/api/session').then(function (session) {
          if (session && session.personal) {
            return checkpointNow().then(function () { return false; });
          }
          return api('/api/hydrate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ files: files })
          }).then(function () { return true; });
        });
      });
    }).catch(function () { return false; });
  }

  function loadCommunityStats() {
    var hosts = [els.community, els.communityInline].filter(function (node) { return Boolean(node); });
    if (!hosts.length) return;
    api('/api/public/stats').then(function (data) {
      var visible = Boolean(data) && data.mode === 'public';
      var total = visible ? Number(data.totalUsers || 0) : 0;
      var online = visible ? Number(data.online || 0) : 0;
      hosts.forEach(function (host) {
        host.hidden = !visible;
        if (!visible) { host.innerHTML = ''; return; }
        host.innerHTML =
          '<span><b>' + total.toLocaleString('en-US') + '</b> 人用过</span>' +
          '<span><i class="live"></i><b>' + online.toLocaleString('en-US') + '</b> 人在线</span>';
      });
    }).catch(function () {});
  }

  var ONBOARD_KEY = 'cr-onboarding-dismissed';

  var EXPORT_STAMP_KEY = 'cr-last-export';
  var EXPORT_SNOOZE_KEY = 'cr-backup-snooze';
  var EXPORT_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
  var EXPORT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

  function markExported() {
    try { localStorage.setItem(EXPORT_STAMP_KEY, String(Date.now())); } catch (error) {}
  }

  // Nudge people to keep an off-browser copy. This is the only guard against a
  // cleared browser profile or iOS reclaiming an unused site's storage.
  function maybeShowBackupReminder() {
    var host = document.getElementById('backup-reminder');
    if (!host || !state.publicMode) return;
    var now = Date.now();
    try {
      var snooze = Number(localStorage.getItem(EXPORT_SNOOZE_KEY) || 0);
      if (snooze && now < snooze) return;
      var last = Number(localStorage.getItem(EXPORT_STAMP_KEY) || 0);
      if (last && now - last < EXPORT_INTERVAL_MS) return;
    } catch (error) {
      return;
    }
    localDb().then(function (db) { return db.summary(); }).then(function (info) {
      if (!info || info.packs < 1) return;
      host.hidden = false;
      var exportBtn = document.getElementById('backup-reminder-export');
      if (exportBtn && exportBtn.getAttribute('data-bound') !== '1') {
        exportBtn.setAttribute('data-bound', '1');
        exportBtn.addEventListener('click', function () {
          host.hidden = true;
          exportWorkspaceLocal(exportBtn);
        });
      }
      var snoozeBtn = document.getElementById('backup-reminder-snooze');
      if (snoozeBtn && snoozeBtn.getAttribute('data-bound') !== '1') {
        snoozeBtn.setAttribute('data-bound', '1');
        snoozeBtn.addEventListener('click', function () {
          try { localStorage.setItem(EXPORT_SNOOZE_KEY, String(Date.now() + EXPORT_SNOOZE_MS)); } catch (error) {}
          host.hidden = true;
        });
      }
    }).catch(function () {});
  }

  function renderOnboarding() {
    var host = document.getElementById('onboarding');
    if (!host) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(ONBOARD_KEY) === '1'; } catch (error) {}
    if (dismissed) { host.hidden = true; return; }
    host.hidden = false;
    var start = document.getElementById('onboarding-start');
    if (start && start.getAttribute('data-bound') !== '1') {
      start.setAttribute('data-bound', '1');
      start.addEventListener('click', function () { switchTab('import'); });
    }
    var dismiss = document.getElementById('onboarding-dismiss');
    if (dismiss && dismiss.getAttribute('data-bound') !== '1') {
      dismiss.setAttribute('data-bound', '1');
      dismiss.addEventListener('click', function () {
        try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (error) {}
        host.hidden = true;
      });
    }
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
    box.innerHTML = '<strong>数据提醒</strong>' + list.map(function (warning) {
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
      '<span class="stat">在读 <strong>' + (readingStats.inProgress || 0) + '</strong> 篇</span>' +
      '<span class="stat">已读 <strong>' + (readingStats.paragraphsRead || 0) + '</strong> 段</span>';
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
    var outputs = data.outputs || {};
    var activity = (articles.finished || 0) + (outputs.count || 0) + (data.studyDays || 0);
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
      insightStat('读完词数', articles.words || 0, ' 词') +
      insightStat('阅读天数', data.studyDays || 0, goals.studyDays ? ' / ' + goals.studyDays + ' 天' : ' 天') +
      insightStat('写作输出', outputs.count || 0, ' 次') +
      '</div>';
    if (articles.titles && articles.titles.length) {
      html += '<div class="insight-block"><h3>读完的文章</h3><ul class="insight-list">' +
        articles.titles.map(function (title) { return '<li>' + escapeHtml(title) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (outputs.latest) {
      html += '<div class="insight-block"><h3>最近的输出</h3><p>' + escapeHtml(outputs.latest.text) + '</p></div>';
    }
    html += '<div class="insight-block"><h3>下周建议</h3><p>' + escapeHtml(data.suggestion || '') + '</p></div>' + exportAction;
    host.innerHTML = html;
  }

  function renderDiagnosis(data) {
    var host = document.getElementById('insight-diagnosis');
    if (!host || !data) return;
    var words = data.words || [];
    var diagnosis = data.diagnosis || null;
    var revealed = Boolean(data.revealed);
    var known = {};
    var seed = data.known || (diagnosis && diagnosis.knownLemmas ? diagnosis.knownLemmas : []);
    seed.forEach(function (lemma) { known[lemma] = true; });
    var knownCount = Object.keys(known).length;
    var html = '<div class="insight-head"><h2>词汇诊断</h2><span>' +
      (diagnosis
        ? '上次 ' + escapeHtml(diagnosis.level) + ' · ' + diagnosis.knownCount + ' / ' + diagnosis.total +
          ' · ' + escapeHtml(String(diagnosis.completedAt).slice(0, 10))
        : '3 分钟 · 用来校准阅读难度') +
      '</span></div>' +
      '<p class="insight-copy">先凭第一反应判断，暂不显示释义；点“核对释义”后再对照意思、修正判断。结果只保存在你的浏览器里，用来校准文章难度和生词标注。</p>' +
      '<div class="diagnosis-words' + (revealed ? ' is-revealed' : '') + '" id="diagnosis-words">' +
      words.map(function (word) {
        var isKnown = Boolean(known[word.lemma]);
        return '<button type="button" class="diagnosis-word' + (isKnown ? ' is-known' : '') +
          '" data-diagnosis-word="' + escapeHtml(word.lemma) + '" aria-pressed="' + (isKnown ? 'true' : 'false') + '">' +
          '<b>' + escapeHtml(word.lemma) + '</b><span class="diagnosis-gloss">' + escapeHtml(word.gloss) + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="diagnosis-actions">' +
      (revealed ? '' : '<button class="btn" id="diagnosis-reveal" type="button">核对释义</button>') +
      '<button class="btn btn-primary" id="diagnosis-save" type="button"' + (revealed ? '' : ' disabled') + '>保存诊断</button>' +
      '<span class="muted" id="diagnosis-count">已认识 ' + knownCount + ' / ' + words.length + '</span></div>' +
      '<div class="diagnosis-note" id="diagnosis-note">' + (revealed
        ? '对照释义确认刚才的判断；点错的词可以再点一次取消，然后保存。'
        : '释义已隐藏。判断完自己的熟悉程度后，再点“核对释义”。') +
      (diagnosis ? ' 当前水平：' + escapeHtml(diagnosis.level) + '，重新诊断会覆盖上次结果，但阅读记录不受影响。' : '') +
      '</div>';
    host.innerHTML = html;

    function updateCount() {
      var count = document.getElementById('diagnosis-count');
      if (count) count.textContent = '已认识 ' + Object.keys(known).length + ' / ' + words.length;
    }

    host.querySelectorAll('[data-diagnosis-word]').forEach(function (button) {
      button.addEventListener('click', function () {
        var lemma = button.getAttribute('data-diagnosis-word');
        if (known[lemma]) delete known[lemma];
        else known[lemma] = true;
        var isKnown = Boolean(known[lemma]);
        button.classList.toggle('is-known', isKnown);
        button.setAttribute('aria-pressed', isKnown ? 'true' : 'false');
        updateCount();
      });
    });

    var reveal = document.getElementById('diagnosis-reveal');
    if (reveal) {
      reveal.addEventListener('click', function () {
        var grid = document.getElementById('diagnosis-words');
        if (grid) grid.classList.add('is-revealed');
        reveal.remove();
        var saveButton = document.getElementById('diagnosis-save');
        if (saveButton) saveButton.disabled = false;
        var note = document.getElementById('diagnosis-note');
        if (note) {
          note.textContent = '对照释义确认刚才的判断；点错的词可以再点一次取消，然后保存。' +
            (diagnosis ? ' 当前水平：' + diagnosis.level + '，重新诊断会覆盖上次结果，但阅读记录不受影响。' : '');
        }
      });
    }

    var save = document.getElementById('diagnosis-save');
    if (save) {
      save.addEventListener('click', function () {
        save.disabled = true;
        api('/api/diagnosis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ known: Object.keys(known), words: words.map(function (word) { return word.lemma; }) }),
        }).then(function (result) {
          toast('诊断已保存：' + result.diagnosis.level);
          renderDiagnosis({ words: words, diagnosis: result.diagnosis, revealed: true, known: Object.keys(known) });
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

  function initTtsSettings(initial) {
    var providersHost = document.getElementById('tts-providers');
    if (!providersHost) return;
    var keyField = document.getElementById('tts-key-field');
    var baseField = document.getElementById('tts-base-field');
    var modelField = document.getElementById('tts-model-field');
    var voiceField = document.getElementById('tts-voice-field');
    var keyInput = document.getElementById('tts-key');
    var baseInput = document.getElementById('tts-base');
    var modelInput = document.getElementById('tts-model');
    var voiceInput = document.getElementById('tts-voice');
    var hint = document.getElementById('tts-provider-hint');
    var voiceList = document.getElementById('tts-voice-list');
    var message = document.getElementById('tts-message');
    var draft = initial.provider || 'local';
    var lastProvider = draft;
    function presetOf(id) {
      for (var i = 0; i < TTS_PRESETS.length; i++) {
        if (TTS_PRESETS[i].id === id) return TTS_PRESETS[i];
      }
      return TTS_PRESETS[0];
    }
    function renderProviders() {
      providersHost.innerHTML = TTS_PRESETS.map(function (provider) {
        return '<button class="tts-provider' + (provider.id === draft ? ' active' : '') +
          '" type="button" data-tts-provider="' + escapeHtml(provider.id) + '">' + escapeHtml(provider.label) + '</button>';
      }).join('');
    }
    function renderVoices(preset) {
      var voices = preset.voices || [];
      voiceList.hidden = voices.length === 0;
      voiceList.innerHTML = voices.map(function (voice) {
        return '<button class="tts-voice' + (voice === voiceInput.value.trim() ? ' active' : '') +
          '" type="button" data-tts-voice="' + escapeHtml(voice) + '">' + escapeHtml(voice) + '</button>';
      }).join('');
    }
    function syncFields() {
      var preset = presetOf(draft);
      var needsKey = preset.id !== 'local' && preset.id !== 'edge';
      keyField.hidden = !needsKey;
      baseField.hidden = !needsKey;
      modelField.hidden = !needsKey;
      voiceField.hidden = preset.id === 'local';
      keyInput.placeholder = initial.keySource === 'stored' ? '已保存，留空则不修改' : 'sk-...';
      baseInput.placeholder = preset.baseUrl || 'https://…';
      modelInput.placeholder = preset.model || '模型 ID';
      voiceInput.placeholder = preset.voice || '默认';
      hint.textContent = preset.hint || '';
      if (preset.id !== lastProvider) {
        keyInput.value = '';
        baseInput.value = preset.baseUrl || '';
        modelInput.value = preset.model || '';
        voiceInput.value = preset.voice || '';
        lastProvider = preset.id;
      }
      renderVoices(preset);
    }
    renderProviders();
    baseInput.value = initial.baseUrl || '';
    modelInput.value = initial.model || '';
    voiceInput.value = initial.voice || '';
    syncFields();
    providersHost.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tts-provider]');
      if (!button) return;
      draft = button.getAttribute('data-tts-provider');
      renderProviders();
      syncFields();
    });
    voiceList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tts-voice]');
      if (!button) return;
      voiceInput.value = button.getAttribute('data-tts-voice');
      renderVoices(presetOf(draft));
    });
    document.getElementById('tts-save').addEventListener('click', function () {
      message.textContent = '保存中…';
      api('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: draft,
          apiKey: keyInput.value.trim(),
          baseUrl: baseInput.value.trim(),
          model: modelInput.value.trim(),
          voice: voiceInput.value.trim(),
        }),
      }).then(function () {
        toast('语音设置已保存');
        reloadSettings();
      }).catch(function (error) {
        message.textContent = '保存失败：' + error.message;
      });
    });
    document.getElementById('tts-clear').addEventListener('click', function () {
      api('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      }).then(function () {
        toast('已改回本地语音');
        reloadSettings();
      }).catch(function (error) {
        message.textContent = '操作失败：' + error.message;
      });
    });
  }

  function reloadSettings() {
    return api('/api/settings').then(renderSettings).catch(function (error) { toast(error.message); });
  }

  function renderSettings(data) {
    var goalsHost = document.getElementById('settings-goals');
    if (goalsHost) {
      var prefs = data.preferences || {};
      goalsHost.innerHTML = '<h2>阅读目标</h2>' +
        '<p class="muted">每周目标用于阅读复盘和成长页的进度，不影响文章内容。</p>' +
        '<div class="settings-goals">' +
        '<label>每周文章 <input id="settings-week-articles" type="number" min="0" max="100" step="1" value="' + escapeHtml(String(prefs.weeklyArticleGoal ?? 3)) + '"></label>' +
        '<label>每周阅读天数 <input id="settings-week-days" type="number" min="0" max="7" step="1" value="' + escapeHtml(String(prefs.weeklyStudyDaysGoal ?? 5)) + '"></label>' +
        '<button class="btn btn-primary" id="settings-goals-save" type="button">保存目标</button>' +
        '<span class="small muted" id="settings-goals-status"></span></div>';
    }
    var appHost = document.getElementById('settings-app');
    if (appHost) {
      appHost.innerHTML = '<h2>应用</h2>' +
        '<p class="muted">把 CloseRead 添加到桌面或手机主屏，打开时更像一个独立应用；你的空间和进度不会跳转到别的设备。</p>' +
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
      var isPublic = data.workspace && data.workspace.mode === 'public';
      dataHost.innerHTML = '<h2>数据与学习包</h2>' +
        (isPublic
          ? settingsRow('专属空间', data.workspace.readOnly ? '演示空间（只读）' : '本浏览器空间 · 其他访客看不到')
          : settingsRow('数据目录', '<code>' + escapeHtml(data.dataDir || '') + '</code>') +
            settingsRow('学习包目录', '<code>' + escapeHtml(data.packsDir || '') + '</code>')) +
        settingsRow('学习包 / 回收站', (data.counts && data.counts.packs || 0) + ' 篇 / ' + (data.trash ? data.trash.length + ' 个回收站条目' : '0')) +
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
        '<details class="tts-details"><summary>设置语音模型</summary>' +
        '<div class="tts-form">' +
        '<div class="tts-providers" id="tts-providers"></div>' +
        '<p class="small muted" id="tts-provider-hint"></p>' +
        '<label id="tts-key-field">API Key<input id="tts-key" type="password" autocomplete="off" placeholder="sk-..."></label>' +
        '<label id="tts-base-field">Base URL<input id="tts-base" type="url" placeholder="https://dashscope.aliyuncs.com/api/v1"></label>' +
        '<label id="tts-model-field">模型<input id="tts-model" type="text" placeholder="qwen3-tts-flash"></label>' +
        '<label id="tts-voice-field">音色<input id="tts-voice" type="text" placeholder="Cherry"></label>' +
        '<div class="tts-voice-list" id="tts-voice-list"></div>' +
        '<div class="settings-actions"><button class="btn btn-primary" id="tts-save" type="button">保存语音设置</button>' +
        '<button class="btn" id="tts-clear" type="button">改回本地语音</button>' +
        '<span class="small muted" id="tts-message"></span></div>' +
        '</div></details>' +
        '<div class="settings-actions"><a class="btn" href="/?tab=read">去精读</a></div>';
      initTtsSettings(tts);
    }
    var backupHost = document.getElementById('settings-backup');
    if (backupHost) {
      state.publicMode = Boolean(data.workspace && data.workspace.mode === 'public');
      var aboutCopy = document.getElementById('settings-about-copy');
      if (aboutCopy) {
        aboutCopy.textContent = state.publicMode
          ? '开源英语精读工具。你的文章、进度和批注存在这个浏览器里，服务器不保存；换设备用下面的「设备迁移」。'
          : '开源英语精读工具。内容存在本机的 data/ 和 packs/ 目录里，模型由你自己选择。';
      }
      backupHost.innerHTML = '<h2>设备迁移</h2>' +
        (state.publicMode
          ? '<p class="muted">你的文章、学习项、阅读进度和批注都存在这个浏览器里。换手机或换电脑时，先在这里导出，再在新设备上导入。</p>'
          : '<p class="muted">换手机或换电脑时，在这里导出全部内容，再在新设备上导入。</p>') +
        '<div class="settings-actions"><button class="btn btn-primary" id="settings-backup" type="button">导出到本机</button></div>' +
        '<div class="settings-file"><input type="file" id="settings-restore-file" accept="application/json,.json">' +
        '<button class="btn" id="settings-restore-run" type="button">从文件导入</button>' +
        '<span id="settings-restore-status"></span></div>' +
        '<p class="small muted">导入会覆盖当前的文章、学习项和阅读进度，请先导出一份。模型 Key 不包含在文件里，需要在新设备上重新填写。</p>' +
        '<div class="settings-storage" id="settings-storage" hidden></div>' +
        '<details class="settings-details">' +
          '<summary>数据到底存在哪里？</summary>' +
          '<p>不在系统的文件夹里，所以「文稿」或「下载」里找不到。浏览器为这个站点单独划了一块空间（IndexedDB），只有本站能读，别人看不到。</p>' +
          '<ul>' +
            '<li>Chrome / Edge：设置 → 隐私和安全 → 网站设置 → 查看权限和网站数据，搜索本站可看到占用和清理入口。</li>' +
            '<li>Safari：设置 → 隐私 → 管理网站数据。</li>' +
            '<li>无痕窗口、换一个浏览器、换系统账户，都看不到这份内容。</li>' +
            '<li>清理「Cookie 和网站数据」会把它一起删掉，导出的文件是唯一保险。</li>' +
          '</ul>' +
        '</details>' +
        (state.publicMode
          ? '<p class="settings-warning"><b>数据只在这个浏览器里。</b>清除浏览数据、换设备，或在 iPhone 上超过 7 天不打开，内容都可能丢失。导出是唯一的备份方式，建议每个月导一次。</p>'
          : '');
      fillStoragePanel();
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
      var weekArticles = document.getElementById('settings-week-articles');
      var weekDays = document.getElementById('settings-week-days');
      var status = document.getElementById('settings-goals-status');
      setBusy(goalsSave, true, '保存中…');
      api('/api/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
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
    if (backupButton) backupButton.addEventListener('click', function () {
      if (state.publicMode) exportWorkspaceLocal(backupButton);
      else downloadBackup(backupButton);
    });
    var restoreRun = document.getElementById('settings-restore-run');
    if (restoreRun) restoreRun.addEventListener('click', function () {
      var input = document.getElementById('settings-restore-file');
      var status = document.getElementById('settings-restore-status');
      var file = input && input.files && input.files[0];
      if (!file) { if (status) status.textContent = '先选择一个迁移文件。'; return; }
      if (state.publicMode) { importWorkspaceLocal(file, status, restoreRun); return; }
      if (!confirm('恢复会覆盖当前文章、学习项和阅读进度。确认继续？')) return;
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

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return Math.round(value / 1024) + ' KB';
    if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + ' MB';
    return (value / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function formatWhen(ms) {
    if (!ms) return '从未导出';
    var days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    return days + ' 天前';
  }

  // Show the real numbers so "stored in your browser" is not a vague promise.
  function fillStoragePanel() {
    if (!state.publicMode) return;
    var host = document.getElementById('settings-storage');
    if (!host) return;
    var persisted = Promise.resolve(false);
    try {
      if (navigator.storage && navigator.storage.persisted) persisted = navigator.storage.persisted();
    } catch (error) {}
    localDb().then(function (db) {
      return Promise.all([db.summary(), db.storageInfo(), persisted]);
    }).then(function (results) {
      var info = results[0] || {};
      var quota = results[1] || {};
      var isPersisted = results[2] === true;
      var used = Number(info.bytes || quota.usage || 0);
      var capacity = Number(quota.quota || 0);
      var percent = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
      var lastExport = 0;
      try { lastExport = Number(localStorage.getItem(EXPORT_STAMP_KEY) || 0); } catch (error) {}
      var rows =
        settingsRow('占用', formatBytes(used) + ' · ' + (info.packs || 0) + ' 篇文章') +
        settingsRow('浏览器配额', capacity ? formatBytes(capacity) + '（已用 ' + percent + '%）' : '浏览器未提供') +
        settingsRow('上次导出', formatWhen(lastExport)) +
        settingsRow('持久化', isPersisted ? '已开启，浏览器不会自动清理' : '未开启，空间紧张时可能被清理');
      if (percent >= 75) {
        rows += '<p class="settings-warning"><b>空间快满了。</b>建议先导出一份，再删掉一些读完的文章。</p>';
      }
      if (!isPersisted) {
        rows += '<div class="settings-actions"><button class="btn small" id="settings-persist" type="button">申请持久化存储</button></div>' +
          '<p class="small muted">申请后浏览器更不容易在空间紧张时清理这些数据；能否通过由浏览器决定。</p>';
      }
      host.innerHTML = '<h3>本浏览器占用</h3>' + rows;
      host.hidden = false;
      var persistButton = document.getElementById('settings-persist');
      if (persistButton) {
        persistButton.addEventListener('click', function () {
          setBusy(persistButton, true, '申请中…');
          localDb().then(function (db) { return db.requestPersistence(); })
            .then(function (granted) {
              toast(granted ? '已开启持久化存储' : '浏览器没有批准，导出备份仍然有效');
              fillStoragePanel();
            })
            .catch(function () { toast('申请失败，可以继续正常使用'); })
            .finally(function () { setBusy(persistButton, false); });
        });
      }
    }).catch(function () {});
  }

  function exportWorkspaceLocal(button) {
    if (button) setBusy(button, true, '打包中…');
    checkpointNow()
      .then(function () { return localDb(); })
      .then(function (db) {
        return db.exportText().then(function (text) {
          var blob = new Blob([text], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'closeread-' + new Date().toISOString().slice(0, 10) + '.json';
          link.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
          markExported();
          toast('已导出 ' + Math.round(blob.size / 1024) + ' KB 到下载目录，在新设备上用「从文件导入」恢复');
        });
      })
      .catch(function (error) { toast('导出失败：' + error.message); })
      .finally(function () { if (button) setBusy(button, false); });
  }

  function importWorkspaceLocal(file, status, button) {
    if (!confirm('导入会覆盖这个浏览器里的全部内容，确认继续？')) return;
    if (button) setBusy(button, true, '导入中…');
    if (status) status.textContent = '导入中…';
    file.text()
      .then(function (text) {
        return localDb().then(function (db) {
          return db.importText(text).then(function (result) {
            return db.loadAll().then(function (files) {
              return api('/api/hydrate', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ files: files })
              }).then(function () {
                if (status) status.textContent = '已导入 ' + result.files + ' 个文件，正在刷新…';
                setTimeout(function () { location.reload(); }, 600);
              });
            });
          });
        });
      })
      .catch(function (error) { if (status) status.textContent = '导入失败：' + error.message; })
      .finally(function () { if (button) setBusy(button, false); });
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
      toast('已导出 ' + Math.round(blob.size / 1024) + ' KB，在新设备上用「从文件导入」恢复');
    }).catch(function (error) {
      toast('备份失败：' + error.message);
    }).finally(function () {
      if (button) setBusy(button, false);
    });
  }

  function loadLanStatus() {
    return api('/api/lan').then(function (result) {
      state.lan = result;
      var phoneMode = result.local === false && result.public !== true;
      document.body.classList.toggle('phone-mode', phoneMode);
      var banner = document.getElementById('phone-mode-banner');
      if (banner) banner.hidden = !phoneMode;
      if (phoneMode && (state.tab === 'import' || state.tab === 'settings')) switchTab('home');
      if (els.lanToggle) {
        els.lanToggle.hidden = !result.local || result.public === true;
        els.lanToggle.textContent = result.enabled ? '手机 ✓' : '手机';
        els.lanToggle.classList.toggle('active', Boolean(result.enabled));
      }
      renderLanPanel();
    }).catch(function () {
      if (els.lanToggle) els.lanToggle.hidden = true;
    });
  }

  function loadInsights() {
    return Promise.all([api('/api/weekly'), api('/api/diagnosis')]).then(function (results) {
      renderWeekly(results[0]);
      renderDiagnosis(results[1]);
    }).catch(function (error) {
      var weekly = document.getElementById('insight-weekly');
      var diagnosis = document.getElementById('insight-diagnosis');
      if (weekly) {
        weekly.innerHTML = '<div class="insight-head"><h2>复盘</h2></div><p class="insight-copy">加载失败：' +
          escapeHtml(error.message) + '</p>';
      }
      if (diagnosis) diagnosis.innerHTML = '';
    });
  }

  function loadGrowthWeekly() {
    var host = document.getElementById('passport-weekly');
    if (!host) return;
    api('/api/weekly').then(function (data) {
      var articles = data.articles || {};
      var outputs = data.outputs || {};
      var goals = data.goals || {};
      var activity = (articles.finished || 0) + (outputs.count || 0) + (data.studyDays || 0);
      host.innerHTML = '<div class="passport-block-head"><h2>本周阅读</h2><span>' +
        escapeHtml((data.range && data.range.start) || '') + ' → ' + escapeHtml((data.range && data.range.end) || '') +
        '</span></div>' +
        (activity
          ? '<div class="insight-stats">' + insightStat('精读完成', articles.finished || 0, goals.articles ? ' / ' + goals.articles + ' 篇' : ' 篇') +
            insightStat('读完词数', articles.words || 0, ' 词') +
            insightStat('写作输出', outputs.count || 0, ' 次') +
            insightStat('阅读天数', data.studyDays || 0, goals.studyDays ? ' / ' + goals.studyDays + ' 天' : ' 天') + '</div>' +
            '<div class="insight-block"><h3>下周建议</h3><p>' + escapeHtml(data.suggestion || '') + '</p></div>'
          : '<p class="muted">这一周还没有阅读记录。完成一篇精读，下一次复盘就会出现在这里。</p>') +
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
      state.stats = result.stats || state.stats;
      renderStoreWarnings(result.warnings);
      var steps = result.steps || {};
      var article = steps.article || {};
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
            heroAction + '</a></div>';
      } else if (todayReading && todayReading.finished) {
        hero =
          '<div class="home-eyebrow">今日精读完成</div>' +
          '<h1 class="home-title">' + escapeHtml(todayReading.title) + '</h1>' +
          '<div class="home-meta">已读 ' + todayReading.read + ' / ' + todayReading.total + ' 段' +
            (result.streak ? ' · 连续 ' + result.streak + ' 天' : '') + '</div>' +
          '<div class="home-actions"><a class="btn btn-primary" href="' + escapeHtml(todayReading.url) + '">重读</a>' +
            '<button class="btn" data-go-tab="insights" type="button">看看这周</button></div>';
      } else if (article.suggestion) {
        hero =
          '<div class="home-eyebrow">今天读什么</div>' +
          '<h1 class="home-title">' + escapeHtml(article.suggestion.articleTitle) + '</h1>' +
          '<div class="home-meta">' + escapeHtml(article.suggestion.resourceTitle) + ' · ' +
            article.suggestion.wordCount + ' 词 · 还没有生成学习包</div>' +
          '<div class="home-actions"><a class="btn btn-primary" href="' + escapeHtml(articleHref) + '">去生成这篇</a></div>';
      } else {
        hero =
          '<div class="home-eyebrow">今天读什么</div>' +
          '<h1 class="home-title">还没有待读文章</h1>' +
          '<div class="home-meta">导入一篇英文文章，生成学习包后就可以开始精读。</div>' +
          '<div class="home-actions"><button class="btn btn-primary" data-go-tab="import">导入材料</button></div>';
      }
      els.homeHero.innerHTML = hero;
      var readingStats = reading.stats || {};
      var readingHost = document.getElementById('reading-stats');
      if (readingHost) {
        readingHost.innerHTML =
          '<div class="reading-stat"><b>' + (result.streak || 0) + '</b><span>连续阅读天数</span></div>' +
          '<div class="reading-stat"><b>' + (readingStats.finished || 0) + '</b><span>已读完文章</span></div>' +
          '<div class="reading-stat"><b>' + (readingStats.inProgress || 0) + '</b><span>正在精读</span></div>' +
          '<div class="reading-stat"><b>' + (readingStats.paragraphsRead || 0) + '</b><span>累计精读段落</span></div>';
      }
      els.homeRecent.innerHTML = '<h2>最近精读</h2>' + (recent.length
        ? recent.map(function (card) {
            var note = card.finished
              ? '已完成'
              : (card.started ? (card.read + ' / ' + card.total + ' 段') : '未开始');
            return '<div class="home-recent-row"><a href="' + escapeHtml(readingHref(card, true)) + '">' +
              escapeHtml(card.title) + '</a><span class="mini-progress">' + escapeHtml(note) + '</span></div>';
          }).join('')
        : '<div class="muted">还没有精读记录。生成一篇学习包，开始第一次精读。</div>');
      renderStats();
    }).catch(function (error) {
      els.homeHero.innerHTML = '<div class="home-eyebrow">精读</div><h1 class="home-title">暂时无法加载</h1>' +
        '<div class="home-meta">' + escapeHtml(error.message) + '</div>';
    });
  }

  function updateUrl(push) {
    var params = new URLSearchParams();
    if (state.tab !== 'home') params.set('tab', state.tab);
    var currentLang = new URLSearchParams(location.search).get('lang');
    if (currentLang === 'en' || localStorage.getItem('closeread-lang') === 'en') params.set('lang', 'en');
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

  function loadPacks() {
    if (els.packsList && !els.packsList.innerHTML.trim()) {
      els.packsList.innerHTML = '<div class="empty loading"><span class="spinner"></span>正在加载文章…</div>';
    }
    Promise.all([
      api('/api/packs'),
      api('/api/shared').catch(function () { return { packs: [] }; })
    ]).then(function (results) {
      var result = results[0] || {};
      var sharedPacks = (results[1] && results[1].packs) || [];
      var packs = result.packs || [];
      if (!packs.length && !sharedPacks.length) {
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

      var sharedHtml = sharedPacks.length
        ? '<div class="pack-group pack-group-shared">' +
            '<div class="pack-group-head"><strong>公共库</strong>' +
            '<span>作者发布 · ' + sharedPacks.length + ' 个学习包</span></div>' +
            sharedPacks.map(function (pack) {
              return '<div class="pack-row">' +
                '<div><a href="' + escapeHtml(pack.url) + '">' + escapeHtml(pack.title) + '</a>' +
                '<div class="due">可直接读 · ' + pack.itemCount + ' 项 · 答案已预生成</div></div>' +
                '<div class="pack-actions">' +
                  '<a class="btn btn-primary" href="' + escapeHtml(pack.url) + '">精读</a>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>'
        : '';

      els.packsList.innerHTML = sharedHtml + groups.map(function (group) {
        var rows = group.packs.map(function (pack) {
          var label = pack.articleIndex === null || pack.articleIndex === undefined
            ? '整本'
            : pack.chapter
              ? '第 ' + pack.chapter.index + ' / ' + pack.chapter.total + ' 篇'
              : '文章';
          var rebuild = pack.articleIndex === null || pack.articleIndex === undefined
            ? '<button class="btn" data-build="' + escapeHtml(pack.resourceId) + '">重新生成</button>'
            : '<button class="btn" data-rebuild-resource="' +
              escapeHtml(pack.parentResourceId || pack.resourceId) +
              '" data-rebuild-article="' + pack.articleIndex + '">重新生成</button>';
          return '<div class="pack-row">' +
            '<div><a href="' + escapeHtml(pack.url) + '">' + escapeHtml(pack.title) + '</a>' +
            '<div class="due">' + label + ' · ' + pack.itemCount + ' 项 · ' + escapeHtml((pack.createdAt || '').slice(0, 10)) + '</div></div>' +
            '<div class="pack-actions">' +
              '<a class="btn btn-primary" href="' + escapeHtml(pack.url) + '">精读</a>' +
              rebuild +
              (pack.shared
                ? '<span class="pack-shared-tag">已公开</span>'
                : '<button class="btn" data-publish-pack="' + escapeHtml(pack.id) + '">公开</button>') +
              '<button class="btn danger" data-delete-pack="' + escapeHtml(pack.id) + '">删除</button>' +
            '</div>' +
          '</div>';
        }).join('');
        return '<div class="pack-group"><div class="pack-group-head"><strong>' + escapeHtml(group.title) +
          '</strong><span>' + group.packs.length + ' 个学习包</span></div>' + rows + '</div>';
      }).join('');

      els.packsList.querySelectorAll('[data-publish-pack]').forEach(function (button) {
        button.addEventListener('click', function () {
          if (!confirm('公开后，所有访客都能在「公共库」里读这篇文章（只读副本，不影响你自己的进度）。继续吗？')) return;
          setBusy(button, true, '公开中…');
          api('/api/packs/' + encodeURIComponent(button.getAttribute('data-publish-pack')) + '/publish', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}'
          }).then(function () {
            toast('已加入公共库');
            loadPacks();
          }).catch(function (error) {
            toast('公开失败：' + error.message);
            setBusy(button, false);
          });
        });
      });

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
            toast('已移到回收站' + (deleted.removedItems ? '，移除 ' + deleted.removedItems + ' 个词条' : ''), '撤销', function () {
              api('/api/trash/' + encodeURIComponent(deleted.trashId) + '/restore', { method: 'POST' }).then(function () {
                toast('已恢复');
                loadPacks();
                loadRecentImports();
                refreshStats();
              }).catch(function (error) { toast('恢复失败：' + error.message); });
            });
            state.stats = deleted.summary;
            renderStats();
            loadPacks();
            loadRecentImports();
          }).catch(function (error) {
            toast('删除失败：' + error.message);
          });
        });
      });
    }).catch(function (error) {
      els.packsList.innerHTML = '<div class="empty"><strong>无法加载学习包</strong>' + escapeHtml(error.message) +
        '<button class="btn" type="button" data-retry-packs>重试</button></div>';
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


  function renderUploadProgress(label, percent) {
    var value = Math.max(0, Math.min(100, percent))
    els.importResult.innerHTML = '<div class="result-card working upload-working"><span class="spinner"></span>' +
      '<div class="upload-copy"><strong>' + escapeHtml(label) + '</strong>' +
      '<div class="result-meta">' + (value >= 100 ? '上传完成，正在解析…' : '已上传 ' + value + '%') + '</div>' +
      '<div class="upload-track"><i style="width:' + value + '%"></i></div></div>' +
      '<button class="btn" type="button" data-cancel-upload>取消</button></div>'
  }

  function uploadError(message, retry) {
    els.importResult.innerHTML = '<div class="result-card"><div class="result-title">' + (retry ? '没有完成' : '已取消上传') + '</div>' +
      '<p class="result-preview">' + escapeHtml(message) + '</p>' +
      (retry ? '<div class="result-actions"><button class="btn btn-primary" type="button" data-retry-upload>重试</button></div>' : '') +
      '</div>'
  }

  function runUpload(job) {
    if (state.upload) { toast('已有上传正在进行'); return }
    state.lastUpload = job
    renderUploadProgress(job.label, 0)
    var xhr = new XMLHttpRequest()
    state.upload = { xhr: xhr }
    xhr.open('POST', job.url)
    xhr.upload.onprogress = function (event) {
      if (!event.lengthComputable) return
      renderUploadProgress(job.label, Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = function () {
      state.upload = null
      var data = {}
      try { data = JSON.parse(xhr.responseText) } catch (error) {}
      if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.resource) {
        if (job.input) job.input.value = ''
        if (job.title) job.title.value = ''
        afterImport(data.resource)
        return
      }
      uploadError(data.error || ('上传失败：HTTP ' + xhr.status), true)
    }
    xhr.onerror = function () {
      state.upload = null
      uploadError('网络中断，文件没有上传完成。', true)
    }
    xhr.onabort = function () {
      state.upload = null
      uploadError('已停止上传，文件没有导入。', true)
    }
    xhr.send(job.file)
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
    var doc = resource.document || {};
    var insight = [];
    if (doc.pages) insight.push((doc.extractablePages || doc.pages) + ' / ' + doc.pages + ' 页可读');
    if (doc.twoColumnPages) insight.push(doc.twoColumnPages + ' 页双栏重排');
    if (doc.removedLines) insight.push('清理 ' + doc.removedLines + ' 行页眉页脚');
    if (doc.skippedPages) insight.push('跳过 ' + doc.skippedPages + ' 页目录/参考');
    var insightHtml = insight.length
      ? '<div class="result-insight">' + insight.map(function (item, index) {
        return '<span' + (index === 0 ? ' class="good"' : '') + '>' + escapeHtml(item) + '</span>';
      }).join('') + '</div>'
      : '';
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
      insightHtml +
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
    state.llmConfigured = Boolean(llm);
    els.importMode.innerHTML = llm
      ? '当前使用 <strong>' + escapeHtml(provider || 'LLM') + '</strong> · ' + escapeHtml(model) +
        ' 分析，生成通常需要 1–3 分钟。'
      : '<strong>还没有配置模型 Key。</strong>规则模式只能挑出候选词，不会生成中文译文，选词也不准，基本上没法精读。先在下方「模型设置」里填一个 Key（DeepSeek 最便宜）。';
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

  function setLlmHint(text) {
    var el = document.getElementById('llm-base-hint');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function refreshModels() {
    if (!els.llmRefresh) return;
    setBusy(els.llmRefresh, true, '查询中…');
    if (els.llmRefreshStatus) els.llmRefreshStatus.textContent = '';
    // Send what is in the form so refreshing works before saving the settings.
    api('/api/llm/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: els.llmProvider ? els.llmProvider.value : '',
        apiKey: els.llmApiKey ? els.llmApiKey.value.trim() : '',
        baseUrl: els.llmBaseUrl ? els.llmBaseUrl.value.trim() : ''
      })
    }).then(function (result) {
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
    var statusPreset = llmPreset(status.provider || 'openai');
    setLlmHint(statusPreset ? statusPreset.hint : '');
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
    if (els.recentImports && !els.recentImports.innerHTML.trim()) {
      els.recentImports.innerHTML = '<div class="empty loading"><span class="spinner"></span>正在加载导入记录…</div>';
    }
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
      if (els.recentImports) {
        els.recentImports.innerHTML = '<div class="empty"><strong>无法加载导入记录</strong>' + escapeHtml(error.message) +
          '<button class="btn" type="button" data-retry-recent>重试</button></div>';
      }
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
        (deleted.removedItems ? '、' + deleted.removedItems + ' 个词条' : ''), '撤销', function () {
        api('/api/trash/' + encodeURIComponent(deleted.trashId) + '/restore', { method: 'POST' }).then(function () {
          toast('已恢复');
          loadRecentImports();
          loadPacks();
          refreshStats();
        }).catch(function (error) { toast('恢复失败：' + error.message); });
      });
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
    if (state.llmConfigured === false &&
        !confirm('还没有配置模型 Key。这次的包不会有中文译文，选词也不准，读起来会很吃力。\\n\\n建议先去「模型设置」填写 Key。仍要现在生成吗？')) {
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
    runUpload({
      url: '/api/import/pdf?name=' + encodeURIComponent(file.name) +
        '&title=' + encodeURIComponent(els.pdfTitle.value.trim()),
      file: file,
      label: '正在上传并解析 PDF…',
      input: els.pdfInput,
      title: els.pdfTitle
    });
  });

  els.ebookForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var file = els.ebookInput.files && els.ebookInput.files[0];
    if (!file) { toast('请选择一个 EPUB、MOBI 或 DOCX 文件'); return; }
    runUpload({
      url: '/api/import/ebook?name=' + encodeURIComponent(file.name) +
        '&title=' + encodeURIComponent(els.ebookTitle.value.trim()),
      file: file,
      label: '正在上传并解析文档…',
      input: els.ebookInput,
      title: els.ebookTitle
    });
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('[data-retry-packs]')) {
      event.preventDefault();
      loadPacks();
      return;
    }
    if (target.closest('[data-retry-recent]')) {
      event.preventDefault();
      loadRecentImports();
      return;
    }
    if (target.closest('[data-cancel-upload]')) {
      event.preventDefault();
      if (state.upload) state.upload.xhr.abort();
      return;
    }
    if (target.closest('[data-retry-upload]')) {
      event.preventDefault();
      if (state.lastUpload) runUpload(state.lastUpload);
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
      (!node.ghost && node.degree < 3 ? '<div class="detail-links"><button class="neighbor" data-enrich-item="' + escapeHtml(node.id) + '">补全关系</button></div>' : '') +
      pathSection +
      (node.sourcePack ? '<div class="detail-links"><a class="source-link" href="' + escapeHtml(node.sourcePack.url) + '">打开来源学习包</a></div>' : '');
    els.graphDetail.hidden = false;
  }

  var TAB_META = {
    read: ['READ', '精读'],
    packs: ['READ', '文章'],
    passport: ['PROGRESS', '成长'],
    insights: ['WEEKLY REVIEW', '复盘'],
    import: ['NEW MATERIAL', '导入文章'],
    settings: ['SETTINGS', '设置']
  };
  var TAB_ALIASES = { home: 'read', library: 'read', vocab: 'read', review: 'read', graph: 'read' };
  var TAB_VIEW = {
    read: 'view-home',
    packs: 'view-packs',
    import: 'view-import',
    settings: 'view-settings',
    passport: 'view-passport',
    insights: 'view-insights'
  };

  function normalizeTab(tab) {
    return TAB_ALIASES[tab] || tab;
  }

  function navTabFor(tab) {
    if (tab === 'read' || tab === 'import') return 'read';
    if (tab === 'packs') return 'packs';
    if (tab === 'passport' || tab === 'insights') return 'more';
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
      else more.removeAttribute('open');
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
    if (tab === 'packs') loadPacks();
    if (tab === 'passport') { loadPassport(); loadGrowthWeekly(); }
    if (tab === 'insights') loadInsights();
    if (tab === 'import') loadRecentImports();
    if (tab === 'settings') loadSettings();
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

  var initialParams = new URLSearchParams(location.search);
  var initialTab = normalizeTab(initialParams.get('tab') || 'read');
  var initialShare = initialParams.get('share');
  var initialImport = initialParams.get('import');
  applyGraphSettings();
  state.graphFocus = initialParams.get('word');
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
    switchTab('read');
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
        setLlmHint(preset.hint);
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
  api('/api/session').then(function (s) {
    state.publicMode = Boolean(s && s.public);
    maybeShowBackupReminder();
  }).catch(function () {});
  var passportExport = document.getElementById('backup-download');
  if (passportExport) {
    passportExport.addEventListener('click', function () {
      if (state.publicMode) exportWorkspaceLocal(passportExport);
      else downloadBackup(passportExport);
    });
  }
  loadLanStatus();
  loadCommunityStats();
  window.setInterval(loadCommunityStats, 60000);
  renderOnboarding();

  // Keep the durable copy in this browser in sync with the server's scratch
  // workspace. After a restart the scratch copy is gone and this pushes the
  // browser's copy back up before the first real request.
  localDb().then(function (db) { return db.requestPersistence(); }).catch(function () {});
  syncFromBrowser().then(function (hydrated) {
    if (!hydrated) return;
    switchTab(state.tab || 'read', true);
    loadSettings();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') checkpointNow();
  });
  window.setInterval(function () {
    if (document.visibilityState === 'visible') checkpointNow();
  }, 60000);
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
