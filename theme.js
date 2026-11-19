// Light / dark mode.
// Loaded in <head> so the page never flashes the wrong colours.
// The choice is remembered in this browser, separately from the demo data,
// so "Reset demo data" does not change it. With no choice saved, it follows
// the computer's own light/dark setting.
(function () {
  var KEY = 'neutreeno-theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var buttons = document.querySelectorAll('[data-theme-choice]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-theme-choice') === theme));
    }
  }

  apply(saved() || systemTheme());

  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme'));
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-theme-choice]');
      if (!btn) return;
      var theme = btn.getAttribute('data-theme-choice');
      try { localStorage.setItem(KEY, theme); } catch (e) {}
      apply(theme);
    });
  });

  // Follow the computer's setting live, until a choice has been made here
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!saved()) apply(systemTheme()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
})();
