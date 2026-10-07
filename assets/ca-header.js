/*
 * ca-header.js — Conspire Agency header behavior.
 *
 * - Toggles `data-stuck` on scroll so a transparent-over-hero header turns solid.
 * - Runs an accessible mobile drawer (focus trap, Esc, overlay click, inert).
 * - Runs the desktop mega menus: hover intent + click/keyboard toggle, Esc and
 *   outside-click close, hover-swapped feature panels, and video play/pause.
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

    this._setupMegaMenus();

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
    document.removeEventListener('pointerdown', this._onOutsidePointer);
    document.removeEventListener('keydown', this._onMegaKeydown);
  }

  /* ── Mega menus ──────────────────────────────────────────────────── */

  _setupMegaMenus() {
    this._megas = Array.from(this.querySelectorAll('[data-ca-mega]'));
    if (!this._megas.length) return;

    this._onOutsidePointer = (e) => {
      if (!e.target.closest('[data-ca-mega]')) this.closeMega();
    };
    this._onMegaKeydown = (e) => {
      if (e.key === 'Escape' && this._openMega) {
        const trigger = this._openMega.querySelector('[data-ca-mega-trigger]');
        this.closeMega();
        trigger?.focus();
      }
    };
    document.addEventListener('pointerdown', this._onOutsidePointer);
    document.addEventListener('keydown', this._onMegaKeydown);

    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');

    this._megas.forEach((item) => {
      const trigger = item.querySelector('[data-ca-mega-trigger]');
      const panel = item.querySelector('[data-ca-mega-panel-root]');
      if (!trigger || !panel) return;

      trigger.addEventListener('click', () => {
        this._openMega === item ? this.closeMega() : this.openMega(item);
      });

      // Hover intent: a short delay in, a longer grace period out so the
      // pointer can cross the header padding between the trigger and the panel.
      item.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || !hoverCapable.matches) return;
        clearTimeout(item._closeTimer);
        item._openTimer = setTimeout(() => this.openMega(item), 60);
      });
      item.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(item._openTimer);
        item._closeTimer = setTimeout(() => {
          if (this._openMega === item) this.closeMega();
        }, 220);
      });

      // Close when focus leaves the item (keyboard users tabbing out).
      item.addEventListener('focusout', (e) => {
        if (this._openMega === item && e.relatedTarget && !item.contains(e.relatedTarget)) this.closeMega();
      });

      // Hover-swapped panels (specialties -> featured, case list -> detail).
      const targets = item.querySelectorAll('[data-ca-mega-target]');
      const panels = item.querySelectorAll('[data-ca-mega-panel]');
      if (!targets.length || panels.length < 2) return;

      const defaultId = panels[0].dataset.caMegaPanel;
      const show = (id) => {
        panels.forEach((p) => {
          const active = p.dataset.caMegaPanel === id;
          p.classList.toggle('is-active', active);
          const video = p.querySelector('video');
          if (video) active ? this._playVideo(video) : video.pause();
        });
        targets.forEach((t) => t.classList.toggle('is-active', t.dataset.caMegaTarget === id));
      };
      item._showPanel = show;
      item._defaultPanel = defaultId;

      targets.forEach((t) => {
        t.addEventListener('mouseenter', () => show(t.dataset.caMegaTarget));
        t.addEventListener('focus', () => show(t.dataset.caMegaTarget));
      });

      // Leaving the list restores the default panel, unless the pointer is
      // heading into the panel column (so a swapped panel stays clickable).
      const list = item.querySelector('[data-ca-mega-targets]');
      const panelCol = item.querySelector('[data-ca-mega-panels]');
      const restoreUnlessEntering = (keep) => (e) => {
        const to = e.relatedTarget;
        if (to && keep.some((el) => el && el.contains(to))) return;
        // The work menu keeps the hovered case (its list has no "default" card).
        if (item.querySelector('.ca-mega__grid--work')) return;
        show(defaultId);
      };
      list?.addEventListener('mouseleave', restoreUnlessEntering([panelCol]));
      panelCol?.addEventListener('mouseleave', restoreUnlessEntering([list]));
    });
  }

  openMega(item) {
    if (this._openMega && this._openMega !== item) this.closeMega();
    if (this._openMega === item) return;
    this._openMega = item;
    item.setAttribute('data-open', '');
    item.querySelector('[data-ca-mega-trigger]')?.setAttribute('aria-expanded', 'true');
    const panel = item.querySelector('[data-ca-mega-panel-root]');
    panel?.removeAttribute('inert');
    this.setAttribute('data-mega-open', '');
    const active = item.querySelector('[data-ca-mega-panel].is-active video');
    if (active) this._playVideo(active);
  }

  closeMega() {
    const item = this._openMega;
    if (!item) return;
    this._openMega = null;
    item.removeAttribute('data-open');
    item.querySelector('[data-ca-mega-trigger]')?.setAttribute('aria-expanded', 'false');
    item.querySelector('[data-ca-mega-panel-root]')?.setAttribute('inert', '');
    this.removeAttribute('data-mega-open');
    item.querySelectorAll('video').forEach((v) => v.pause());
    if (item._showPanel) item._showPanel(item._defaultPanel);
  }

  _playVideo(video) {
    // Chrome stalls play() on preload="none" videos that were hidden at parse
    // until load() runs once.
    if (video.readyState === 0 && !video.dataset.loaded) {
      video.dataset.loaded = '1';
      video.load();
    }
    video.play().catch(() => {});
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
    this.closeMega();
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
