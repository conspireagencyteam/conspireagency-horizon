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

  // Button hover roll (designer prototype 2026-10-09). Upgrades the arrow
  // buttons (see "Button hover roll" in ca-custom.css) and plays the SAME
  // forward roll on enter, leave and focus, never a reverse transition, and
  // never restarts a roll that is still running. Hover-capable devices only;
  // touch keeps the static chip. The accessible name stays a single
  // visually-hidden string (label + any existing hidden suffix).
  var rollSelector = 'a.button.size-style, a.button-secondary.size-style, a.button-custom.size-style';
  var canRoll = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var upgradeButton = function (btn) {
    if (btn.dataset.caRoll) return;
    var label = '';
    var hidden = '';
    var textNodes = [];
    Array.prototype.forEach.call(btn.childNodes, function (node) {
      if (node.nodeType === 3) {
        label += node.textContent;
        textNodes.push(node);
      } else if (node.nodeType === 1 && node.classList.contains('visually-hidden')) {
        hidden += ' ' + node.textContent;
        textNodes.push(node);
      } else {
        // Unknown child (icon, nested markup): leave this button alone.
        label = null;
      }
    });
    label = label === null ? null : label.replace(/\s+/g, ' ').trim();
    if (!label) return;
    btn.dataset.caRoll = '1';

    textNodes.forEach(function (n) { btn.removeChild(n); });

    var text = document.createElement('span');
    text.className = 'ca-btn__text';
    text.setAttribute('aria-hidden', 'true');
    var t1 = document.createElement('span');
    t1.textContent = label;
    var t2 = t1.cloneNode(true);
    text.appendChild(t1);
    text.appendChild(t2);

    var name = document.createElement('span');
    name.className = 'visually-hidden';
    name.textContent = (label + hidden).replace(/\s+/g, ' ').trim();

    var chip = document.createElement('span');
    chip.className = 'ca-btn__chip';
    chip.setAttribute('aria-hidden', 'true');
    chip.appendChild(document.createElement('span')).className = 'ca-btn__arrow';
    chip.appendChild(document.createElement('span')).className = 'ca-btn__arrow';

    btn.appendChild(text);
    btn.appendChild(name);
    btn.appendChild(chip);
    btn.classList.add('ca-btn--roll');

    var timer = 0;
    var play = function () {
      if (reduceMotion.matches || btn.classList.contains('ca-btn--rolling')) return;
      btn.classList.add('ca-btn--rolling');
      clearTimeout(timer);
      // Longest leg is the arrow (600ms); the fallback timer covers a missed animationend.
      timer = setTimeout(stop, 700);
    };
    var stop = function () {
      clearTimeout(timer);
      btn.classList.remove('ca-btn--rolling');
    };
    chip.lastElementChild.addEventListener('animationend', stop);
    btn.addEventListener('mouseenter', play);
    btn.addEventListener('mouseleave', play);
    btn.addEventListener('focus', play);
  };

  var upgradeButtons = function (root) {
    if (!canRoll) return;
    Array.prototype.forEach.call((root || document).querySelectorAll(rollSelector), upgradeButton);
  };
  upgradeButtons();
  // Sections re-rendered by the theme editor or Horizon's section rendering.
  document.addEventListener('shopify:section:load', function (e) { upgradeButtons(e.target); });
  window.caUpgradeButtons = upgradeButtons;

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
