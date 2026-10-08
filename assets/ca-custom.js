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

  // Warm hover/menu videos so the first play starts quickly. Videos ship with
  // preload="none"; this switches them to preload="metadata" one at a time,
  // which fetches the container header plus the first chunk (a few hundred KB)
  // and nothing more. It deliberately does NOT play() with preload="auto":
  // Chrome keeps downloading a media element once it has started, so that
  // approach pulled every menu video in full (30-40 MB per page view) and
  // saturated the connection. Only on devices that will actually show hover
  // previews, and never with Save-Data on. Returns true when it ran.
  window.caWarmVideos = function (videos) {
    var list = Array.prototype.slice.call(videos || []);
    if (!list.length) return false;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    if (navigator.connection && navigator.connection.saveData) return false;

    var next = function (i) {
      var video = list[i];
      if (!video) return;
      if (video.dataset.warmed || video.dataset.playing) {
        next(i + 1);
        return;
      }
      video.dataset.warmed = '1';
      var done = false;
      var proceed = function () {
        if (done) return;
        done = true;
        next(i + 1);
      };
      video.addEventListener('loadedmetadata', proceed, { once: true });
      video.addEventListener('error', proceed, { once: true });
      video.preload = 'metadata';
      video.dataset.loaded = '1';
      video.load();
      // Don't let one stalled file block the rest.
      setTimeout(proceed, 4000);
    };
    next(0);
    return true;
  };

  // Warm a set of videos once their container comes within `margin` of the
  // viewport.
  // Waits for the window load event first so the videos queue behind the
  // page's own images rather than competing with them.
  window.caWarmVideosNear = function (container, videos, margin) {
    if (!container || !videos || !videos.length || !('IntersectionObserver' in window)) return;
    var afterLoad = function (fn) {
      if (document.readyState === 'complete') fn();
      else window.addEventListener('load', fn, { once: true });
    };
    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      observer.disconnect();
      afterLoad(function () { window.caWarmVideos(videos); });
    }, { rootMargin: (margin || '150%') + ' 0px' });
    observer.observe(container);
  };
})();
