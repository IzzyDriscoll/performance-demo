// Sign-in screen for the hosted demo.
// One shared demo password keeps casual visitors out. It is NOT real security:
// the site has no server, and all its files are public on GitHub.
// Only a scrambled (SHA-256) version of the password is stored here, never the password itself.
// To change the password, ask Claude, or put the new SHA-256 of salt + password in `hash`.
// Loaded in <head> so the app never flashes before the sign-in screen.
(function () {
  window.DEMO_GATE = {
    key: 'neutreeno-demo-signin',
    salt: 'neutreeno-performance-demo:',
    hash: 'd648ed2d8ac0744bdf2e16f2cdb6961ff888bb59351c3901a566be850669a5ac',
  };
  var signedIn = false;
  try { signedIn = localStorage.getItem(window.DEMO_GATE.key) === window.DEMO_GATE.hash; } catch (e) {}
  document.documentElement.classList.toggle('signed-out', !signedIn);
})();
