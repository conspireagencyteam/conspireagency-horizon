/*
 * ca-custom.js
 * Conspire Agency custom scripts for the Horizon theme.
 *
 * Put ALL custom JS here so Shopify's own theme files stay untouched and pull
 * cleanly from upstream. Loaded with `defer`, so the DOM is ready on execution.
 */
(function () {
  'use strict';

  // Expose the header's resting height as --ca-header-height so a dark first
  // section can slide up underneath a transparent header (see .ca-under-header
  // in ca-custom.css). Measured only while the header is not stuck, because the
  // stuck header is shorter.
  var header = document.querySelector('.ca-header');
  if (header) {
    var setHeaderHeight = function () {
      if (header.hasAttribute('data-stuck')) return;
      document.documentElement.style.setProperty('--ca-header-height', header.offsetHeight + 'px');
    };
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight, { passive: true });
    window.addEventListener('load', setHeaderHeight);
  }
})();
