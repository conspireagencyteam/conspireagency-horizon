// ca-testimonials.js — <ca-carousel> for the Conspire testimonials section.
// Transform-based on desktop; on narrow/touch viewports (<= 989px) the viewport
// becomes a native scroll-snap scroller so swiping works, and the active index
// is synced from scroll events. Wrapping, keyboard-accessible, optional autoplay.

class CaCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[ref="track"]');
    this.slides = this.track ? Array.from(this.track.children) : [];
    this.dotsEl = this.querySelector('[ref="dots"]');
    this.prevBtn = this.querySelector('[ref="prev"]');
    this.nextBtn = this.querySelector('[ref="next"]');
    if (!this.track || this.slides.length === 0) return;

    this.index = 0;
    this.autoplayMs = parseInt(this.dataset.autoplay || '0', 10);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.viewport = this.querySelector('.ca-testimonials__viewport');
    this.scrollMq = window.matchMedia('(max-width: 989px)');
    this.scrollMode = false;

    this.buildDots();
    this.prevBtn?.addEventListener('click', () => this.go(this.index - 1));
    this.nextBtn?.addEventListener('click', () => this.go(this.index + 1));
    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.index + 1); }
    });

    // Hide controls when there's nothing to page through.
    if (this.slides.length < 2) {
      this.querySelector('.ca-testimonials__foot')?.style.setProperty('display', 'none');
    }

    // Position after layout, without animation, and recompute on resize
    // (the inter-slide gap uses a vw clamp, so offsets change with width).
    requestAnimationFrame(() => this.update(false));
    window.addEventListener('load', () => this.update(false));
    this.onResize = () => this.update(false);
    window.addEventListener('resize', this.onResize);

    this.onMq = () => this.applyMode();
    this.scrollMq.addEventListener?.('change', this.onMq);
    this.applyMode();
    if (this.viewport) {
      this.viewport.addEventListener('scroll', () => this.onScroll(), { passive: true });
      // Pause autoplay while a finger / pointer is down or the user is flicking.
      this.viewport.addEventListener('touchstart', () => this.touching(true), { passive: true });
      this.viewport.addEventListener('touchend', () => this.touching(false), { passive: true });
      this.viewport.addEventListener('touchcancel', () => this.touching(false), { passive: true });
    }

    this.startAutoplay();
    this.addEventListener('mouseenter', () => this.stopAutoplay());
    this.addEventListener('mouseleave', () => this.startAutoplay());
    this.addEventListener('focusin', () => this.stopAutoplay());
    this.addEventListener('focusout', () => this.startAutoplay());
  }

  disconnectedCallback() {
    this.stopAutoplay();
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    if (this.onMq) this.scrollMq?.removeEventListener?.('change', this.onMq);
    clearTimeout(this.settleTimer);
  }

  applyMode() {
    this.scrollMode = this.scrollMq.matches;
    this.classList.toggle('is-scroll', this.scrollMode);
    // Native scroller must be reachable from the keyboard (axe scrollable-region-focusable)
    if (this.viewport) this.viewport.tabIndex = this.scrollMode ? 0 : -1;
    if (!this.scrollMode && this.viewport) this.viewport.scrollLeft = 0;
    this.update(false);
  }

  touching(down) {
    this.isTouching = down;
    if (down) this.stopAutoplay();
    else this.settle();
  }

  // Resume autoplay a beat after the user's swipe/momentum has finished.
  settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.programmatic = false;
      if (!this.isTouching) this.startAutoplay();
    }, 600);
  }

  onScroll() {
    if (!this.scrollMode) return;
    if (!this.programmatic) this.stopAutoplay();
    const left = this.viewport.scrollLeft;
    let best = 0;
    let dist = Infinity;
    this.slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - left);
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== this.index) {
      this.index = best;
      this.syncState();
    }
    this.settle();
  }

  buildDots() {
    if (!this.dotsEl) return;
    this.dots = this.slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ca-testimonials__dot';
      b.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
      b.addEventListener('click', () => this.go(i));
      this.dotsEl.appendChild(b);
      return b;
    });
  }

  go(i) {
    const n = this.slides.length;
    this.index = ((i % n) + n) % n; // wrap around
    this.update(true);
    this.startAutoplay(); // reset timer on manual interaction
  }

  update(animate = true) {
    const active = this.slides[this.index];
    if (this.scrollMode && this.viewport) {
      this.track.style.transform = '';
      this.programmatic = true;
      this.viewport.scrollTo({ left: active ? active.offsetLeft : 0, behavior: animate && !this.reduced ? 'smooth' : 'auto' });
      this.settle();
    } else {
      // Translate by the active slide's offset so the inter-slide gap is respected.
      this.track.style.transform = `translateX(${active ? -active.offsetLeft : 0}px)`;
    }
    this.syncState();
  }

  syncState() {
    this.dots?.forEach((d, i) => {
      const active = i === this.index;
      d.classList.toggle('is-active', active);
      d.setAttribute('aria-current', active ? 'true' : 'false');
    });
    this.slides.forEach((s, i) => s.setAttribute('aria-hidden', i === this.index ? 'false' : 'true'));
  }

  startAutoplay() {
    this.stopAutoplay();
    if (!this.autoplayMs || this.reduced || this.slides.length < 2) return;
    this.timer = setInterval(() => this.go(this.index + 1), this.autoplayMs);
  }

  stopAutoplay() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

if (!customElements.get('ca-carousel')) {
  customElements.define('ca-carousel', CaCarousel);
}
