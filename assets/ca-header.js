/*
 * ca-header.js — Conspire Agency header behavior.
 *
 * - Toggles `data-stuck` on scroll so a transparent-over-hero header turns solid.
 * - Runs an accessible mobile drawer (focus trap, Esc, overlay click, inert).
 *
 * Plain custom element (no theme framework deps) to keep the header self-contained.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

class CaHeader extends HTMLElement {
  connectedCallback() {
    this.toggleBtn = this.querySelector('[data-ca-header-toggle]');
    this.drawer = this.querySelector('[data-ca-header-drawer]');
    this.overlay = this.querySelector('[data-ca-header-overlay]');

    this._onScroll = this._onScroll.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);

    // Horizon scrolls a `.page-wrapper` element (html/body are overflow:hidden),
    // so a window scroll listener never fires. Listen on that scroller; fall
    // back to window for setups where the window itself scrolls.
    this._scroller = document.querySelector('.page-wrapper') || window;
    this._scrollTarget = this._scroller === window ? window : this._scroller;
    this._lastY = this._scrollTop();
    this._onScroll();
    this._scrollTarget.addEventListener('scroll', this._onScroll, { passive: true });

    if (this.toggleBtn && this.drawer) {
      this.toggleBtn.addEventListener('click', () => (this.hasAttribute('data-drawer-open') ? this.close() : this.open()));
      this.overlay?.addEventListener('click', this.close);
      this.drawer.addEventListener('click', (e) => {
        if (e.target.closest('a')) this.close();
      });
    }
  }

  disconnectedCallback() {
    this._scrollTarget?.removeEventListener('scroll', this._onScroll);
    document.removeEventListener('keydown', this._onKeydown);
  }

  _scrollTop() {
    return this._scroller && this._scroller !== window ? this._scroller.scrollTop : window.scrollY;
  }

  _onScroll() {
    // Throttle to one check per frame to avoid layout thrash.
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      const y = this._scrollTop();
      const delta = y - this._lastY;
      this._lastY = y;
      const stuck = this.hasAttribute('data-stuck');

      // Direction-based, both gated on the 120px line: shrink when scrolling
      // DOWN past 120px; expand only when scrolling UP back above 120px (so it
      // stays compact while scrolling up mid-page). overflow-anchor:none on the
      // scroll container (see ca-header.liquid) stops the resize from nudging
      // scrollTop — no feedback, no flicker.
      if (delta > 2 && !stuck && y > 120) {
        this.setAttribute('data-stuck', '');
      } else if (delta < -2 && stuck && y < 120) {
        this.removeAttribute('data-stuck');
      } else if (y <= 4 && stuck) {
        this.removeAttribute('data-stuck');
      }
    });
  }

  open() {
    this.setAttribute('data-drawer-open', '');
    this.toggleBtn?.setAttribute('aria-expanded', 'true');
    this.drawer?.removeAttribute('inert');
    this.overlay?.removeAttribute('inert');
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', this._onKeydown);
    this.drawer?.querySelector(FOCUSABLE)?.focus();
  }

  close() {
    if (!this.hasAttribute('data-drawer-open')) return;
    this.removeAttribute('data-drawer-open');
    this.toggleBtn?.setAttribute('aria-expanded', 'false');
    this.drawer?.setAttribute('inert', '');
    this.overlay?.setAttribute('inert', '');
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', this._onKeydown);
    this.toggleBtn?.focus();
  }

  _onKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    if (e.key !== 'Tab' || !this.drawer) return;

    const focusables = Array.from(this.drawer.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

if (!customElements.get('ca-header')) {
  customElements.define('ca-header', CaHeader);
}
