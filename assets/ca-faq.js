// ca-faq.js — <ca-faq> for the Conspire FAQ section.
//
// Progressive enhancement over a working no-JS baseline:
//   (a) category buttons switch which panel is visible (inactive panels hidden),
//   (b) single-open accordion within a panel — opening one <details> closes its
//       siblings.
// Without this script every panel is visible and every <details> is independently
// toggleable, so the section stays fully usable.

class CaFaq extends HTMLElement {
  connectedCallback() {
    this.buttons = Array.from(this.querySelectorAll('.ca-faq__cat'));
    this.panels = Array.from(this.querySelectorAll('.ca-faq__panel'));

    // Category switching.
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.activate(btn.dataset.panel));
    });

    // Single-open accordion. Delegated per panel so only siblings close.
    this.panels.forEach((panel) => {
      const items = Array.from(panel.querySelectorAll('.ca-faq__item'));
      items.forEach((item) => {
        item.addEventListener('toggle', () => {
          if (!item.open) return;
          items.forEach((other) => {
            if (other !== item) other.open = false;
          });
        });
      });
    });
  }

  activate(index) {
    this.buttons.forEach((btn) => {
      const isActive = btn.dataset.panel === index;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    this.panels.forEach((panel) => {
      const isActive = panel.dataset.panel === index;
      panel.classList.toggle('is-hidden', !isActive);
      panel.hidden = !isActive;
    });
  }
}

if (!customElements.get('ca-faq')) {
  customElements.define('ca-faq', CaFaq);
}
