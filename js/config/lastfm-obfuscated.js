/**
 * Optional Last.fm key bootstrap for static hosting.
 *
 * Set your obfuscated fragments below if you want auto-loading in GitHub Pages.
 * Leave as-is to disable.
 *
 * NOTE: This is obfuscation only (not secure secret storage).
 */
(function lastFmKeyBootstrap() {
  const decode = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return atob(text.split('').reverse().join(''));
  };

  const getFragmentA = () => '==wN0QGOzATOyIGO';
  const getFragmentB = () => '=MjY2EGOzUTOhZWN';
  const getFragmentC = () => '=YTO1EGO0cDMwAjY';

  const assembled = `${decode(getFragmentA())}${decode(getFragmentB())}${decode(getFragmentC())}`.trim();
  if (!assembled) return;

  const currentSecrets = window.BooksWithMusicSecrets || {};
  if (!currentSecrets.lastfmApiKey) {
    currentSecrets.lastfmApiKey = assembled;
  }
  window.BooksWithMusicSecrets = currentSecrets;
})();
