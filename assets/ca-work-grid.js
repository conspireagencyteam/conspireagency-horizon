// ca-work-grid.js — <ca-work-grid>: a card's site preview (the reveal window)
// fades up and its video plays while the card is in view, on every device.
// Nothing happens on hover. "In view" is at least half of the card inside the
// viewport, or the card filling at least half of the viewport (a tall card on
// a short screen), the same rule the proposal pages use for their work media.
//
// A card marked `is-active` zooms its backdrop and shows its reveal (CSS in
// ca-work-grid.liquid). At most two videos play at once: the cards that came
// into view most recently play, older ones hold their frame with the reveal
// still showing. Reduced motion, iOS Low Power Mode or a rejected play() leave
// the poster frame in the reveal. Cards without a reveal are untouched.

const MAX_PLAYING = 2;
const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function inView(entry) {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= 0.5) return true;
  const root = entry.rootBounds;
  return !!root && entry.intersectionRect.height >= root.height * 0.5;
}

class CaWorkGrid extends HTMLElement {
  connectedCallback() {
    if (!('IntersectionObserver' in window)) return;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.cards = Array.from(this.querySelectorAll('.ca-wcard')).filter((card) =>
      card.querySelector('.ca-wcard__reveal')
    );
    if (!this.cards.length) return;

    this.playing = [];
    this.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (inView(entry)) this.activate(entry.target);
          else this.deactivate(entry.target);
        });
      },
      { threshold: THRESHOLDS }
    );
    this.cards.forEach((card) => this.io.observe(card));

    // Warm the first screen of reveal videos (metadata only) as the grid
    // approaches, so the first card plays the moment it is in view; the rest
    // load when they activate. caWarmVideosNear (ca-custom.js) is pointer-only.
    const videos = this.cards
      .map((card) => card.querySelector('.ca-wcard__video'))
      .filter(Boolean)
      .slice(0, 4);
    if (videos.length && window.caWarmVideosNear) window.caWarmVideosNear(this, videos, '100%');
  }

  disconnectedCallback() {
    this.io?.disconnect();
    this.io = null;
    (this.playing || []).slice().forEach((card) => this.pause(card));
  }

  activate(card) {
    card.classList.add('is-active');
    const video = card.querySelector('.ca-wcard__video');
    if (!video || this.playing.includes(card)) return;
    // Never more than two downloading/playing at once: hold the oldest.
    while (this.playing.length >= MAX_PLAYING) this.pause(this.playing[0]);
    this.playing.push(card);
    this.play(video);
  }

  deactivate(card) {
    card.classList.remove('is-active');
    this.pause(card);
  }

  play(video) {
    if (this.reducedMotion.matches) return;
    // The playing flag keeps caWarmVideos (ca-custom.js) off this video: its
    // warm-up load() runs after the window load event and would reset a card
    // that was in view, and already playing, when the page opened.
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

  pause(card) {
    const i = this.playing.indexOf(card);
    if (i !== -1) this.playing.splice(i, 1);
    const video = card.querySelector('.ca-wcard__video');
    if (!video) return;
    delete video.dataset.playing;
    video.pause();
  }
}

if (!customElements.get('ca-work-grid')) {
  customElements.define('ca-work-grid', CaWorkGrid);
}
