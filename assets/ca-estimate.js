// ca-estimate.js — <ca-estimate>, the build-estimate flow (sections/ca-estimate.liquid).
// Also defines <ca-calendly> and <ca-lite-video> when the page has not (see the foot of the file).
//
// The questions come from the brain (GET <api>/api/public/estimate/config) and every
// answer is saved there, step by step, against a request token kept in this browser.
// The brain decides who qualifies and works out the ballpark; this file renders the
// steps, mirrors the brain's show/hide rules so the right questions appear, polls the
// store scan, mounts the Calendly embed (<ca-calendly>, sections/ca-booking.liquid)
// and shows the result the brain's answer calls for. Nothing here prices anything.
//
// Text from the brain is always set with textContent, never as HTML.

const STORAGE_PREFIX = 'ca-estimate:v1:';
const STORAGE_DAYS = 14;
const POLL_MS = 1500;
const SCAN_WAIT_MS = 12000;

// The site's Calendly event ("Website Strategy Intro Call") asks five questions, in this
// order: website, monthly revenue, monthly ad spend, notes, budget goal (a dropdown).
// Prefilled, the visitor only types a name and email. Keep in step with the event type.
const CALENDLY_BUDGET = { '15k_35k': '$15-35k ', '35k_60k': '$35-60k', '60k_100k': '$60-100k', '100k_plus': '$100k+' };
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

const PATH_STEPS = {
  call: ['brand', 'business', 'calendar', 'products', 'everything'],
  estimate: ['brand', 'business', 'products', 'everything', 'contact'],
};

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function readStore(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || Date.now() - (v.at || 0) > STORAGE_DAYS * 86400000) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }));
  } catch (e) {
    // private mode: the flow still works, it just cannot resume after a reload
  }
}

function productBand(n) {
  if (typeof n !== 'number' || !(n > 0)) return null;
  if (n < 25) return 'under_25';
  if (n <= 100) return '25_100';
  if (n <= 500) return '100_500';
  if (n <= 2000) return '500_2000';
  return '2000_plus';
}

function whenText(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  } catch (e) {
    return '';
  }
}

class CaEstimate extends HTMLElement {
  connectedCallback() {
    if (this.started) return;
    this.started = true;
    this.mode = this.dataset.mode === 'estimate' ? 'estimate' : 'call';
    this.path = this.mode;
    this.api = (this.dataset.api || '').replace(/\/$/, '');
    // Local testing only: ?api=http://localhost:3125 points the flow at a local brain. Ignored on the live site.
    const host = window.location.hostname;
    const override = new URLSearchParams(window.location.search).get('api');
    if (override && (host === '127.0.0.1' || host === 'localhost')) this.api = override.replace(/\/$/, '');
    this.storeKey = STORAGE_PREFIX + this.mode;
    this.stage = this.querySelector('[data-stage]');
    this.statusEl = this.querySelector('[data-status]');
    this.head = this.querySelector('[data-head]');
    this.progress = this.querySelector('[data-progress]');
    this.answers = {};
    this.request = null;
    this.token = null;
    this.current = null;
    this.onMessage = (e) => this.calendlyMessage(e);
    window.addEventListener('message', this.onMessage);
    this.boot();
  }

  disconnectedCallback() {
    window.removeEventListener('message', this.onMessage);
    clearTimeout(this.pollTimer);
  }

  // ── Talking to the brain ──────────────────────────────────────────────────

  async call(method, path, body) {
    let res;
    try {
      res = await fetch(this.api + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'omit',
      });
    } catch (e) {
      return { ok: false, status: 0, data: { error: "We couldn't reach our server. Check your connection and try again." } };
    }
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

