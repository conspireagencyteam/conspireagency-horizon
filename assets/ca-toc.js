// ca-toc.js — <ca-toc>: marks the table-of-contents link for the section
// currently being read. The links are plain in-page anchors, so the TOC works
// without this script; it only adds the active state.

class CaToc extends HTMLElement {
  connectedCallback() {
    this.links = Array.from(this.querySelectorAll('a[href^="#"]'));
    this.targets = this.links
      .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
      .filter(Boolean);
    if (!this.targets.length || !('IntersectionObserver' in window)) return;

    this.visible = new Set();
    // A section counts as "current" while it crosses a band near the top of the viewport.
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.visible.add(entry.target);
          else this.visible.delete(entry.target);
        });
        const current = this.targets.find((target) => this.visible.has(target));
        if (current) this.activate(current.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );
    this.targets.forEach((target) => this.observer.observe(target));
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  activate(id) {
    this.links.forEach((link) => {
      const active = decodeURIComponent(link.hash.slice(1)) === id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }
}

if (!customElements.get('ca-toc')) {
  customElements.define('ca-toc', CaToc);
}
