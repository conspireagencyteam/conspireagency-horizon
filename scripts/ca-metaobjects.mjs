#!/usr/bin/env node
/**
 * ca-metaobjects.mjs — Conspire v2.0 metaobject provisioning (Phase 1).
 *
 * Idempotently creates the metaobject DEFINITIONS the homepage sections read
 * (service, app, faq, faq_category), adds new FIELDS to the store's existing
 * `client` and `quote` definitions, and seeds ENTRIES for FAQ only.
 *
 * Zero dependencies (Node >= 20, uses native fetch). Reads credentials from the
 * environment — run with `node --env-file=scripts/.env scripts/ca-metaobjects.mjs`.
 *
 * Auth: Dev Dashboard app client-credentials grant. The script exchanges
 *   SHOPIFY_API_KEY + SHOPIFY_API_SECRET at /admin/oauth/access_token for a
 *   24h access token. (Set SHOPIFY_ADMIN_TOKEN to skip the exchange.)
 *
 * SAFETY: dry-run by default — prints what it WOULD do and mutates nothing.
 *   Pass --apply to actually create/update. Re-running with --apply is safe
 *   (existing definitions/fields/entries are detected and skipped).
 *
 * Usage:
 *   node --env-file=scripts/.env scripts/ca-metaobjects.mjs            # dry run
 *   node --env-file=scripts/.env scripts/ca-metaobjects.mjs --apply    # write
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const APPLY = process.argv.includes('--apply');
const MODE = APPLY ? 'APPLY' : 'DRY-RUN';

// ---------------------------------------------------------------------------
// Small logging helpers
// ---------------------------------------------------------------------------
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const log = (...a) => console.log(...a);
const step = (msg) => log(`\n${c.bold(c.cyan('▸ ' + msg))}`);
const ok = (msg) => log(`  ${c.green('✓')} ${msg}`);
const skip = (msg) => log(`  ${c.dim('•')} ${c.dim(msg)}`);
const would = (msg) => log(`  ${c.yellow('~')} ${c.yellow('would ' + msg)}`);
const fail = (msg) => log(`  ${c.red('✗')} ${msg}`);

function die(msg) {
  console.error(`\n${c.red('ERROR:')} ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
function normalizeStore(raw) {
  if (!raw) return '';
  return raw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

const STORE = normalizeStore(process.env.SHOPIFY_STORE_URL);
const API_KEY = process.env.SHOPIFY_API_KEY?.trim();
const API_SECRET = process.env.SHOPIFY_API_SECRET?.trim();
const DIRECT_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN?.trim();

if (!STORE) die('SHOPIFY_STORE_URL is not set (expected e.g. your-store.myshopify.com).');
if (!DIRECT_TOKEN && (!API_KEY || !API_SECRET)) {
  die('Set SHOPIFY_API_KEY + SHOPIFY_API_SECRET (or SHOPIFY_ADMIN_TOKEN) in scripts/.env.');
}

// ---------------------------------------------------------------------------
// Auth — client credentials grant
// ---------------------------------------------------------------------------
async function getAccessToken() {
  if (DIRECT_TOKEN) {
    ok('Using SHOPIFY_ADMIN_TOKEN from env (skipping token exchange).');
    return DIRECT_TOKEN;
  }
  const url = `https://${STORE}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: API_KEY,
    client_secret: API_SECRET,
  });
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (e) {
    die(`Could not reach ${url} — ${e.message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    die(
      `Token exchange failed (HTTP ${res.status}).\n` +
        `Response: ${text}\n\n` +
        `Checklist: app installed on ${STORE}, app+store in the same org, ` +
        `and the app version has the metaobject/file scopes.`
    );
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`Token endpoint did not return JSON: ${text}`);
  }
  if (!json.access_token) die(`No access_token in response: ${text}`);
  ok(`Got access token (scopes: ${json.scope || 'n/a'}; expires in ${json.expires_in || '?'}s).`);
  return json.access_token;
}

// ---------------------------------------------------------------------------
// GraphQL client
// ---------------------------------------------------------------------------
let ADMIN_TOKEN = null;
let API_VERSION = '2025-01';

async function gql(query, variables = {}) {
  const url = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) {
      const wait = 500 * attempt;
      log(c.dim(`  (HTTP ${res.status}, retrying in ${wait}ms…)`));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      die(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`);
    }
    if (json.errors) {
      const throttled = JSON.stringify(json.errors).includes('THROTTLED');
      if (throttled && attempt < 5) {
        const wait = 700 * attempt;
        log(c.dim(`  (throttled, retrying in ${wait}ms…)`));
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      die(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
    }
    return json.data;
  }
  die('Exhausted retries talking to the Admin API.');
}

/** Throw on non-empty userErrors from a mutation payload. */
function assertNoUserErrors(payload, label) {
  const errs = payload?.userErrors || [];
  if (errs.length) {
    fail(`${label} returned userErrors:`);
    log(JSON.stringify(errs, null, 2));
    throw new Error(`${label} failed`);
  }
}

