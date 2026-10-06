// ca-more-projects.js — <ca-more-projects>: the preview image that follows the
// cursor over the inline list of project names.
//
// Each name may carry one preview <img>. On pointer devices the hovered (or
// keyboard-focused) name's image is shown just above the cursor. Names without
// an image only highlight. Touch devices never see the preview.

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
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll, { capture: true });
  }

  show(item, event) {
    if (!this.finePointer.matches) return;
    this.place(item, event.clientX, event.clientY);
    item.classList.add('is-previewing');
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
  }

  hide(item) {
    item.classList.remove('is-previewing');
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
