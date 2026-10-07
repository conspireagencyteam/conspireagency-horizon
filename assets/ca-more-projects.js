// ca-more-projects.js — <ca-more-projects>: the preview image that follows the
// cursor over the inline list of project names.
//
// Each name may carry one preview <img> or <video>. On pointer devices the
// hovered (or keyboard-focused) name's preview is shown just above the cursor
// (a video plays while shown). Names without a preview only highlight. Touch
// devices never see the preview.

class CaMoreProjects extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.ca-more__item'));
    this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.frame = null;

    this.items.forEach((item) => {
      item.addEventListener('pointerenter', (event) => this.show(item, event));
      item.addEventListener('pointermove', (event) => this.move(item, event));
      item.addEventListener('pointerleave', () => this.hide(item));
      item.addEventListener('focus', () => this.showAtElement(item));
      item.addEventListener('blur', () => this.hide(item));
    });

    // The cursor does not report leaving a name when the page scrolls under it.
    this.onScroll = () => this.items.forEach((item) => this.hide(item));
    window.addEventListener('scroll', this.onScroll, { passive: true, capture: true });

    this.warmVideos();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll, { capture: true });
    this.observer?.disconnect();
  }

  // Videos ship with preload="none". Once the list is within ~1.5 screens of
  // the viewport on a device that will actually show previews, warm them one
  // at a time so the first hover plays instantly without the page pulling
  // every file at once on load. A muted play() that is paused again as soon
  // as the video can play through is the kick: unlike preload="auto" alone,
  // Chrome honours it even for a hidden element, and it buffers the opening
  // seconds (they are hidden, so nothing is visible meanwhile).
  warmVideos() {
    const videos = Array.from(this.querySelectorAll('video.ca-more__preview'));
    if (!videos.length || !this.finePointer.matches || !('IntersectionObserver' in window)) return;
    if (navigator.connection?.saveData) return;

    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      this.observer.disconnect();
      const next = (i) => {
        const video = videos[i];
        if (!video) return;
        let done = false;
        const proceed = () => {
          if (done) return;
          done = true;
          // Leave it parked at the start unless a hover is already showing it.
          if (!video.closest('.ca-more__item')?.classList.contains('is-previewing')) {
            video.pause();
            try { video.currentTime = 0; } catch (e) { /* not seekable yet */ }
          }
          next(i + 1);
        };
        video.addEventListener('canplaythrough', proceed, { once: true });
        video.addEventListener('error', proceed, { once: true });
        video.preload = 'auto';
        video.dataset.loaded = '1';
        video.load();
        video.play().catch(() => {});
        // Don't let one stalled file block the rest.
        setTimeout(proceed, 4000);
      };
      next(0);
    }, { rootMargin: '150% 0px' });
    this.observer.observe(this);
  }

  show(item, event) {
    if (!this.finePointer.matches) return;
    this.place(item, event.clientX, event.clientY);
    item.classList.add('is-previewing');
    this.play(item);
  }

  move(item, event) {
    if (!this.finePointer.matches) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.place(item, clientX, clientY));
  }

  showAtElement(item) {
    if (!this.finePointer.matches) return;
    const rect = item.getBoundingClientRect();
    this.place(item, rect.left + rect.width / 2, rect.top);
    item.classList.add('is-previewing');
    this.play(item);
  }

  hide(item) {
    item.classList.remove('is-previewing');
    item.querySelector('video.ca-more__preview')?.pause();
  }

  play(item) {
    const video = item.querySelector('video.ca-more__preview');
    if (!video) return;
    // Chrome stalls play() on preload="none" videos that were hidden at parse
    // until load() runs once.
    if (video.readyState === 0 && !video.dataset.loaded) {
      video.dataset.loaded = '1';
      video.load();
    }
    video.play().catch(() => {});
  }

  place(item, x, y) {
    const preview = item.querySelector('.ca-more__preview');
    if (!preview) return;
    // Keep the image inside the viewport horizontally.
    const half = preview.offsetWidth / 2;
    const clampedX = Math.max(half + 8, Math.min(window.innerWidth - half - 8, x));
    preview.style.setProperty('--ca-more-x', `${clampedX}px`);
    preview.style.setProperty('--ca-more-y', `${y}px`);
  }
}

if (!customElements.get('ca-more-projects')) {
  customElements.define('ca-more-projects', CaMoreProjects);
}
