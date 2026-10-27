// ca-work.js — <ca-work-list> media activation for the Conspire work list and
// client rows. The most-visible row is active while it is in view (at least
// half the row inside the viewport, or the row filling half the viewport),
// on every device; nothing happens on hover. Only ONE row is active at a
// time: its foreground media reveals and its video plays (others pause). The
// backdrop stays visible. Same rule as the proposal pages' work media.

const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function inView(entry) {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= 0.5) return true;
  const root = entry.rootBounds;
  return !!root && entry.intersectionRect.height >= root.height * 0.5;
}

class CaWorkList extends HTMLElement {
  connectedCallback() {
    this.rows = Array.from(this.querySelectorAll('.ca-work__row'));
    if (!this.rows.length || !('IntersectionObserver' in window)) return;

    this.activeRow = null;
    this.ratios = new Map();
    this.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => this.ratios.set(e.target, inView(e) ? e.intersectionRatio : 0));
        // The most-visible qualifying row wins, so a phone never streams more
        // than one video at a time.
        let best = null;
        let bestRatio = 0;
        this.rows.forEach((row) => {
          const r = this.ratios.get(row) || 0;
          if (r > bestRatio) { bestRatio = r; best = row; }
        });
        if (best) this.activate(best);
        else if (this.activeRow) this.deactivate(this.activeRow);
      },
      { threshold: THRESHOLDS }
    );
    this.rows.forEach((row) => this.io.observe(row));
  }

  disconnectedCallback() {
    this.io?.disconnect();
    this.io = null;
    if (this.activeRow) this.deactivate(this.activeRow);
  }

  activate(row) {
    if (!row || this.activeRow === row) return;
    if (this.activeRow) this.deactivate(this.activeRow);
    this.activeRow = row;
    row.classList.add('is-active');
    const video = row.querySelector('.ca-work__video');
    if (!video) return;
    // Reduced motion: reveal the layer but leave the poster frame still.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Chrome stalls play() on videos that were hidden at parse until load()
    // runs once.
    if (video.readyState === 0 && !video.dataset.loaded) {
      video.dataset.loaded = '1';
      video.load();
    }
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  deactivate(row) {
    if (!row) return;
    row.classList.remove('is-active');
    const video = row.querySelector('.ca-work__video');
    if (video) video.pause();
    if (this.activeRow === row) this.activeRow = null;
  }
}

if (!customElements.get('ca-work-list')) {
  customElements.define('ca-work-list', CaWorkList);
}
