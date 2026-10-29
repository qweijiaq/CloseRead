export function renderReviewApp(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning Reader</title>
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
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    margin: 0; background: var(--paper);
    color: var(--ink); font-family: 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 34px 20px 70px; }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
  .brand { font-family: ui-serif, Georgia, serif; font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
  .brand span { color: var(--accent); }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stat { border: 1px solid var(--line); background: rgba(255,253,248,.75); border-radius: 999px; padding: 5px 10px; font-size: 12px; color: var(--muted); }
  .stat strong { color: var(--ink); }
  nav { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 24px; }
  nav button { border: 0; background: transparent; padding: 10px 14px; font-size: 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
  nav button.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .view { display: none; }
  .view.active { display: block; }
  .progress { display: flex; justify-content: space-between; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
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
  .home-recent-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .home-recent-row:first-of-type { border-top: 0; }
  .home-recent-row a { color: var(--ink); text-decoration: none; font-weight: 600; }
  .home-recent-row a:hover { color: var(--accent); }
  .home-recent-row .mini-progress { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .home-review-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .home-review-line strong { font-family: ui-serif, Georgia, serif; font-size: 28px; }
  .home-review-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .home-outputs { margin-top: 14px; }
  .output-entry { padding: 9px 0; border-top: 1px solid var(--line); }
  .output-entry:first-of-type { border-top: 0; }
  .output-meta { color: var(--muted); font-size: 11.5px; }
  .output-entry summary { cursor: pointer; color: var(--ink); font-size: 13px; margin-top: 3px; }
  .output-text { margin-top: 7px; padding: 10px 12px; border-radius: 9px; background: var(--accent-soft); color: var(--ink); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
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
  .pack-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 13px; padding: 14px 16px; }
  .pack-row a { color: var(--accent); font-weight: 600; text-decoration: none; }
  .pack-row a:hover { text-decoration: underline; }
  .pack-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .pack-group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 4px 2px; }
  .pack-group-head strong { font-family: ui-serif, Georgia, serif; font-size: 16px; }
  .pack-group-head span { color: var(--muted); font-size: 11.5px; }
  .pack-actions { display: flex; gap: 6px; align-items: center; }
  .pack-actions .btn { padding: 6px 10px; font-size: 12px; }
  .btn.danger { color: var(--rust); }
  .btn.danger[data-confirm="1"] { background: var(--rust-soft); border-color: var(--rust); }
  .header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .header-import { padding: 7px 13px; font-size: 12.5px; }
  .import-mode { color: var(--muted); font-size: 12.5px; margin-bottom: 6px; }
  .import-mode strong { color: var(--ink); }
  .selection-size { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; color: var(--muted); font-size: 12.5px; }
  .selection-size select { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 9px; padding: 7px 10px; font: inherit; font-size: 12.5px; }
  .selection-size small { color: var(--muted); font-size: 11.5px; }
  .audio-toggle { margin-bottom: 14px; }
  .queue-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--accent-soft); color: var(--accent); font-size: 12.5px; }
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
  .import-card input[type="file"] { font-size: 13px; }
  .import-card .btn { align-self: flex-start; }
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
  .article-tools select { border: 1px solid var(--line); background: #fffdf8; border-radius: 9px; padding: 8px 10px; font: inherit; font-size: 12.5px; color: var(--ink); }
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
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">Learning <span>Reader</span></div>
    <div class="header-actions">
      <div class="stats" id="stats"></div>
      <button class="btn btn-primary header-import" data-go-tab="import">+ 导入材料</button>
    </div>
  </header>
  <nav>
    <button class="active" data-tab="home">今日</button>
    <button data-tab="review">复习</button>
    <button data-tab="library">词库</button>
    <button data-tab="packs">学习包</button>
    <button data-tab="graph">词网</button>
    <button data-tab="import">导入</button>
  </nav>

  <section class="view active" id="view-home">
    <div class="home-hero" id="home-hero"></div>
    <div class="today-plan" id="today-plan" hidden></div>
    <div class="home-grid">
      <div class="home-card" id="home-recent"></div>
      <div class="home-card" id="home-review"></div>
    </div>
    <div class="home-card home-outputs" id="home-outputs"></div>
  </section>

  <section class="view" id="view-review">
    <div class="progress"><span id="progress-label">加载中…</span><span id="queue-label"></span><button class="link-button review-sentence-only" id="review-sentence-only" type="button">只复习句子卡</button></div>
    <div class="pack-filter" id="pack-filter" hidden>
      <span id="pack-filter-label"></span>
      <button class="link-button" id="clear-pack" type="button">清除筛选</button>
    </div>
    <div id="review-area"></div>
    <div class="hint">空格显示答案 · 1–4 评分 · S 收藏 · K 标记已掌握</div>
  </section>

  <section class="view" id="view-library">
    <div class="library-filters">
      <button class="active" data-lib-filter="all" type="button">全部</button>
      <button data-lib-filter="word" type="button">单词</button>
      <button data-lib-filter="sentence" type="button">句子卡</button>
    </div>
    <div class="toolbar"><input id="library-search" type="search" placeholder="搜索词、释义或语境…"></div>
    <div class="list" id="library-list"></div>
  </section>

  <section class="view" id="view-packs">
    <div class="list" id="packs-list"></div>
  </section>

  <section class="view" id="view-graph">
    <div class="graph-controls">
      <input id="graph-search" type="search" placeholder="搜索词…">
      <select id="graph-view-mode" autocomplete="off">
        <option value="network">网络</option>
        <option value="tree">词族树</option>
        <option value="clusters">聚类</option>
      </select>
      <select id="graph-labels" autocomplete="off">
        <option value="auto">标签：自动</option>
        <option value="all">全部标签</option>
        <option value="off">隐藏标签</option>
      </select>
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
    <label class="selection-size">
      选词量
      <select id="selection-size">
        <option value="auto">自动（按文章推荐）</option>
        <option value="6">少一点（约 6 个，适合水平较高）</option>
        <option value="10">标准（约 10 个）</option>
        <option value="16">多一点（约 16 个，适合水平较低）</option>
        <option value="22">大量（约 22 个）</option>
      </select>
      <small>水平高可以选少一点，水平低可以选多一点；之后仍可在学习包反馈。</small>
    </label>
    <label class="article-toggle audio-toggle"><input type="checkbox" id="build-audio"> 生成音频（macOS）</label>
    <label class="article-toggle audio-toggle"><input type="checkbox" id="only-new"> 只选生词（已在词库的词不进入本包）</label>
    <div class="queue-banner" id="queue-banner" hidden>
      <span id="queue-banner-text"></span>
      <button class="btn" id="resume-queue" type="button">继续队列</button>
      <button class="btn" id="clear-queue" type="button">清空</button>
    </div>
    <div class="import-grid">
      <form class="import-card wide" id="import-text-form">
        <h2>粘贴文本</h2>
        <p>从网页、Word 或笔记里复制英文正文，粘贴到这里。标题留空时会从首行或 Markdown 标题推断。</p>
        <input id="import-text-title" type="text" placeholder="标题（可选）">
        <textarea id="import-text-body" placeholder="Paste the English article here…"></textarea>
        <button class="btn btn-primary" type="submit">导入文本</button>
      </form>
      <form class="import-card wide" id="import-url-form">
        <h2>网页链接</h2>
        <p>支持普通文章页和直链 PDF；付费墙、登录页和机器人验证页无法抓取。</p>
        <input id="import-url" type="text" inputmode="url" placeholder="https://example.com/article">
        <input id="import-url-title" type="text" placeholder="标题（可选）">
        <button class="btn btn-primary" type="submit">抓取并导入</button>
      </form>
      <form class="import-card" id="import-pdf-form">
        <h2>PDF 文件</h2>
        <p>需要有文字层；扫描件暂不支持，可以改用粘贴文本。</p>
        <input id="import-pdf-title" type="text" placeholder="标题（可选）">
        <input id="import-pdf" type="file" accept="application/pdf,.pdf">
        <button class="btn btn-primary" type="submit">上传并导入</button>
      </form>
      <form class="import-card" id="import-ebook-form">
        <h2>EPUB / MOBI</h2>
        <p>支持 EPUB、MOBI、AZW、AZW3；DRM 加密文件无法解析。</p>
        <input id="import-ebook-title" type="text" placeholder="标题（可选）">
        <input id="import-ebook" type="file" accept=".epub,.mobi,.azw,.azw3,application/epub+zip,application/x-mobipocket-ebook">
        <button class="btn btn-primary" type="submit">上传并导入</button>
      </form>
    </div>
    <div class="import-result" id="import-result"></div>
    <div class="recent">
      <h2>最近导入</h2>
      <div class="list" id="recent-imports"></div>
    </div>
  </section>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var state = {
    queue: [], current: null, revealed: false, tab: 'home', stats: {}, typeFilter: null,
    today: null,
    resources: [], building: null, currentJobId: null, buildFromQueue: false,
    buildQueue: [], selectedArticles: {}, queueStats: null, savedQueue: [],
    articleResource: null, articles: [], articlePacks: [], articleHidden: [],
    graph: null, graphSelected: null, graphQuery: '',
    graphPositions: [], graphNodes: [], graphEdges: [],
    graphZoom: 1, graphPanX: 0, graphPanY: 0, graphHop: 1, graphPathStart: null, graphPath: [],
    packFilter: null, packTitle: '', packDue: 0,
    wordFilter: null, wordFilterLabel: '', wordFilterDue: 0,
    libraryFilter: 'all',
    importResource: null, importArticle: null, importArticlesView: false
  };
  var els = {
    stats: document.getElementById('stats'),
    progress: document.getElementById('progress-label'),
    queueLabel: document.getElementById('queue-label'),
    todayPlan: document.getElementById('today-plan'),
    homeHero: document.getElementById('home-hero'),
    homeRecent: document.getElementById('home-recent'),
    homeReview: document.getElementById('home-review'),
    homeOutputs: document.getElementById('home-outputs'),
    reviewArea: document.getElementById('review-area'),
    libraryList: document.getElementById('library-list'),
    packsList: document.getElementById('packs-list'),
    search: document.getElementById('library-search'),
    toast: document.getElementById('toast'),
    packFilter: document.getElementById('pack-filter'),
    packFilterLabel: document.getElementById('pack-filter-label'),
    clearPack: document.getElementById('clear-pack'),
    importMode: document.getElementById('import-mode'),
    selectionSize: document.getElementById('selection-size'),
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  function renderStats() {
    var s = state.stats || {};
    var today = state.today || {};
    var readingStats = (today.reading && today.reading.stats) || {};
    els.stats.innerHTML =
      '<span class="stat">连续 <strong>' + (today.streak || 0) + '</strong> 天</span>' +
      '<span class="stat">已精读 <strong>' + (readingStats.finished || 0) + '</strong> 篇</span>' +
      '<span class="stat">已读 <strong>' + (readingStats.paragraphsRead || 0) + '</strong> 段</span>' +
      '<span class="stat">句子卡 <strong>' + (readingStats.sentenceCards || 0) + '</strong> 张</span>' +
      '<span class="stat">待复习 <strong>' + (s.due || 0) + '</strong></span>';
  }

  function readingHref(card, continueReading) {
    if (!card || !card.url) return '#';
    if (continueReading && card.started && card.lastParagraph > 0 && !card.finished) {
      return card.url + '#p-' + String(card.lastParagraph + 1).padStart(2, '0');
    }
    return card.url;
  }

  function loadPlan() {
    return api('/api/today').then(function (result) {
      state.today = result;
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
          ? current.read + ' / ' + current.total + ' 段' + (current.started && current.lastParagraph > 0 ? ' · 上次看到第 ' + (current.lastParagraph + 1) + ' 段' : '')
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
        ? '今日复习完成 · ' + (review.dueAtStart || 0) + ' 个'
        : '复习 ' + (review.remaining || 0) + ' 个到期词（可选，约 5 分钟）';
      if (!review.done && review.totalDue > review.dueAtStart) {
        reviewText += '，词库里还有 ' + review.totalDue + ' 个';
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
          (review.totalDue > review.dueAtStart ? ' · 词库共 ' + review.totalDue + ' 个' : '') +
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
            return '<div class="output-entry"><div class="output-meta">' + escapeHtml(entry.date) +
              (entry.articleTitle ? ' · ' + escapeHtml(entry.articleTitle) : '') + '</div>' +
              '<details><summary>' + escapeHtml(preview) + '</summary>' +
                '<div class="output-text">' + escapeHtml(entry.text) + '</div>' +
                (entry.answer ? '<details><summary>参考回答</summary><div class="output-text">' +
                  escapeHtml(entry.answer) + '</div></details>' : '') +
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
    els.progress.textContent = '剩余 ' + state.queue.length + ' 个到期项';
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
    els.progress.textContent = '剩余 ' + state.queue.length + ' 个到期项';
    els.queueLabel.textContent = '来源：' + item.sourceRef;

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
      ? '<span class="word-masked">______</span><span class="word-full">' + escapeHtml(item.lemma) + '</span>'
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
            '<div class="word">' + wordHtml +
              (item.ipa ? '<span class="ipa">' + escapeHtml(item.ipa) + '</span>' : '') +
              '<button class="btn speak-btn" id="speak" type="button">发音</button></div>' +
            '<div class="badges">' +
              (item.pos ? '<span class="badge badge-pos">' + escapeHtml(item.pos) + '</span>' : '') +
              (item.cefr ? '<span class="badge badge-cefr">' + escapeHtml(item.cefr) + '</span>' : '') +
              '<span class="badge">' + escapeHtml(item.state) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="star ' + (item.favorite ? 'active' : '') + '" id="star">★</button>' +
        '</div>' +
        '<div class="context">' + contextHtml +
          (item.translation ? '<span class="translation">' + escapeHtml(item.translation) + '</span>' : '') +
        '</div>' +
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
      nextItem();
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

  function updateUrl() {
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
    history.replaceState(null, '', query ? '/?' + query : '/');
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
    var remaining = state.today && state.today.steps ? state.today.steps.review.remaining : 10;
    var queueLimit = state.today ? (remaining > 0 ? remaining : 10) : 10;
    params.set('limit', state.packFilter || state.wordFilter || state.typeFilter ? '200' : String(queueLimit));
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

  function applyLibraryFilter() {
    var query = els.search.value.trim().toLowerCase();
    els.libraryList.querySelectorAll('.row, .sentence-row').forEach(function (row) {
      var type = row.getAttribute('data-type') || 'word';
      var typeOk = state.libraryFilter === 'all' || type === state.libraryFilter;
      var haystack = row.getAttribute('data-search') || '';
      row.style.display = typeOk && (!query || haystack.indexOf(query) !== -1) ? '' : 'none';
    });
  }

  function loadLibrary() {
    api('/api/items').then(function (result) {
      var items = result.items || [];
      if (!items.length) {
        els.libraryList.innerHTML = '<div class="empty"><strong>词库还是空的</strong>先用一份 PDF 或文章生成学习包。</div>';
        return;
      }
      els.libraryList.innerHTML = items.map(function (item) {
        if (item.type === 'sentence') {
          var sentence = item.sentence || {};
          var original = sentence.original || item.definition || item.lemma;
          var translation = sentence.translation || item.sense;
          var search = (item.lemma + ' ' + original + ' ' + translation + ' ' + (item.definitionZh || '')).toLowerCase();
          var chunks = (sentence.chunks || []).map(function (chunk) {
            return '<div class="detail-chunk"><b>' + escapeHtml(chunk.role) + '</b>' + escapeHtml(chunk.text) +
              (chunk.meaning ? '<span>' + escapeHtml(chunk.meaning) + '</span>' : '') + '</div>';
          }).join('');
          var variants = (sentence.variants || []).map(function (variant) {
            return '<div class="detail-line">· ' + escapeHtml(variant) + '</div>';
          }).join('');
          return '<div class="sentence-row" data-type="sentence" data-search="' + escapeHtml(search) + '">' +
            '<div class="sentence-top">' +
              '<div class="sentence-main">' +
                '<div class="sentence-meta"><span class="badge">句子卡</span>' + (sentence.stale ? '<span class="badge stale">原文已变更</span>' : '') + '<span class="due">' + escapeHtml(item.dueLabel) + '</span></div>' +
                '<div class="sentence-original">' + escapeHtml(original) + '</div>' +
                '<div class="sentence-zh">' + escapeHtml(translation) + '</div>' +
              '</div>' +
              '<div class="sentence-actions">' +
                '<button class="link-button" data-sentence-toggle="' + escapeHtml(item.id) + '" type="button">详情</button>' +
                (item.sourcePack ? '<a class="source-link" href="' + escapeHtml(item.sourcePack.url) + '" title="打开来源学习包">↗</a>' : '') +
                '<button class="rowstar ' + (item.favorite ? 'active' : '') + '" data-id="' + escapeHtml(item.id) + '">★</button>' +
              '</div>' +
            '</div>' +
            '<div class="sentence-detail" id="sentence-detail-' + escapeHtml(item.id) + '" hidden>' +
              (chunks ? '<div>' + chunks + '</div>' : '') +
              (sentence.pattern ? '<div class="detail-line"><b>句型</b>' + escapeHtml(sentence.pattern) + '</div>' : '') +
              (sentence.grammar ? '<div class="detail-line"><b>语法</b>' + escapeHtml(sentence.grammar) + '</div>' : '') +
              (variants ? '<div><div class="detail-line"><b>替换</b></div>' + variants + '</div>' : '') +
              (sentence.why ? '<div class="detail-line"><b>为什么</b>' + escapeHtml(sentence.why) + '</div>' : '') +
              '<div class="sentence-detail-actions">' +
                '<a class="link-button" href="/?tab=review&words=' + encodeURIComponent(item.id) + '&label=' + encodeURIComponent('句子卡') + '">复习这张</a>' +
                (item.sourcePack ? '<a class="link-button" href="' + escapeHtml(item.sourcePack.url) + '">打开来源</a>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
        }
        var type = 'word';
        return '<div class="row" data-type="' + type + '" data-search="' + escapeHtml((item.lemma + ' ' + item.sense + ' ' + (item.definitionZh || '')).toLowerCase()) + '">' +
          '<span class="lemma">' + escapeHtml(item.lemma) + '</span>' +
          '<span class="sense">' + escapeHtml(item.sense) + '</span>' +
          '<span class="due">' + escapeHtml(item.dueLabel) + '</span>' +
          (item.sourcePack ? '<a class="source-link" href="' + escapeHtml(item.sourcePack.url) + '" title="打开来源学习包">↗</a>' : '') +
          '<button class="rowstar ' + (item.favorite ? 'active' : '') + '" data-id="' + escapeHtml(item.id) + '">★</button>' +
        '</div>';
      }).join('');
      applyLibraryFilter();
      els.libraryList.querySelectorAll('[data-sentence-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
          var id = button.getAttribute('data-sentence-toggle');
          var detail = document.getElementById('sentence-detail-' + id);
          if (!detail) return;
          detail.hidden = !detail.hidden;
          button.textContent = detail.hidden ? '详情' : '收起';
        });
      });
      els.libraryList.querySelectorAll('.rowstar').forEach(function (button) {
        button.addEventListener('click', function () {
          var id = button.getAttribute('data-id');
          var next = !button.classList.contains('active');
          api('/api/favorite', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ itemId: id, favorite: next })
          }).then(function (result) {
            button.classList.toggle('active', next);
            state.stats = result.summary;
            renderStats();
          });
        });
      });
    });
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
          var label = pack.articleIndex === null || pack.articleIndex === undefined ? '整本' : '文章';
          var rebuild = pack.articleIndex === null || pack.articleIndex === undefined
            ? ''
            : '<button class="btn" data-rebuild-resource="' +
              escapeHtml(pack.parentResourceId || pack.resourceId) +
              '" data-rebuild-article="' + pack.articleIndex + '">重生成</button>';
          return '<div class="pack-row">' +
            '<div><a href="/pack/' + encodeURIComponent(pack.id) + '/index.html">' + escapeHtml(pack.title) + '</a>' +
            '<div class="due">' + label + ' · ' + pack.itemCount + ' 项 · 到期 ' + pack.due +
              ' · 已掌握 ' + pack.mastered + ' · ' + escapeHtml((pack.createdAt || '').slice(0, 10)) + '</div></div>' +
            '<div class="pack-actions">' +
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
            toast('已删除学习包' + (deleted.removedItems ? '和 ' + deleted.removedItems + ' 个词条' : ''));
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

    var toolbar = '<div class="article-tools">' +
      '<input class="article-search" id="article-search" type="search" placeholder="筛选文章标题…">' +
      (sections.length
        ? '<select id="article-section"><option value="">全部栏目</option>' +
          sections.map(function (section) {
            return '<option value="' + escapeHtml(section) + '">' + escapeHtml(section) + '</option>';
          }).join('') + '</select>'
        : '') +
      '<select id="article-sort">' +
        '<option value="default">默认顺序</option>' +
        '<option value="short">短到长</option>' +
        '<option value="long">长到短</option>' +
      '</select>' +
      '<select id="article-status">' +
        '<option value="">全部状态</option>' +
        '<option value="new">未生成</option>' +
        '<option value="done">已生成</option>' +
      '</select>' +
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
    updateUrl();
    api('/api/resources/' + encodeURIComponent(resourceId) + '/articles').then(function (result) {
      renderArticleList(result);
    }).catch(function (error) {
      renderImportError(error.message);
    });
  }

  function renderImportMode(llm, model) {
    els.importMode.innerHTML = llm
      ? '当前使用 <strong>LLM</strong>（' + escapeHtml(model) + '）分析，生成通常需要 1–3 分钟。'
      : '未配置 LLM，将使用<strong>启发式模式</strong>：速度快，但义项判断和中文释义会弱一些。';
  }

  function loadRecentImports() {
    api('/api/resources?limit=8').then(function (result) {
      state.resources = result.resources || [];
      renderImportMode(result.llm, result.model);
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
    toast('已导入：' + resource.title);
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
      toast('已删除材料' + (deleted.removedPacks ? '、' + deleted.removedPacks + ' 个学习包' : '') +
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
        onlyNew: Boolean(els.onlyNew && els.onlyNew.checked)
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

  els.textForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.building) { toast('正在生成学习包，请稍候'); return; }
    var text = els.textBody.value;
    if (!text.trim()) { toast('请先粘贴文本'); els.textBody.focus(); return; }
    renderWorking('正在导入文本…');
    api('/api/import/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text, title: els.textTitle.value.trim() })
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
      body: JSON.stringify({ url: value, title: els.urlTitle.value.trim() })
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
    if (!file) { toast('请选择一个 EPUB 或 MOBI 文件'); return; }
    renderWorking('正在上传并解析电子书…');
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
    api('/api/graph?threshold=' + encodeURIComponent(String(threshold)) + '&negative=' + negative +
      '&ghosts=' + ghosts + '&context=' + context).then(function (result) {
      state.graph = result;
      state.graphSelected = null;
      state.graphPathStart = null;
      state.graphPath = [];
      els.graphDetail.hidden = true;
      renderGraph();
    }).catch(function (error) {
      els.graph.innerHTML = '';
      els.graphMeta.textContent = '无法加载词网：' + error.message;
    });
    saveGraphSettings();
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
      var labelThreshold = nodes.length <= 30 ? 1 : nodes.length <= 80 ? 3 : 4;
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

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('nav button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tab') === tab);
    });
    document.getElementById('view-home').classList.toggle('active', tab === 'home');
    document.getElementById('view-review').classList.toggle('active', tab === 'review');
    document.getElementById('view-library').classList.toggle('active', tab === 'library');
    document.getElementById('view-packs').classList.toggle('active', tab === 'packs');
    document.getElementById('view-graph').classList.toggle('active', tab === 'graph');
    document.getElementById('view-import').classList.toggle('active', tab === 'import');
    updateUrl();
    if (tab === 'home') loadPlan();
    if (tab === 'library') loadLibrary();
    if (tab === 'packs') loadPacks();
    if (tab === 'graph') loadGraph();
    if (tab === 'import') loadRecentImports();
    if (tab === 'review' && !state.current && state.queue.length === 0) loadQueue();
  }

  document.querySelectorAll('nav button').forEach(function (button) {
    button.addEventListener('click', function () { switchTab(button.getAttribute('data-tab')); });
  });
  els.clearPack.addEventListener('click', clearPackFilter);
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

  els.search.addEventListener('input', applyLibraryFilter);
  document.querySelectorAll('[data-lib-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.libraryFilter = button.getAttribute('data-lib-filter') || 'all';
      document.querySelectorAll('[data-lib-filter]').forEach(function (entry) {
        entry.classList.toggle('active', entry === button);
      });
      applyLibraryFilter();
    });
  });

  document.addEventListener('keydown', function (event) {
    if (state.tab !== 'review') return;
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); reveal(); return; }
    if (event.key === 's' || event.key === 'S') { event.preventDefault(); toggleFavorite(); return; }
    if (event.key === 'k' || event.key === 'K') { event.preventDefault(); setStatus('known'); return; }
    if (state.revealed && ['1', '2', '3', '4'].indexOf(event.key) !== -1) {
      event.preventDefault();
      rate(Number(event.key));
    }
  });

  var initialParams = new URLSearchParams(location.search);
  var initialTab = initialParams.get('tab');
  applyGraphSettings();
  state.packFilter = initialParams.get('pack');
  state.wordFilter = initialParams.get('words');
  state.wordFilterLabel = initialParams.get('label') || '自定义词组';
  state.importResource = initialParams.get('resource');
  state.importArticlesView = initialParams.get('articles') === '1';
  var articleParam = initialParams.get('article');
  var initialArticle = articleParam === null ? NaN : Number(articleParam);
  state.importArticle = Number.isFinite(initialArticle) ? initialArticle : null;
  if (initialTab === 'home' || initialTab === 'library' || initialTab === 'packs' || initialTab === 'graph' || initialTab === 'import' || initialTab === 'review') {
    state.tab = initialTab;
  }
  if (state.tab === 'home') {
    loadPlan();
  } else if (state.tab === 'review') {
    loadPlan().then(function () { switchTab('review'); });
  } else {
    switchTab(state.tab);
    loadPlan();
    if (state.tab === 'import' && state.importArticlesView && state.importResource) {
      openArticleList(state.importResource, state.importArticle);
    }
  }
  if (els.selectionSize) {
    try {
      var savedSize = localStorage.getItem('learn-selection-size');
      if (savedSize && [...els.selectionSize.options].some(function (option) { return option.value === savedSize; })) {
        els.selectionSize.value = savedSize;
      }
    } catch (error) {}
    els.selectionSize.addEventListener('change', function () {
      try {
        localStorage.setItem('learn-selection-size', els.selectionSize.value);
      } catch (error) {}
    });
  }
  loadQueueBanner();
})();
</script>
</body>
</html>`
}
