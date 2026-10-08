// ca-app-scroller.js — <ca-app-scroller> for the app-page card strips
// (Drafts "How it looks" mocks, Wishlist store photos). Same construction as
// the narrow mode of ca-testimonials.js / ca-process.js: on viewports
// <= 989px the grid becomes a native scroll-snap scroller (class .is-scroll)
// with dots + prev/next arrows synced from scroll; on wider viewports the
// grid is left alone and the controls are hidden by CSS.
//
// Markup contract:
//   <ca-app-scroller>
//     <div ref="viewport"><ul ref="track"> <li>…</li> … </ul></div>
//     <div ref="dots"></div> <button ref="prev"> <button ref="next">
//   </ca-app-scroller>

class CaAppScroller extends HTMLElement {
  connectedCallback() {
    this.viewport = this.querySelector('[ref="viewport"]');
    this.track = this.querySelector('[ref="track"]');
    this.slides = this.track ? Array.from(this.track.children) : [];
    this.dotsEl = this.querySelector('[ref="dots"]');
    this.prevBtn = this.querySelector('[ref="prev"]');
    this.nextBtn = this.querySelector('[ref="next"]');
    if (!this.viewport || !this.track || this.slides.length === 0) return;

    this.index = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scrollMq = window.matchMedia('(max-width: 989px)');
    this.label = this.getAttribute('data-item-label') || 'Item';

    this.buildDots();
    this.prevBtn?.addEventListener('click', () => this.go(this.index - 1));
    this.nextBtn?.addEventListener('click', () => this.go(this.index + 1));
    this.addEventListener('keydown', (e) => {
      if (!this.scrollMode) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.index + 1); }
    });

    this.onScroll = () => {
      if (!this.scrollMode) return;
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => this.syncFromScroll());
    };
    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });

    this.applyMode = () => {
      this.scrollMode = this.scrollMq.matches;
      this.classList.toggle('is-scroll', this.scrollMode);
      // Native scroller must be reachable from the keyboard (axe scrollable-region-focusable)
      if (this.viewport) this.viewport.tabIndex = this.scrollMode ? 0 : -1;
      this.update();
    };
    this.scrollMq.addEventListener('change', this.applyMode);
    this.applyMode();
  }

  disconnectedCallback() {
    this.scrollMq?.removeEventListener('change', this.applyMode);
    this.viewport?.removeEventListener('scroll', this.onScroll);
  }

  buildDots() {
    if (!this.dotsEl) return;
    this.dotsEl.innerHTML = '';
    this.dots = this.slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ca-app-scroller__dot';
      b.setAttribute('aria-label', `${this.label} ${i + 1} of ${this.slides.length}`);
      b.addEventListener('click', () => this.go(i));
      this.dotsEl.appendChild(b);
      return b;
    });
  }

  syncFromScroll() {
    const left = this.viewport.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    this.slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - this.track.offsetLeft - left);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best !== this.index) { this.index = best; this.update(); }
  }

  go(i) {
    const n = this.slides.length;
    this.index = Math.max(0, Math.min(n - 1, i));
    const slide = this.slides[this.index];
    this.viewport.scrollTo({
      left: slide.offsetLeft - this.track.offsetLeft,
      behavior: this.reduced ? 'auto' : 'smooth',
    });
    this.update();
  }

  update() {
    this.dots?.forEach((d, i) => d.classList.toggle('is-active', i === this.index));
    if (this.prevBtn) this.prevBtn.disabled = this.index === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.index === this.slides.length - 1;
  }
}

if (!customElements.get('ca-app-scroller')) {
  customElements.define('ca-app-scroller', CaAppScroller);
}
