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

// Scroll offsets (px) at which the header sticks / releases (hysteresis band).
const STUCK_AT = 120;
const UNSTUCK_AT = 60;

class CaHeader extends HTMLElement {
  connectedCallback() {
    this.toggleBtn = this.querySelector('[data-ca-header-toggle]');
    this.drawer = this.querySelector('[data-ca-header-drawer]');
    this.overlay = this.querySelector('[data-ca-header-overlay]');

    this._onScroll = this._onScroll.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);

    // Horizon's scroll container depends on viewport width: at >= 990px the
    // `.page-wrapper` element scrolls (html/body are overflow:hidden); below
    // that the window scrolls and `.page-wrapper` is a plain block. A listener
    // bound to one of them is deaf on the other (phones never set data-stuck,
    // so a transparent-over-hero header stayed transparent mid-page). Scroll
    // events don't bubble but do capture, so one capturing listener on the
    // document hears whichever element is scrolling at the current width — and
    // survives Horizon swapping `.page-wrapper` during view transitions.
    this._pageWrapper = document.querySelector('.page-wrapper');
    this._onScroll();
    document.addEventListener('scroll', this._onScroll, { capture: true, passive: true });

    // Track the last input modality. Programmatic .focus() after a tap can match
    // :focus-visible on mobile browsers (nothing was focused before), which
    // paints a dark box. CSS keys off data-input="pointer" to suppress it, while
    // keyboard users keep the ring.
    this.setAttribute('data-input', 'pointer');
    this._onModality = (e) => {
      const mode = e.type === 'keydown' ? 'keyboard' : 'pointer';
      if (this.getAttribute('data-input') !== mode) this.setAttribute('data-input', mode);
    };
    document.addEventListener('keydown', this._onModality, true);
    document.addEventListener('pointerdown', this._onModality, true);

    this._setupMegaMenus();

    if (this.toggleBtn && this.drawer) {
      this.toggleBtn.addEventListener('click', () => (this.hasAttribute('data-drawer-open') ? this.close() : this.open()));
      this.overlay?.addEventListener('click', this.close);
      this.drawer.querySelector('[data-ca-header-close]')?.addEventListener('click', this.close);
      this.drawer.addEventListener('click', (e) => {
        if (e.target.closest('a')) this.close();
      });
    }
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onModality, true);
    document.removeEventListener('pointerdown', this._onModality, true);
    document.removeEventListener('scroll', this._onScroll, { capture: true });
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

    // Warm the mega-menu videos the first time the pointer reaches the header:
    // by the time a panel opens (hover intent + fade) the first seconds are
    // buffered, and pages where nobody goes near the nav download nothing.
    this._onHeaderEnter = (e) => {
      if (e.pointerType !== 'mouse') return;
      this.removeEventListener('pointerenter', this._onHeaderEnter);
      if (window.caWarmVideos) window.caWarmVideos(this.querySelectorAll('.ca-mega video'));
    };
    this.addEventListener('pointerenter', this._onHeaderEnter);

    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');

    this._megas.forEach((item) => {
      const trigger = item.querySelector('[data-ca-mega-trigger]');
      const toggle = item.querySelector('[data-ca-mega-toggle]');
      const panel = item.querySelector('[data-ca-mega-panel-root]');
      if (!trigger || !panel) return;

      // The trigger is a real link to the section's landing page; the
      // disclosure button (and ArrowDown on the link) opens the panel for
      // keyboard and touch users, hover handles the mouse.
      toggle?.addEventListener('click', () => {
        this._openMega === item ? this.closeMega() : this.openMega(item);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.openMega(item);
          panel.querySelector('a, button')?.focus();
        }
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
          if (video) active ? this._playVideo(video) : this._pauseVideo(video);
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
    item.querySelector('[data-ca-mega-toggle]')?.setAttribute('aria-expanded', 'true');
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
    item.querySelector('[data-ca-mega-toggle]')?.setAttribute('aria-expanded', 'false');
    item.querySelector('[data-ca-mega-panel-root]')?.setAttribute('inert', '');
    this.removeAttribute('data-mega-open');
    item.querySelectorAll('video').forEach((v) => this._pauseVideo(v));
    if (item._showPanel) item._showPanel(item._defaultPanel);
  }

  _playVideo(video) {
    video.dataset.playing = '1';
    // Chrome stalls play() on preload="none" videos that were hidden at parse
    // until load() runs once.
    if (video.readyState === 0 && !video.dataset.loaded) {
      video.dataset.loaded = '1';
      video.load();
    }
    video.play().catch(() => {});
  }

  _pauseVideo(video) {
    delete video.dataset.playing;
    video.pause();
  }

  _scrollTop() {
    // Whichever container is the scroller at this width reports > 0; the other
    // stays at 0 (a non-scrolling `.page-wrapper` can't hold a scrollTop).
    const wrapperY = this._pageWrapper?.isConnected ? this._pageWrapper.scrollTop : 0;
    return Math.max(wrapperY, window.scrollY || 0);
  }

  _onScroll() {
    // Throttle to one check per frame to avoid layout thrash.
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      const y = this._scrollTop();
      const stuck = this.hasAttribute('data-stuck');

      // Position-based with hysteresis: stick once past 120px, release only
      // back above 60px. Being position- rather than direction-based means a
      // page that opens mid-scroll (bfcache / scroll restoration, in-page
      // anchors, a momentum scroll whose events arrive after the fact) still
      // lands in the right state, and the 60px dead band dwarfs the few px the
      // header shrinks when stuck, so scroll anchoring can't bounce it
      // (overflow-anchor:none on the scroll container helps too; see
      // ca-header.liquid).
      if (!stuck && y > STUCK_AT) {
        this.setAttribute('data-stuck', '');
      } else if (stuck && y < UNSTUCK_AT) {
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
    // Focus the drawer container (tabindex=-1) rather than the first link, so
    // screen readers land inside the menu without a ring on "Services".
    this.drawer?.focus({ preventScroll: true });
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

    if (e.shiftKey && (document.activeElement === first || document.activeElement === this.drawer)) {
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
