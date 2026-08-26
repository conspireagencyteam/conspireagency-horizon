// ca-testimonials.js — <ca-carousel> for the Conspire testimonials section.
// Transform-based, wrapping, keyboard-accessible, optional autoplay.

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

    this.startAutoplay();
    this.addEventListener('mouseenter', () => this.stopAutoplay());
    this.addEventListener('mouseleave', () => this.startAutoplay());
    this.addEventListener('focusin', () => this.stopAutoplay());
    this.addEventListener('focusout', () => this.startAutoplay());
  }

  disconnectedCallback() {
    this.stopAutoplay();
    if (this.onResize) window.removeEventListener('resize', this.onResize);
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
    this.update();
    this.startAutoplay(); // reset timer on manual interaction
  }

  update() {
    // Translate by the active slide's offset so the inter-slide gap is respected.
    const active = this.slides[this.index];
    this.track.style.transform = `translateX(${active ? -active.offsetLeft : 0}px)`;
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