// ---------------------------------------------------------------------------
// Rich text — convert an array of paragraph strings to Shopify rich_text JSON
// ---------------------------------------------------------------------------
function toRichText(paragraphs) {
  const arr = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  return JSON.stringify({
    type: 'root',
    children: arr.map((p) => ({
      type: 'paragraph',
      children: [{ type: 'text', value: String(p) }],
    })),
  });
}

// ---------------------------------------------------------------------------
// Definition helpers
// ---------------------------------------------------------------------------
const Q_DEF_BY_TYPE = `
  query defByType($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      fieldDefinitions { key }
    }
  }`;

async function getDefinition(type) {
  const data = await gql(Q_DEF_BY_TYPE, { type });
  return data.metaobjectDefinitionByType; // null if missing
}

/** Build a MetaobjectFieldDefinition input from our data-file shape. */
function toFieldInput(f, faqDefId) {
  const input = { key: f.key, name: f.name, type: f.type };
  if (f.required) input.required = true;
  const validations = [...(f.validations || [])];
  if (f.referenceType === 'faq') {
    if (!faqDefId) throw new Error('faq definition id required before creating a reference field');
    validations.push({ name: 'metaobject_definition_id', value: faqDefId });
  }
  if (validations.length) input.validations = validations;
  return input;
}

const M_DEF_CREATE = `
  mutation defCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }`;

async function ensureDefinition(def, ctx) {
  const existing = await getDefinition(def.type);
  if (existing) {
    skip(`definition "${def.type}" already exists (${existing.id})`);
    if (def.type === 'faq') ctx.faqDefId = existing.id;
    return existing.id;
  }
  if (!APPLY) {
    would(`create definition "${def.type}" with fields: ${def.fields.map((f) => f.key).join(', ')}`);
    // Use a placeholder id so faq_category dry-run can proceed.
    if (def.type === 'faq') ctx.faqDefId = ctx.faqDefId || 'gid://shopify/MetaobjectDefinition/DRYRUN';
    return null;
  }
  const definition = {
    name: def.name,
    type: def.type,
    access: { storefront: 'PUBLIC_READ' },
    capabilities: { publishable: { enabled: true } },
    displayNameKey: def.displayNameKey,
    fieldDefinitions: def.fields.map((f) => toFieldInput(f, ctx.faqDefId)),
  };
  const data = await gql(M_DEF_CREATE, { definition });
  assertNoUserErrors(data.metaobjectDefinitionCreate, `create ${def.type}`);
  const id = data.metaobjectDefinitionCreate.metaobjectDefinition.id;
  ok(`created definition "${def.type}" (${id})`);
  if (def.type === 'faq') ctx.faqDefId = id;
  return id;
}

const M_DEF_UPDATE = `
  mutation defUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id }
      userErrors { field message code }
    }
  }`;

async function addFields(addition) {
  const existing = await getDefinition(addition.type);
  if (!existing) {
    fail(`existing definition "${addition.type}" not found — cannot add fields (create it in Admin first).`);
    return;
  }
  const have = new Set(existing.fieldDefinitions.map((f) => f.key));
  const missing = addition.fields.filter((f) => !have.has(f.key));
  if (!missing.length) {
    skip(`"${addition.type}" already has: ${addition.fields.map((f) => f.key).join(', ')}`);
    return;
  }
  if (!APPLY) {
    for (const f of missing) would(`add field "${f.key}" (${f.type}) to "${addition.type}"`);
    return;
  }
  const definition = {
    fieldDefinitions: missing.map((f) => ({ create: toFieldInput(f) })),
  };
  const data = await gql(M_DEF_UPDATE, { id: existing.id, definition });
  assertNoUserErrors(data.metaobjectDefinitionUpdate, `add fields to ${addition.type}`);
  for (const f of missing) ok(`added field "${f.key}" to "${addition.type}"`);
}

// ---------------------------------------------------------------------------
// Entry helpers
// ---------------------------------------------------------------------------
const Q_BY_HANDLE = `
  query byHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) { id handle }
  }`;

async function getEntry(type, handle) {
  const data = await gql(Q_BY_HANDLE, { handle: { type, handle } });
  return data.metaobjectByHandle;
}

