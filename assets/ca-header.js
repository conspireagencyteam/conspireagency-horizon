/*
 * ca-header.js — Conspire Agency header behavior.
 *
 * - Toggles `data-stuck` on scroll so a transparent-over-hero header turns solid.
 * - Reveals the floating "Let's Talk" pill (a sibling of <ca-header>): at once
 *   when the page's first section (the hero) has no CTA of its own, otherwise
 *   once that hero has mostly scrolled out of view.
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

// Floating "Let's Talk": on a page whose hero has its own CTA the pill waits
// until the hero's bottom edge has risen above a line this far down the
// viewport (0 = the top edge, i.e. fully scrolled past; 0.5 = the midpoint).
const FLOAT_REVEAL_AT = 0.5;
// Marketing buttons (snippets/button.liquid) — the only links that count as a
// hero CTA. Commerce <button>s and plain text links don't.
const FLOAT_CTA_SELECTOR = 'a.button.size-style, a.button-secondary.size-style, a.button-custom.size-style';

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
    this._setupFloatingCta();

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
    this._floatObserver?.disconnect();
    this._floatObserver = null;
    document.removeEventListener('keydown', this._onModality, true);
    document.removeEventListener('pointerdown', this._onModality, true);
    document.removeEventListener('scroll', this._onScroll, { capture: true });
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('pointerdown', this._onOutsidePointer);
    document.removeEventListener('keydown', this._onMegaKeydown);
  }

  /* ── Floating "Let's Talk" ───────────────────────────────────────── */

  // The pill is rendered by ca-header.liquid next to this element and starts
  // hidden. Heroes that carry their own "Get Started"/"Let's Talk" button
  // (home, service pages: a marketing button linking within the site) keep the
  // pill back until the hero has mostly left the screen; heroes without one
  // (services collection, case studies whose only button is the client's site,
  // blog posts, app pages) get the pill the moment the page lands.
  //
  // The scroll case uses an IntersectionObserver against the viewport
  // (root: null), which reports the same answer whether `.page-wrapper` or the
  // window is the scroll container (see the scroll note above) and fires once
  // on observe(), so a page restored mid-scroll lands in the right state. The
  // negative TOP rootMargin trims the root to the part of the viewport below
  // the FLOAT_REVEAL_AT line, so a hero (anchored at the top) stops
  // intersecting as soon as its bottom edge rises above that line.
  // A page with no main section falls back to the header's own stuck threshold.
  _setupFloatingCta() {
    this._float = this.parentElement?.querySelector('[data-ca-header-float]') || document.querySelector('[data-ca-header-float]');
    if (!this._float) return;

    const hero = document.querySelector('#MainContent > .shopify-section:first-child');
    if (!hero || !('IntersectionObserver' in window)) {
      this._floatFallback = true;
      this._onScroll();
      return;
    }

    if (!this._heroHasCta(hero)) {
      this._setFloatVisible(true);
      return;
    }

    this._floatObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        // It is the first section, so it can only leave upward; the explicit
        // bottom-edge check keeps a zero-height hero from flashing the pill.
        const line = entry.rootBounds ? entry.rootBounds.top : window.innerHeight * FLOAT_REVEAL_AT;
        this._setFloatVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= line);
      },
      { root: null, threshold: 0, rootMargin: `-${Math.round(FLOAT_REVEAL_AT * 100)}% 0px 0px 0px` }
    );
    this._floatObserver.observe(hero);
  }

  // A hero "has a CTA" when one of its marketing buttons points somewhere on
  // this site other than the home page: the contact page, the in-page
  // #book-a-call booking section, pricing… Buttons that open the client's
  // store or an app listing in a new tab are showcase links, not a way to
  // reach us, and the 404 page's "back home" button doesn't count either.
  _heroHasCta(hero) {
    return Array.from(hero.querySelectorAll(FLOAT_CTA_SELECTOR)).some((a) => {
      if (a.target === '_blank') return false;
      let url;
      try {
        url = new URL(a.getAttribute('href') || '', location.href);
      } catch {
        return false;
      }
      if (url.origin !== location.origin) return false;
      if (url.pathname === location.pathname && url.hash) return true;
      return url.pathname !== '/';
    });
  }

  _setFloatVisible(visible) {
    if (!this._float) return;
    if (visible) this._float.setAttribute('data-visible', '');
    else this._float.removeAttribute('data-visible');
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
      const videos = this.querySelectorAll('.ca-mega video');
      videos.forEach((v) => this._primePoster(v));
      if (window.caWarmVideos) window.caWarmVideos(videos);
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

  /** Posters are rendered as data-poster (a real poster downloads at parse time,
   *  even with preload="none"); promote it the first time the menu is approached. */
  _primePoster(video) {
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
  }

  _playVideo(video) {
    this._primePoster(video);
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
      if (this._floatFallback) this._setFloatVisible(y > STUCK_AT);
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
