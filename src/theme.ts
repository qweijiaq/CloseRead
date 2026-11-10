/**
 * Apply the stored theme before the first paint. The interactive pages also
 * expose a toggle; this tiny head script only prevents a light flash on a dark
 * screen. Export output deliberately omits it and stays light.
 */
export function themeBootScript(): string {
  return `<script>
(function () {
  try {
    var choice = localStorage.getItem('closeread-theme') || 'auto';
    var dark = choice === 'dark' || (choice === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-theme-choice', choice);
  } catch (error) {}
})();
</script>`
}
