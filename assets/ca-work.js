// ca-work.js — <ca-work-list> media activation for the Conspire work list.
// Desktop (wide + hover): the hovered row is active. Mobile (≤749px) or touch:
// the most-visible row is active as you scroll. Only ONE row is active at a time;
// its foreground media reveals, its video plays (others pause). Background stays
// visible. Re-evaluates the mode on resize so it adapts live.

class CaWorkList extends HTMLElement {
  connectedCallback() {
    this.rows = Array.from(this.querySelectorAll('.ca-work__row'));
    if (!this.rows.length) return;

    this.activeRow = null;
    this.mqMobile = window.matchMedia('(max-width: 749px)');
    this.mqHover = window.matchMedia('(hover: hover) and (pointer: fine)');

    this.onModeChange = () => this.applyMode();
    this.mqMobile.addEventListener('change', this.onModeChange);
    this.mqHover.addEventListener('change', this.onModeChange);

    this.applyMode();
  }

  disconnectedCallback() {
    this.teardown();
    this.mqMobile?.removeEventListener('change', this.onModeChange);
    this.mqHover?.removeEventListener('change', this.onModeChange);
  }

  // Observer mode when narrow OR no true hover; otherwise hover mode.
  get useObserver() {
    return this.mqMobile.matches || !this.mqHover.matches;
  }

  applyMode() {
    const next = this.useObserver ? 'observer' : 'hover';
    if (next === this.mode) return;
    this.teardown();
    this.mode = next;
    if (next === 'observer') this.setupObserver();
    else this.setupHover();
  }

  teardown() {
    this.io?.disconnect();
    this.io = null;
    this.hoverAbort?.abort();
    this.hoverAbort = null;
    if (this.activeRow) this.deactivate(this.activeRow);
  }

  activate(row) {
    if (!row || this.activeRow === row) return;
    if (this.activeRow) this.deactivate(this.activeRow);
    this.activeRow = row;
    row.classList.add('is-active');
    const video = row.querySelector('.ca-work__video');
    if (video) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
  }

  deactivate(row) {
    if (!row) return;
    row.classList.remove('is-active');
    const video = row.querySelector('.ca-work__video');
    if (video) video.pause();
    if (this.activeRow === row) this.activeRow = null;
  }

  setupHover() {
    this.hoverAbort = new AbortController();
    const { signal } = this.hoverAbort;
    this.rows.forEach((row) => {
      row.addEventListener('mouseenter', () => this.activate(row), { signal });
      row.addEventListener('mouseleave', () => this.deactivate(row), { signal });
      row.addEventListener('focusin', () => this.activate(row), { signal });
      row.addEventListener('focusout', (e) => {
        if (!row.contains(e.relatedTarget)) this.deactivate(row);
      }, { signal });
    });
  }

  setupObserver() {
    this.ratios = new Map();
    this.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => this.ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
        let best = null;
        let bestRatio = 0.4;
        this.rows.forEach((row) => {
          const r = this.ratios.get(row) || 0;
          if (r > bestRatio) { bestRatio = r; best = row; }
        });
        if (best) this.activate(best);
        else if (this.activeRow) this.deactivate(this.activeRow);
      },
      { threshold: [0, 0.4, 0.6, 0.85] }
    );
    this.rows.forEach((row) => this.io.observe(row));
  }
}

if (!customElements.get('ca-work-list')) {
  customElements.define('ca-work-list', CaWorkList);
}
