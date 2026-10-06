// ca-process.js — <ca-process> for the "Conspire Build" step carousel.
//
// One step is active at a time: it is wide with large text, the rest sit beside
// it narrow and muted. Arrows, dots, clicking a step, and left/right keys move
// the active step; the track slides so the active step sits at the left edge.
// Without this script the steps are a plain horizontally scrollable row.

class CaProcess extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.ca-process__track');
    this.steps = Array.from(this.querySelectorAll('.ca-process__step'));
    this.dots = Array.from(this.querySelectorAll('.ca-process__dot'));
    this.prev = this.querySelector('.ca-process__arrow--prev');
    this.next = this.querySelector('.ca-process__arrow--next');
    if (!this.track || this.steps.length === 0) return;

    this.index = 0;
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

    this.resizeObserver = new ResizeObserver(() => this.position(false));
    this.resizeObserver.observe(this);
    this.go(0, false);
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
  }

  go(index, animate = true) {
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

    this.position(animate);
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