  async boot() {
    const cfg = await this.call('GET', '/api/public/estimate/config');
    if (!cfg.ok || !Array.isArray(cfg.data.steps)) {
      this.stage.replaceChildren(h('p', { class: 'ca-estimate__lede', text: "The questions didn't load. Refresh the page to try again." }));
      return;
    }
    this.config = cfg.data;
    const saved = readStore(this.storeKey);
    if (saved && saved.token) {
      const got = await this.call('GET', `/api/public/estimate/requests/${saved.token}`);
      if (got.ok && got.data.request) {
        this.token = saved.token;
        this.take(got.data.request);
      }
    }
    this.go(this.nextStep(), { initial: true });
    this.pollScan();
  }

  take(request) {
    this.request = request;
    this.path = request.path === 'estimate' ? 'estimate' : 'call';
    this.answers = { ...(request.answers || {}), ...this.unsaved() };
  }

  /** Answers typed on the step on screen that the brain has not stored yet survive a refresh of the request. */
  unsaved() {
    if (!this.current || !this.dirty) return {};
    const step = this.stepDef(this.current);
    const out = {};
    if (step) for (const q of step.questions) if (q.id in this.answers) out[q.id] = this.answers[q.id];
    return out;
  }

  stepDef(id) {
    return (this.config.steps || []).find((s) => s.id === id) || null;
  }

  complete(id) {
    return Boolean(this.request && Array.isArray(this.request.complete) && this.request.complete.includes(id));
  }

  nextStep() {
    const r = this.request;
    if (!r || !this.token) return 'brand';
    if (!this.complete('business')) return 'business';
    if (r.fit && r.fit.verdict === 'not_a_fit') return 'notfit';
    if (this.path === 'call') {
      if (!r.bookedFor && !this.bookedHere) return 'calendar';
      if (!this.complete('products')) return 'products';
      if (!this.complete('everything')) return 'everything';
      return 'booked';
    }
    if (!this.complete('products')) return 'products';
    if (!this.complete('everything')) return 'everything';
    if (!this.complete('contact')) return 'contact';
    return 'estimate';
  }

  // ── Conditions (the brain's own rules, mirrored) ─────────────────────────

  holds(cond) {
    if (!cond) return true;
    if (cond.any) return cond.any.some((c) => this.holds(c));
    if (cond.all) return cond.all.every((c) => this.holds(c));
    const scan = this.request && this.request.scan;
    if (cond.scan === 'not_shopify') return Boolean(scan && scan.state === 'done' && scan.platform === 'other' && !this.answers.noStore);
    if (cond.scan === 'has_pages') return Boolean(scan && scan.pages && scan.pages.length && !this.answers.noStore);
    const v = this.answers[cond.q];
    if ('is' in cond) return (v === true) === cond.is;
    if (Array.isArray(v)) return v.some((x) => cond.in.includes(x));
    return typeof v === 'string' && cond.in.includes(v);
  }

  visible(step) {
    return step.questions.filter((q) => this.holds(q.showIf));
  }

  // ── Moving between steps ─────────────────────────────────────────────────

  go(stepId, opts = {}) {
    this.current = stepId;
    this.dirty = false;
    this.setStatus('');
    const results = ['booked', 'estimate', 'notfit'];
    this.querySelectorAll('[data-result]').forEach((el) => {
      el.hidden = el.dataset.result !== stepId;
    });
    if (results.includes(stepId)) {
      this.stage.replaceChildren();
      this.stage.hidden = true;
      if (this.head) this.head.hidden = true;
      this.setProgress(null);
      this.showResult(stepId);
    } else {
      this.stage.hidden = false;
      if (this.head) this.head.hidden = stepId !== 'brand';
      this.setProgress(stepId);
      if (stepId === 'calendar') this.renderCalendar();
      else this.renderStep(stepId);
    }
    if (window.gtag) window.gtag('event', 'estimate_step', { step: stepId, path: this.path });
    if (!opts.initial) {
      this.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      const focusEl = this.querySelector(results.includes(stepId) ? `[data-result="${stepId}"] [data-result-heading]` : '.ca-estimate__step-title');
      if (focusEl) focusEl.focus({ preventScroll: true });
    }
  }

