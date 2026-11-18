(function () {
  var key = 'launchpad-docs-theme';
  var root = document.documentElement;
  var button = document.querySelector('[data-docs-theme]');
  if (!button) return;

  function current() {
    var stored = root.dataset.theme;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  button.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(key, next); } catch (error) { /* private mode */ }
    button.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  });
})();
