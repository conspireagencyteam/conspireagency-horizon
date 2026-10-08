// ca-work-grid.js — <ca-work-grid>: plays a card's reveal video while the card
// is hovered or focused, and pauses it afterwards. The reveal itself (fade and
// zoom) is pure CSS, so cards without a video need no script at all.
//
// Touch devices (no hover) get an in-view mode instead: a card with a video
// is marked `is-active` (the CSS reveal) and plays while it is at least half
// in view, pauses when it leaves, and at most two play at once. Cards without
// a video are untouched. Reduced motion skips playback entirely, leaving the
// video's poster frame in the reveal.

const MAX_TOUCH_ACTIVE = 2;

class CaWorkGrid extends HTMLElement {
  connectedCallback() {
    this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.cards = Array.from(this.querySelectorAll('.ca-wcard')).filter((card) =>
      card.querySelector('.ca-wcard__video')
    );
    if (!this.cards.length) return;

    this.onModeChange = () => this.applyMode();
    this.finePointer.addEventListener('change', this.onModeChange);
    this.applyMode();
  }

  disconnectedCallback() {
    this.teardown();
    this.finePointer?.removeEventListener('change', this.onModeChange);
  }

  applyMode() {
    const next = this.finePointer.matches ? 'hover' : 'touch';
    if (next === this.mode) return;
    this.teardown();
    this.mode = next;
    if (next === 'hover') this.setupHover();
    else this.setupTouch();
  }

  teardown() {
    this.hoverAbort?.abort();
    this.hoverAbort = null;
    this.io?.disconnect();
    this.io = null;
    (this.active || []).slice().forEach((card) => this.deactivate(card));
    this.active = [];
  }

  play(video) {
    if (this.reducedMotion.matches) return;
    video.dataset.playing = '1';
    // Chrome stalls play() on preload="none" videos that were hidden at
    // parse until load() runs once.
    if (video.readyState === 0 && !video.dataset.loaded) {
      video.dataset.loaded = '1';
      video.load();
    }
    const attempt = video.play();
    if (attempt && attempt.catch) attempt.catch(() => {});
  }

  pause(video) {
    delete video.dataset.playing;
    video.pause();
  }

  // ── Pointer devices: hover / focus ─────────────────────────────────
  setupHover() {
    this.hoverAbort = new AbortController();
    const { signal } = this.hoverAbort;
    this.cards.forEach((card) => {
      const video = card.querySelector('.ca-wcard__video');
      card.addEventListener('pointerenter', () => this.play(video), { signal });
      card.addEventListener('pointerleave', () => this.pause(video), { signal });
      card.addEventListener('focusin', () => this.play(video), { signal });
      card.addEventListener(
        'focusout',
        (event) => {
          if (!card.contains(event.relatedTarget)) this.pause(video);
        },
        { signal }
      );
    });

    // Warm the first screen of reveal videos as the grid approaches; the rest
    // load on hover (see caWarmVideosNear in ca-custom.js, pointer-only).
    const videos = this.cards.slice(0, 4).map((card) => card.querySelector('.ca-wcard__video'));
    if (window.caWarmVideosNear) window.caWarmVideosNear(this, videos, '100%');
  }

  // ── Touch devices: in view ─────────────────────────────────────────
  setupTouch() {
    if (!('IntersectionObserver' in window)) return;
    this.active = [];
    this.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) this.activate(entry.target);
          else this.deactivate(entry.target);
        });
      },
      { threshold: [0, 0.5] }
    );
    this.cards.forEach((card) => this.io.observe(card));
  }

  activate(card) {
    if (this.active.includes(card)) return;
    // Never more than two downloading/playing at once: drop the oldest.
    while (this.active.length >= MAX_TOUCH_ACTIVE) this.deactivate(this.active[0]);
    this.active.push(card);
    card.classList.add('is-active');
    this.play(card.querySelector('.ca-wcard__video'));
  }

  deactivate(card) {
    const i = this.active.indexOf(card);
    if (i === -1) return;
    this.active.splice(i, 1);
    card.classList.remove('is-active');
    this.pause(card.querySelector('.ca-wcard__video'));
  }
}

if (!customElements.get('ca-work-grid')) {
  customElements.define('ca-work-grid', CaWorkGrid);
}