const M_OBJ_CREATE = `
  mutation objCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }`;

async function createEntry(type, handle, fields) {
  const metaobject = {
    type,
    handle,
    capabilities: { publishable: { status: 'ACTIVE' } },
    fields,
  };
  const data = await gql(M_OBJ_CREATE, { metaobject });
  assertNoUserErrors(data.metaobjectCreate, `create ${type}:${handle}`);
  return data.metaobjectCreate.metaobject.id;
}

const M_OBJ_UPDATE = `
  mutation objUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id }
      userErrors { field message code }
    }
  }`;

async function updateEntryFields(id, fields) {
  const data = await gql(M_OBJ_UPDATE, { id, metaobject: { fields } });
  assertNoUserErrors(data.metaobjectUpdate, `update ${id}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const data = JSON.parse(await readFile(join(__dirname, 'ca-metaobjects-data.json'), 'utf8'));
  API_VERSION = process.env.SHOPIFY_API_VERSION?.trim() || data.apiVersion || API_VERSION;

  log(c.bold(`\nConspire v2.0 · metaobject provisioning  [${MODE}]`));
  log(c.dim(`store=${STORE}  api=${API_VERSION}`));
  if (!APPLY) log(c.yellow('Dry run — nothing will be written. Re-run with --apply to make changes.'));

  step('Authenticating');
  ADMIN_TOKEN = await getAccessToken();

  const ctx = { faqDefId: null };

  // 1) Definitions — faq before faq_category (reference dependency).
  step('Metaobject definitions');
  const order = ['faq', 'faq_category', 'service', 'app'];
  const defByType = Object.fromEntries(data.definitions.map((d) => [d.type, d]));
  for (const type of order) {
    if (defByType[type]) await ensureDefinition(defByType[type], ctx);
  }
  // any definitions not covered by the explicit order
  for (const d of data.definitions) {
    if (!order.includes(d.type)) await ensureDefinition(d, ctx);
  }

  // 2) New fields on existing client / quote definitions.
  step('Fields on existing definitions (client, quote)');
  for (const addition of data.fieldAdditions) await addFields(addition);

  // 3) Seed FAQ entries, then FAQ categories linking to them.
  step('Seed FAQ entries');
  const faqHandleToId = {};
  for (const faq of data.seed.faq) {
    const existing = await getEntry('faq', faq.handle);
    if (existing) {
      faqHandleToId[faq.handle] = existing.id;
      skip(`faq:${faq.handle} exists`);
      continue;
    }
    if (!APPLY) {
      would(`create faq:${faq.handle} — "${faq.question}"`);
      faqHandleToId[faq.handle] = `gid://shopify/Metaobject/DRYRUN-${faq.handle}`;
      continue;
    }
    const id = await createEntry('faq', faq.handle, [
      { key: 'question', value: faq.question },
      { key: 'answer', value: toRichText(faq.answer) },
    ]);
    faqHandleToId[faq.handle] = id;
    ok(`created faq:${faq.handle}`);
  }

  step('Seed FAQ categories');
  for (const cat of data.seed.faq_category) {
    const faqIds = cat.faqs.map((h) => faqHandleToId[h]).filter(Boolean);
    if (faqIds.length !== cat.faqs.length) {
      fail(`category ${cat.handle}: some referenced FAQs missing (${cat.faqs.join(', ')})`);
    }
    const listValue = JSON.stringify(faqIds);
    const existing = await getEntry('faq_category', cat.handle);
    if (existing) {
      if (!APPLY) {
        would(`update faq_category:${cat.handle} faqs → ${faqIds.length} refs`);
      } else {
        await updateEntryFields(existing.id, [
          { key: 'name', value: cat.name },
          { key: 'faqs', value: listValue },
        ]);
        ok(`updated faq_category:${cat.handle} (${faqIds.length} faqs)`);
      }
      continue;
    }
    if (!APPLY) {
      would(`create faq_category:${cat.handle} — "${cat.name}" with ${faqIds.length} faqs`);
      continue;
    }
    await createEntry('faq_category', cat.handle, [
      { key: 'name', value: cat.name },
      { key: 'faqs', value: listValue },
    ]);
    ok(`created faq_category:${cat.handle} (${faqIds.length} faqs)`);
  }

  log(`\n${c.green(c.bold('Done'))} ${c.dim(`(${MODE})`)}`);
  if (!APPLY) log(c.yellow('Re-run with --apply to write these changes.\n'));
  else log('');
}

main().catch((e) => die(e.stack || e.message));
