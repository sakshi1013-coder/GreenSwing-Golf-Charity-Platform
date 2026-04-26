/**
 * GreenSwing — Global Page Loader (loader.js)
 * Shows a spinner overlay while the page (and auth check) loads.
 * Include this FIRST in every page's <head> or at top of <body>.
 */

(function () {
  'use strict';

  /* ── Inject loader styles inline so they apply before CSS loads ── */
  var style = document.createElement('style');
  style.textContent = [
    '#gs-loader{',
    '  position:fixed;inset:0;',
    '  background:#0b1120;',
    '  display:flex;flex-direction:column;',
    '  align-items:center;justify-content:center;',
    '  z-index:99999;',
    '  transition:opacity 0.4s ease, visibility 0.4s ease;',
    '}',
    '#gs-loader.gs-loader-hidden{opacity:0;visibility:hidden;}',
    '.gs-spinner{',
    '  width:48px;height:48px;',
    '  border:3px solid rgba(16,185,129,0.2);',
    '  border-top-color:#10b981;',
    '  border-radius:50%;',
    '  animation:gs-spin 0.8s linear infinite;',
    '}',
    '.gs-loader-logo{',
    '  margin-top:20px;',
    '  font-family:system-ui,sans-serif;',
    '  font-size:1.1rem;font-weight:700;',
    '  color:#10b981;letter-spacing:0.05em;',
    '}',
    '@keyframes gs-spin{to{transform:rotate(360deg)}}'
  ].join('');
  document.head.appendChild(style);

  /* ── Inject loader HTML ── */
  function injectLoader() {
    if (document.getElementById('gs-loader')) return;
    var el = document.createElement('div');
    el.id = 'gs-loader';
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-label', 'Loading…');
    el.innerHTML =
      '<div class="gs-spinner"></div>' +
      '<div class="gs-loader-logo">⛳ GreenSwing</div>';

    // Insert as first child of body (or html if body not ready)
    if (document.body) {
      document.body.insertBefore(el, document.body.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.insertBefore(el, document.body.firstChild);
      });
    }
  }

  /* ── Hide loader ── */
  function hideLoader() {
    var el = document.getElementById('gs-loader');
    if (!el) return;
    el.classList.add('gs-loader-hidden');
    setTimeout(function () { el.remove(); }, 450);
  }

  injectLoader();

  /* ── Auto-hide once page fully loaded ── */
  window.addEventListener('load', function () {
    hideLoader();
  });

  /* ── Expose so other scripts can call GsLoader.hide() early ── */
  window.GsLoader = { hide: hideLoader };
})();
