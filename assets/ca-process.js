// ca-process.js — <ca-process> for the "Conspire Build" step carousel.
//
// One step is active at a time: it is wide with large text, the rest sit beside
// it narrow and muted. Arrows, dots, clicking a step, and left/right keys move
// the active step; the track slides so the active step sits at the left edge.
// Without this script the steps are a plain horizontally scrollable row.
//
// On narrow/touch viewports (<= 989px) the viewport is a native scroll-snap
// scroller instead (class .is-scroll): swiping scrolls natively and the active
// step is synced from scroll events. No transform, no preventDefault on touch.
// Mouse drag-to-scroll is NOT needed there; desktop keeps the transform slide.

class CaProcess extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.ca-process__track');
    this.steps = Array.from(this.querySelectorAll('.ca-process__step'));
    this.dots = Array.from(this.querySelectorAll('.ca-process__dot'));
    this.prev = this.querySelector('.ca-process__arrow--prev');
    this.next = this.querySelector('.ca-process__arrow--next');
    if (!this.track || this.steps.length === 0) return;

    this.index = 0;
    this.viewport = this.querySelector('.ca-process__viewport');
    this.scrollMq = window.matchMedia('(max-width: 989px)');
    this.classList.add('is-enhanced');

    this.prev?.addEventListener('click', () => this.go(this.index - 1));
    this.next?.addEventListener('click', () => this.go(this.index + 1));
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.go(i)));
    this.steps.forEach((step, i) => {
      step.addEventListener('click', () => this.go(i));
    });
    this.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') this.go(this.index + 1);
      if (event.key === 'ArrowLeft') this.go(this.index - 1);
    });

    this.onMq = () => this.applyMode();
    this.scrollMq.addEventListener?.('change', this.onMq);
    this.viewport?.addEventListener('scroll', () => this.onScroll(), { passive: true });

    this.resizeObserver = new ResizeObserver(() => this.position(false));
    this.resizeObserver.observe(this);
    this.applyMode();
    this.go(0, false);
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.scrollMq?.removeEventListener?.('change', this.onMq);
    clearTimeout(this.settleTimer);
  }

  applyMode() {
    this.scrollMode = this.scrollMq.matches;
    this.classList.toggle('is-scroll', this.scrollMode);
    // Native scroller must be reachable from the keyboard (axe scrollable-region-focusable)
    if (this.viewport) this.viewport.tabIndex = this.scrollMode ? 0 : -1;
    if (!this.scrollMode && this.viewport) this.viewport.scrollLeft = 0;
    this.position(false);
  }

  // Scroll mode: derive the active step from the scroll position.
  onScroll() {
    if (!this.scrollMode || this.programmatic) return;
    const vp = this.viewport;
    const left = vp.scrollLeft;
    let best = 0;
    if (left >= vp.scrollWidth - vp.clientWidth - 2) {
      best = this.steps.length - 1;
    } else {
      let dist = Infinity;
      const origin = this.steps[0].offsetLeft;
      this.steps.forEach((s, i) => {
        const d = Math.abs(s.offsetLeft - origin - left);
        if (d < dist) { dist = d; best = i; }
      });
    }
    if (best !== this.index) this.go(best, true, false);
  }

  go(index, animate = true, scroll = true) {
    const last = this.steps.length - 1;
    this.index = Math.max(0, Math.min(last, index));

    this.steps.forEach((step, i) => {
      const active = i === this.index;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-current', active ? 'step' : 'false');
    });
    this.dots.forEach((dot, i) => {
      const active = i === this.index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (this.prev) this.prev.disabled = this.index === 0;
    if (this.next) this.next.disabled = this.index === last;

    if (scroll) this.position(animate);
  }

  // Resolved px width of an idle step (--ca-process-idle), read from a hidden probe
  // so it is right even while the steps themselves are mid-transition.
  idleWidth() {
    if (!this.probe) {
      this.probe = document.createElement('span');
      this.probe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;height:0;width:var(--ca-process-idle)';
      this.appendChild(this.probe);
    }
    return this.probe.offsetWidth;
  }

  // Step widths are fixed (set in CSS), so the offset can be computed without
  // waiting for the width transition to finish.
  position(animate) {
    if (this.scrollMode) {
      this.track.style.transform = '';
      this.track.style.transition = '';
      const target = this.steps[this.index];
      const left = target ? target.offsetLeft - this.steps[0].offsetLeft : 0;
      this.programmatic = true;
      this.viewport.scrollTo({ left, behavior: animate ? 'smooth' : 'auto' });
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => { this.programmatic = false; }, animate ? 700 : 50);
      return;
    }
    const styles = getComputedStyle(this);
    const gap = parseFloat(styles.getPropertyValue('--ca-process-gap')) || 20;
    const offset = this.index * (this.idleWidth() + gap);

    this.track.style.transition = animate ? '' : 'none';
    this.track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    if (!animate) {
      // Flush, then restore the transition for later moves.
      void this.track.offsetWidth;
      this.track.style.transition = '';
    }
  }
}

if (!customElements.get('ca-process')) {
  customElements.define('ca-process', CaProcess);
}