  setProgress(stepId) {
    if (!this.progress) return;
    const steps = PATH_STEPS[this.path];
    const i = stepId ? steps.indexOf(stepId) : -1;
    if (i < 0) {
      this.progress.hidden = true;
      return;
    }
    this.progress.hidden = false;
    this.querySelector('[data-count]').textContent = `Step ${i + 1} of ${steps.length}`;
    this.querySelector('[data-bar]').style.setProperty('--ca-estimate-progress', `${Math.round(((i + 1) / (steps.length + 1)) * 100)}%`);
  }

  setStatus(text, error = false) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || '';
    this.statusEl.classList.toggle('ca-estimate__status--error', Boolean(error));
  }

  previousStep(stepId) {
    const steps = PATH_STEPS[this.path];
    const i = steps.indexOf(stepId);
    if (i <= 0) return null;
    const prev = steps[i - 1];
    // A booked call is not unbooked by going back.
    if (prev === 'calendar') return null;
    return prev;
  }

  // ── A step of questions ──────────────────────────────────────────────────

  renderStep(stepId, restoreFocusId) {
    const step = this.stepDef(stepId);
    if (!step) return;
    this.prefill(stepId);
    const form = h('form', { class: 'ca-estimate__step ca-form', novalidate: true });
    form.append(h('h2', { class: 'ca-estimate__step-title', tabindex: '-1', text: step.title }));
    if (stepId === 'products' && this.path === 'call' && (this.bookedHere || (this.request && this.request.bookedFor))) {
      const when = whenText(this.request && this.request.bookedFor);
      form.append(h('p', { class: 'ca-estimate__banner', text: when ? `You're booked for ${when}. A few questions so we come to the call prepared.` : "You're booked. A few questions so we come to the call prepared." }));
    }
    for (const q of this.visible(step)) form.append(this.renderQuestion(q));
    if (stepId === 'brand') {
      form.append(h('div', { class: 'ca-form__trap', 'aria-hidden': 'true' }, h('label', { for: 'ca-est-website', text: 'Website' }), h('input', { id: 'ca-est-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' })));
    }
    form.append(this.renderNav(stepId));
    form.addEventListener('input', (e) => this.onInput(stepId, e));
    form.addEventListener('change', (e) => this.onInput(stepId, e, true));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit(stepId, form);
    });
    this.stage.replaceChildren(form);
    this.signature = this.signatureOf(stepId);
    if (restoreFocusId) {
      const el = document.getElementById(restoreFocusId);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /** What the scan already knows, offered as the answer until the visitor says otherwise. */
  prefill(stepId) {
    const scan = this.request && this.request.scan;
    if (stepId === 'products' && !this.answers.productCount && scan && scan.productCount) {
      const band = productBand(scan.productCount);
      if (band) this.answers.productCount = band;
    }
  }

  signatureOf(stepId) {
    const step = this.stepDef(stepId);
    if (!step) return '';
    const scan = (this.request && this.request.scan) || {};
    return [this.visible(step).map((q) => q.id).join(','), scan.state, scan.productCount, (scan.pages || []).length].join('|');
  }

  renderQuestion(q) {
    const id = `ca-est-${q.id}`;
    const helpText = this.helpFor(q);
    const help = helpText ? h('p', { class: 'ca-estimate__help', id: `${id}-help`, text: helpText }) : null;
    const error = h('p', { class: 'ca-estimate__error', id: `${id}-error`, hidden: true });
    const describedBy = [help ? `${id}-help` : null, `${id}-error`].filter(Boolean).join(' ');

    if (q.kind === 'single' || q.kind === 'multi') {
      const type = q.kind === 'single' ? 'radio' : 'checkbox';
      const current = this.answers[q.id];
      const choices = h('div', { class: 'ca-estimate__choices' });
      (q.options || []).forEach((o, i) => {
        const checked = q.kind === 'single' ? current === o.value : Array.isArray(current) && current.includes(o.value);
        choices.append(h('label', { class: 'ca-estimate__choice' }, h('input', { type, name: q.id, value: o.value, id: `${id}-${i}`, checked: checked || null }), h('span', { text: o.label })));
      });
      return h('fieldset', { class: 'ca-estimate__q', 'data-q': q.id, 'aria-describedby': describedBy }, h('legend', { text: q.label + (q.optional ? ' (optional)' : '') }), choices, help, error);
    }

    if (q.kind === 'checkbox') {
      return h('div', { class: 'ca-estimate__q', 'data-q': q.id }, h('label', { class: 'ca-estimate__check' }, h('input', { type: 'checkbox', name: q.id, id, checked: this.answers[q.id] === true || null }), h('span', { text: q.label })), error);
    }

    if (q.kind === 'pages') return this.renderPages(q, help, error);

    const value = typeof this.answers[q.id] === 'string' ? this.answers[q.id] : '';
    const attrs = { class: 'ca-field__input', id, name: q.id, placeholder: q.placeholder || null, maxlength: q.maxLength || null, 'aria-describedby': describedBy };
    let input;
    if (q.kind === 'textarea') {
      input = h('textarea', { ...attrs, rows: '5' });
      input.value = value;
    } else {
      const type = q.kind === 'email' ? 'email' : q.kind === 'url' ? 'text' : 'text';
      const extra = q.kind === 'email' ? { autocomplete: 'email', inputmode: 'email' } : q.kind === 'url' ? { autocomplete: 'url', inputmode: 'url', autocapitalize: 'off', spellcheck: 'false' } : q.id === 'contactName' ? { autocomplete: 'name' } : q.id === 'contactPhone' ? { autocomplete: 'tel', inputmode: 'tel' } : q.id === 'brandName' ? { autocomplete: 'organization' } : {};
      input = h('input', { ...attrs, ...extra, type, value });
    }
    return h('div', { class: 'ca-field ca-field--full ca-estimate__q', 'data-q': q.id }, h('label', { class: 'ca-field__label', for: id, text: q.label + (q.optional ? ' (optional)' : '') }), input, help, error);
  }

  helpFor(q) {
    const scan = this.request && this.request.scan;
    if (q.scanHelp && scan && typeof scan.productCount === 'number' && scan.productCount > 0) return q.scanHelp.replace('{n}', scan.productCount.toLocaleString());
    if (q.id === 'storeUrl' && this.request && this.request.scan && this.request.scan.state === 'running') return 'Reading your store now.';
    return q.help || '';
  }

  renderPages(q, help, error) {
    const scan = (this.request && this.request.scan) || {};
    const pages = (scan.pages || []).filter((p) => !p.policy);
    const policies = (scan.pages || []).filter((p) => p.policy);
    const chosen = this.answers.pages || {};
    const list = h('ul', { class: 'ca-estimate__pages' });
    pages.forEach((p, n) => {
      const name = `ca-est-page-${n}`;
      const choices = h('div', { class: 'ca-estimate__choices', role: 'radiogroup', 'aria-label': p.name });
      (q.options || []).forEach((o, i) => {
        const checked = (chosen[p.id] || 'keep') === o.value;
        choices.append(h('label', { class: 'ca-estimate__choice' }, h('input', { type: 'radio', name, value: o.value, id: `${name}-${i}`, 'data-page': p.id, checked: checked || null }), h('span', { text: o.label })));
      });
      list.append(h('li', { class: 'ca-estimate__page' }, h('span', { class: 'ca-estimate__page-name' }, p.name, h('span', { class: 'ca-estimate__page-path', text: p.path })), choices));
    });
    if (policies.length) {
      list.append(h('li', { class: 'ca-estimate__page' }, h('span', { class: 'ca-estimate__page-name' }, `Policy and legal pages (${policies.length})`, h('span', { class: 'ca-estimate__page-path', text: 'Moved over as they are' }))));
    }
    return h('fieldset', { class: 'ca-estimate__q', 'data-q': q.id }, h('legend', { text: q.label }), help, list, error);
  }

  renderNav(stepId) {
    const prev = this.previousStep(stepId);
    const side = h('div', { class: 'ca-estimate__nav-side' });
    if (prev) side.append(h('button', { type: 'button', class: 'ca-estimate__link', text: 'Back', onclick: () => this.go(prev) }));
    if (stepId === 'products' || stepId === 'everything') {
      side.append(h('button', { type: 'button', class: 'ca-estimate__link', text: this.path === 'call' ? "Skip, we'll cover it on the call" : 'Skip this step', onclick: () => this.skip(stepId) }));
    }
    const label = stepId === 'contact' ? 'See my ballpark' : stepId === 'business' && this.path === 'call' ? 'Pick a time' : stepId === 'everything' && this.path === 'call' ? 'Finish' : 'Continue';
    return h('div', { class: 'ca-estimate__nav' }, side, h('button', { type: 'submit', class: 'ca-button', text: label }));
  }

  onInput(stepId, e, isChange = false) {
    const t = e.target;
    if (!t || !t.name) return;
    if (t.name === 'website') return;
    this.dirty = true;
    if (t.dataset && t.dataset.page) {
      this.answers.pages = { ...(this.answers.pages || {}), [t.dataset.page]: t.value };
      return;
    }
    const step = this.stepDef(stepId);
    const q = step && step.questions.find((x) => x.id === t.name);
    if (!q) return;
    const form = t.form;
    if (q.kind === 'multi') this.answers[q.id] = Array.from(form.querySelectorAll(`input[name="${q.id}"]:checked`)).map((i) => i.value);
    else if (q.kind === 'single') this.answers[q.id] = (form.querySelector(`input[name="${q.id}"]:checked`) || {}).value;
    else if (q.kind === 'checkbox') this.answers[q.id] = t.checked;
    else this.answers[q.id] = t.value;
    this.clearError(q.id);
    // A choice that shows or hides another question redraws the step (text fields never do, so typing is never interrupted).
    if (isChange && (q.kind === 'single' || q.kind === 'multi' || q.kind === 'checkbox') && this.signatureOf(stepId) !== this.signature) this.renderStep(stepId, t.id);
  }

  clearError(qid) {
    const box = this.stage.querySelector(`[data-q="${qid}"] .ca-estimate__error`);
    if (box) {
      box.hidden = true;
      box.textContent = '';
    }
  }

  showErrors(errors) {
    let first = null;
    for (const [qid, message] of Object.entries(errors || {})) {
      const wrap = this.stage.querySelector(`[data-q="${qid}"]`);
      if (!wrap) continue;
      const box = wrap.querySelector('.ca-estimate__error');
      if (box) {
        box.textContent = message;
        box.hidden = false;
      }
      if (!first) first = wrap.querySelector('input, textarea');
    }
    if (first) first.focus();
  }

  stepAnswers(stepId) {
    const step = this.stepDef(stepId);
    const out = {};
    if (!step) return out;
    for (const q of this.visible(step)) {
      const v = this.answers[q.id];
      if (v === undefined || v === null || v === '') continue;
      out[q.id] = typeof v === 'string' ? v.trim() : v;
    }
    if (stepId === 'brand' && this.answers.noStore) out.noStore = true;
    return out;
  }

  busy(form, on) {
    const btn = form && form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = on;
  }

  async submit(stepId, form) {
    if (this.pending) return;
    this.pending = true;
    this.busy(form, true);
    try {
      if (stepId === 'business') {
        const shown = () => this.visible(this.stepDef('business')).map((q) => q.id).join(',');
        const before = shown();
        const waited = await this.waitForScan();
        // Only a question the scan added ("Are you moving to Shopify?") stops the step here.
        if (waited && shown() !== before) {
          this.renderStep('business');
          this.setStatus('One more question about your store.');
          return;
        }
      }
      let res;
      if (stepId === 'brand' && !this.token) {
        const trap = form.querySelector('input[name="website"]');
        res = await this.call('POST', '/api/public/estimate/requests', { path: this.path, answers: this.stepAnswers('brand'), utm: this.utm(), referrer: document.referrer || null, website: trap ? trap.value : '' });
        if (res.ok && res.data.token) {
          this.token = res.data.token;
          writeStore(this.storeKey, { token: this.token });
        }
      } else {
        res = await this.call('PATCH', `/api/public/estimate/requests/${this.token}`, { step: stepId, answers: this.stepAnswers(stepId), switchToEstimate: this.switching || undefined });
      }
      if (!res.ok) {
        if (res.status === 400 && res.data.errors) this.showErrors(res.data.errors);
        if (res.status === 404 && stepId !== 'brand') this.restart();
        this.setStatus(res.data.error || 'Something went wrong. Try again.', true);
        return;
      }
      if (!res.data.request) {
        this.setStatus("Thanks. We'll be in touch.");
        return;
      }
      this.switching = false;
      this.dirty = false;
      this.take(res.data.request);
      if (stepId === 'contact' && res.data.request.status === 'finished') this.reportLead();
      this.go(this.nextStep());
      this.pollScan();
    } finally {
      this.pending = false;
      this.busy(form, false);
    }
  }

  async skip(stepId) {
    if (this.pending) return;
    this.pending = true;
    try {
      const res = await this.call('PATCH', `/api/public/estimate/requests/${this.token}`, { step: stepId, skip: true, switchToEstimate: this.switching || undefined });
      if (!res.ok) {
        this.setStatus(res.data.error || 'Something went wrong. Try again.', true);
        return;
      }
      this.switching = false;
      this.dirty = false;
      this.take(res.data.request);
      this.go(this.nextStep());
    } finally {
      this.pending = false;
    }
  }

  restart() {
    try {
      window.localStorage.removeItem(this.storeKey);
    } catch (e) {
      // nothing stored
    }
    this.token = null;
    this.request = null;
  }

  utm() {
    const params = new URLSearchParams(window.location.search);
    const out = {};
    for (const k of UTM_KEYS) if (params.get(k)) out[k] = params.get(k);
    return Object.keys(out).length ? out : null;
  }

  reportLead() {
    const key = `${this.storeKey}:lead`;
    if (readStore(key)) return;
    writeStore(key, { done: true });
    document.dispatchEvent(new CustomEvent('ca:estimate-lead', { detail: { path: this.path } }));
  }

  // ── The store scan ───────────────────────────────────────────────────────

  scanRunning() {
    return Boolean(this.request && this.request.scan && this.request.scan.state === 'running');
  }

  pollScan() {
    clearTimeout(this.pollTimer);
    if (!this.token || !this.scanRunning()) return;
    this.pollTries = (this.pollTries || 0) + 1;
    if (this.pollTries > 40) return;
    this.pollTimer = setTimeout(async () => {
      const got = await this.call('GET', `/api/public/estimate/requests/${this.token}`);
      if (got.ok && got.data.request) {
        const before = this.current ? this.signatureOf(this.current) : '';
        this.take(got.data.request);
        const onStep = this.current && !['calendar', 'booked', 'estimate', 'notfit'].includes(this.current);
        if (onStep && this.signatureOf(this.current) !== before && !this.pending) this.renderStep(this.current, document.activeElement && document.activeElement.id);
      }
      this.pollScan();
    }, POLL_MS);
  }

  /** Before the business step is saved: give the scan a few seconds, so "Are you moving to Shopify?" can appear. */
  async waitForScan() {
    if (!this.scanRunning()) return false;
    this.setStatus('Reading your store…');
    const until = Date.now() + SCAN_WAIT_MS;
    while (Date.now() < until && this.scanRunning()) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const got = await this.call('GET', `/api/public/estimate/requests/${this.token}`);
      if (got.ok && got.data.request) this.take(got.data.request);
    }
    this.setStatus('');
    return true;
  }

  // ── The calendar ─────────────────────────────────────────────────────────

  calendlyUrl() {
    let url;
    try {
      url = new URL(this.dataset.calendly);
    } catch (e) {
      return this.dataset.calendly;
    }
    const a = this.answers;
    const label = (qid) => {
      for (const s of this.config.steps) for (const q of s.questions) if (q.id === qid) return ((q.options || []).find((o) => o.value === a[qid]) || {}).label || '';
      return '';
    };
    const scan = (this.request && this.request.scan) || {};
    url.searchParams.set('hide_event_type_details', '1');
    url.searchParams.set('hide_gdpr_banner', '1');
    if (a.contactName) url.searchParams.set('name', a.contactName);
    if (a.contactEmail) url.searchParams.set('email', a.contactEmail);
    url.searchParams.set('a1', a.noStore ? 'No store yet' : (scan.origin || a.storeUrl || ''));
    if (a.revenue) url.searchParams.set('a2', `${label('revenue')} a year`);
    if (a.adSpend) url.searchParams.set('a3', `${label('adSpend')} a month`);
    url.searchParams.set('a4', `${a.brandName || 'Our brand'}: answered the estimate questions on conspireagency.com.`);
    if (CALENDLY_BUDGET[a.budget]) url.searchParams.set('a5', CALENDLY_BUDGET[a.budget]);
    const utm = this.utm();
    if (utm) for (const [k, v] of Object.entries(utm)) if (k.startsWith('utm_')) url.searchParams.set(k, v);
    // URLSearchParams writes a space as "+", and Calendly's widget re-encodes the URL it is given, so the
    // form would show "$3M+to+$10M". A literal plus is already %2B here, so every "+" left is a space.
    url.search = url.searchParams.toString().replace(/\+/g, '%20');
    return url.toString();
  }

  mountCalendly(container) {
    const embed = document.createElement('ca-calendly');
    embed.className = 'ca-booking__embed';
    embed.dataset.url = this.calendlyUrl();
    embed.style.minWidth = '320px';
    embed.style.height = '700px';
    embed.append(h('a', { class: 'ca-booking__fallback', href: this.dataset.calendly, target: '_blank', rel: 'noopener', text: 'Open the scheduler' }));
    container.replaceChildren(embed);
  }

  renderCalendar() {
    const wrap = h('div', { class: 'ca-estimate__step' });
    wrap.append(h('h2', { class: 'ca-estimate__step-title', tabindex: '-1', text: 'Pick a time' }));
    wrap.append(h('p', { class: 'ca-estimate__lede', text: "Thirty minutes with our team. Your answers are already filled in: Calendly only needs your name and email." }));
    const box = h('div', { class: 'ca-estimate__calendar' });
    wrap.append(box);
    wrap.append(
      h('div', { class: 'ca-estimate__nav' },
        h('div', { class: 'ca-estimate__nav-side' },
          h('button', { type: 'button', class: 'ca-estimate__link', text: 'Back', onclick: () => this.go('business') }),
          h('button', { type: 'button', class: 'ca-estimate__link', text: 'Not ready to talk? Get your estimate first', onclick: () => this.switchToEstimate() }),
        ),
      ),
    );
    this.stage.replaceChildren(wrap);
    this.mountCalendly(box);
  }

  switchToEstimate() {
    this.switching = true;
    this.path = 'estimate';
    this.go(this.complete('products') ? (this.complete('everything') ? 'contact' : 'everything') : 'products');
  }

  async calendlyMessage(e) {
    if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.event_scheduled') return;
    const inviteeUri = e.data.payload && e.data.payload.invitee && e.data.payload.invitee.uri;
    if (!this.token || !inviteeUri) return;
    this.bookedHere = true;
    let res = await this.call('POST', `/api/public/estimate/requests/${this.token}/booking`, { inviteeUri });
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000));
      res = await this.call('POST', `/api/public/estimate/requests/${this.token}/booking`, { inviteeUri });
    }
    if (res.ok && res.data.request) this.take(res.data.request);
    if (this.current === 'calendar') {
      this.go(this.nextStep());
    } else if (this.current === 'estimate') {
      const result = this.querySelector('[data-result="estimate"]');
      result.querySelector('[data-confirm]').hidden = true;
      const done = result.querySelector('[data-confirmed]');
      done.hidden = false;
      const t = done.querySelector('[data-booked-time]');
      if (t) t.textContent = whenText(this.request && this.request.bookedFor);
    }
  }

  // ── Results ──────────────────────────────────────────────────────────────

  showResult(kind) {
    const el = this.querySelector(`[data-result="${kind}"]`);
    if (!el) return;
    const r = this.request || {};
    if (kind === 'notfit') {
      const box = el.querySelector('[data-reasons]');
      box.replaceChildren(...((r.fit && r.fit.reasons) || []).map((x) => h('p', { text: x.text })));
      return;
    }
    el.querySelectorAll('[data-booked-time]').forEach((t) => {
      t.textContent = whenText(r.bookedFor);
    });
    this.fillBallpark(el.querySelector('[data-ballpark]'), r.ballpark);
    if (kind === 'estimate') {
      const booked = Boolean(r.bookedFor);
      el.querySelector('[data-confirm]').hidden = booked;
      el.querySelector('[data-confirmed]').hidden = !booked;
      if (!booked) this.mountCalendly(el.querySelector('[data-calendar]'));
    }
  }

  fillBallpark(block, b) {
    if (!block) return;
    if (!b) {
      block.hidden = true;
      return;
    }
    block.hidden = false;
    block.querySelector('[data-range]').textContent = b.range;
    block.querySelector('[data-weeks]').textContent = b.weeks;
    block.querySelector('[data-scope]').replaceChildren(...(b.scope || []).map((s) => h('li', { text: s })));
    const un = block.querySelector('[data-unpriced]');
    if (b.unpriced && b.unpriced.length) {
      un.hidden = false;
      un.textContent = `${un.dataset.prefix || 'Scoped on the call:'} ${b.unpriced.join(', ')}.`;
    } else {
      un.hidden = true;
    }
  }
}

if (!customElements.get('ca-estimate')) customElements.define('ca-estimate', CaEstimate);

// The Calendly embed and the video poster are defined in the sections that use them elsewhere
// (ca-booking, ca-article-header), and the theme only loads a section's script on pages that
// render it. These pages render neither, so the same two elements are defined here when missing.
if (!customElements.get('ca-calendly')) {
  customElements.define(
    'ca-calendly',
    class extends HTMLElement {
      connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        const init = () => {
          if (!window.Calendly) return;
          this.replaceChildren();
          window.Calendly.initInlineWidget({ url: this.dataset.url, parentElement: this, resize: true });
        };
        if (window.Calendly) return init();
        let script = document.querySelector('script[data-ca-calendly]');
        if (!script) {
          script = document.createElement('script');
          script.src = 'https://assets.calendly.com/assets/external/widget.js';
          script.async = true;
          script.dataset.caCalendly = '1';
          document.head.appendChild(script);
        }
        script.addEventListener('load', init, { once: true });
      }
    },
  );
}

if (!customElements.get('ca-lite-video')) {
  customElements.define(
    'ca-lite-video',
    class extends HTMLElement {
      connectedCallback() {
        this.querySelectorAll('[data-yt-play]').forEach((b) => b.addEventListener('click', () => this.play()));
      }
      play() {
        const id = this.dataset.videoId;
        if (!id) return;
        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
        iframe.title = this.dataset.title || 'Video';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        this.replaceChildren(iframe);
        iframe.focus();
      }
    },
  );
}

