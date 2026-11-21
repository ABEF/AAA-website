// NEW ownership-page adoption checks only. No historical test file is imported.
// Responses and RPC state are synthetic. Most wire cases isolate native graph
// and card validation; a separate constructor/native-graph/NFT case composes the
// production readers with saved DTOs. Transport, assembly and provenance use
// production DeploymentAPI methods. No network, signer,
// services, site build or EVM execution is needed or qualified by this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DeploymentAPI} from '../deployment-api.js';
import {FRESH_CANONICAL_SCHEMA} from '../deployment-source9.js';
import {SOURCE10_CANONICAL_SCHEMA} from '../deployment-source10.js';
import {source10APISetup} from './helpers/source10-api-fixture.mjs';
const address = n => '0x' + BigInt(n).toString(16).padStart(40, '0');
const hash = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
const hex = n => '0x' + BigInt(n).toString(16);
const clone = value => structuredClone(value);
const digest = ids => createHash('sha256').update(ids.join(','), 'ascii').digest('hex');
const OWNER = address(30), OTHER = address(31), BLOCK = 99, TIME = 4000;
const tick = () => new Promise(resolve => queueMicrotask(resolve));

function fixture({count = 17, source = 10, mutate = () => {}, status = 200, onFetch = async () => {}} = {}) {
  const fresh = source === 9 || source === 10;
  const ids = Array.from({length: count}, (_, i) => ((1n << 255n) + BigInt(i + 1)).toString());
  const manifest = {
    schema: source === 10 ? 5 : source === 9 ? 4 : source,
    chain_id: 31337, deployment_block: 1, deployment_block_hash: hash(1),
    genesis_hash: hash(12), confirmations: 2, max_age_seconds: 120,
    api_prefix: '/api', projection_sha256: 'a'.repeat(64),
    contracts: {nft: {address: address(2)}},
    accounting_version: fresh ? 7 : source,
    ...(source === 9 ? {source_profile: 9, canonical_schema: FRESH_CANONICAL_SCHEMA} : {}),
    ...(source === 10 ? {source_profile: 10, mint_integration_version: 2, canonical_schema: SOURCE10_CANONICAL_SCHEMA} : {}),
  };
  const anchor = {
    block_number: BLOCK, block_hash: hash(99), block_timestamp: TIME,
    observed_head: BLOCK + 1, confirmations: 2,
    finality: 'confirmation_depth_only', protocol_finalized: false,
    eip1898_require_canonical: true, configuration_sha256: manifest.projection_sha256,
    accounting_version: manifest.accounting_version,
  };
  const history = {
    available: true, from_block: 1, start_block_hash: hash(1), start_parent_hash: hash(0),
    through_block: BLOCK, block_hash: anchor.block_hash, indexer_next_block: BLOCK + 2,
    logs_examined: count, claim_events: 0, royalty_conversion_events: 0,
    lp_conversion_events: 0, minted_count: count,
    scope: 'Synthetic complete ingestion fixture; no actual indexer or provider.',
    completeness: 'Synthetic operator-maintained ingestion; no cryptographic completeness proof.',
  };
  const lifecycle = {
    state: 'operating', state_code: 0, handoff_phase: 'idle', preparation_active: false,
    paused: false, origin: {chain_id: manifest.chain_id, vault: address(3)}, origin_available: true,
    predecessor_controller: null, successor_controller: null, handoff_destination_controller: null,
    peer_deployments_verified: false, claims_available_by_lifecycle: true,
    transfers_available_by_lifecycle: true, new_economic_work_available_by_lifecycle: true,
    scope: 'Synthetic confirmed same-chain lifecycle; no actual graph or peer acceptance.',
    lp_exit_started: false, lp_exit_phase_code: 0, lp_exit_phase: 'operating',
  };
  const state = {
    manifest, anchor, history, lifecycle, ids, requests: [], rpc: [], proofs: [], cards: [],
    activeRequests: 0, maximumRequests: 0, headerReads: 0, identities: 0,
    currentHash: anchor.block_hash, currentHead: BLOCK + 1,
  };
  const api = Object.create(DeploymentAPI.prototype);
  Object.assign(api, {manifest, origin: 'http://127.0.0.1:4190', clock: () => TIME * 1000, revision: 0, active: null});
  state.api = api;
  api.reader = {async request({method, params = []}) {
    state.rpc.push({method, params});
    assert.doesNotMatch(method, /send|sign|nonce|trace|anvil/i);
    if (method === 'eth_blockNumber') return hex(state.currentHead);
    if (method === 'eth_getBlockByNumber' && params[0] === hex(BLOCK)) {
      state.headerReads++;
      return {number: hex(BLOCK), hash: state.currentHash, timestamp: hex(TIME)};
    }
    throw Error('Unexpected synthetic RPC: ' + method + ' ' + JSON.stringify(params));
  }};
  // This seam represents an already authenticated immutable graph. The real
  // provenance() still verifies chain header, timestamp and confirmation depth.
  api.native = source === 1 ? null : {async verify(pinned) {
    assert.deepEqual(pinned, {blockHash: anchor.block_hash, requireCanonical: true});
    state.proofs.push(clone(pinned));
  }};
  api.protocol = async signal => {
    assert.equal(signal?.aborted ?? false, false);
    await api.provenance(anchor);
    return {schema: 2, chain_id: manifest.chain_id, provenance: clone(anchor), lifecycle: clone(lifecycle)};
  };
  api.identity = async () => { state.identities++; };
  api.nft = async (id, owner, signal) => {
    assert.equal(signal?.aborted ?? false, false);
    state.cards.push(id);
    return {token_id: id, owner, provenance: clone(anchor)};
  };
  state.page = offset => {
    const selected = ids.slice(offset, offset + 16);
    return {
      schema: 1, kind: 'fixed_block_wallet_inventory_page', chain_id: manifest.chain_id,
      wallet: OWNER, nft_contract: manifest.contracts.nft.address, available: true,
      lifecycle: clone(lifecycle), count, offset, verified_count: selected.length,
      chunk_size: 16, token_ids: selected,
      next_offset: offset + selected.length < count ? offset + selected.length : null,
      inventory_sha256: digest(ids), complete: offset === 0 && selected.length === count,
      provenance: clone(anchor), history: clone(history),
      scope: 'Synthetic ownership-page fixture only.',
    };
  };
  api.fetcher = async (url, options = {}) => {
    const path = new URL(url).pathname.replace(/^\/api/, '');
    state.requests.push({path, signal: options.signal});
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    state.activeRequests++;
    state.maximumRequests = Math.max(state.maximumRequests, state.activeRequests);
    try {
      await tick();
      await onFetch(path, options, state);
      if (path.endsWith('/earnings')) return new Response('{}', {status: 503});
      if (path === '/v1/wallets/' + OWNER + '/nfts') {
        if (fresh) throw Error('Fresh ownership must never fall back to the complete legacy endpoint');
        return new Response(JSON.stringify({schema: 2, chain_id: manifest.chain_id,
          wallet: OWNER, nft_contract: manifest.contracts.nft.address, available: true,
          count, token_ids: clone(ids), provenance: clone(anchor), history: clone(history), lifecycle: clone(lifecycle)}));
      }
      const match = path.match(/^\/v1\/wallets\/(0x[0-9a-f]{40})\/nfts\/([0-9]+)\/([0-9]+)$/);
      if (!match) throw Error('Unexpected synthetic request: ' + path);
      assert.equal(match[1], OWNER);
      assert.equal(match[2], String(BLOCK));
      const offset = Number(match[3]), page = state.page(offset);
      await mutate(page, offset, state);
      return new Response(JSON.stringify(page), {status});
    } finally { state.activeRequests--; }
  };
  state.inventory = options => {
    state.requestedAnchor = clone(anchor);
    return api.walletInventory(OWNER, state.requestedAnchor, options);
  };
  state.pagePaths = () => state.requests.filter(r => /\/nfts\/[0-9]+\/[0-9]+$/.test(r.path)).map(r => r.path);
  return state;
}

test('NEW: 1000 full-width NFTs assemble from 63 contiguous same-anchor pages with at most two in flight', async () => {
  const s = fixture({count: 1000}), result = await s.inventory();
  assert.equal(result.schema, 2);
  assert.equal(result.available, true);
  assert.equal(result.count, 1000);
  assert.equal(result.wallet, OWNER);
  assert.deepEqual(result.token_ids, s.ids);
  assert.deepEqual(result.provenance, s.anchor);
  assert.equal(s.pagePaths().length, 63);
  assert.deepEqual(s.pagePaths().map(p => Number(p.split('/').at(-1))), Array.from({length: 63}, (_, i) => i * 16));
  assert.equal(s.maximumRequests, 2);
  assert.equal(s.cards.length, 0);
  assert.ok(s.proofs.length >= 64);
});

test('NEW: a constructed source10 consumer composes native graph, synthetic ownership page and real NFT validation', async () => {
  // The saved current producer fixture supplies synthetic RPC and actual saved
  // handler DTOs. Only the new ownership page is synthesized from that inventory.
  // The constructed API's protocol/native/nft/provenance methods are unmodified.
  const s = source10APISetup('checkpoint2_earnings'), inventory = s.f.outputs.inventory;
  const pagePaths = [], legacyPath = '/v1/wallets/' + inventory.wallet + '/nfts';
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname.replace(/^\/api/, '');
    if (path === legacyPath) throw Error('Fresh composition must not request the legacy complete inventory');
    if (path === legacyPath + '/' + inventory.provenance.block_number + '/0') {
      pagePaths.push(path);
      return new Response(JSON.stringify({...clone(inventory), schema: 1,
        kind: 'fixed_block_wallet_inventory_page', offset: 0, chunk_size: 16,
        verified_count: inventory.count, next_offset: null, complete: true,
        inventory_sha256: digest(inventory.token_ids),
        scope: 'NEW synthetic ownership page derived from saved current producer inventory.'}));
    }
    return s.fetcher(url, options);
  };
  const api = new DeploymentAPI(s.m, {origin: 'http://127.0.0.1:4190', reader: s.reader,
    fetcher, clock: () => s.now});
  const result = await api.portfolio(inventory.wallet);
  assert.equal(pagePaths.length, 1);
  assert.equal(result.inventory.count, inventory.count);
  assert.deepEqual(result.inventory.token_ids, inventory.token_ids);
  assert.equal(result.nfts.length, inventory.count);
  for (const n of result.nfts) {
    const saved = s.f.outputs.nfts[n.token_id];
    assert.equal(n.owner, saved.owner);
    assert.deepEqual(n.position, saved.position);
    assert.deepEqual(n.claimable, saved.claimable);
  }
  assert.ok(s.calls.some(c => c.method === 'eth_getCode' && c.params[0] === s.m.contracts.metadata_renderer.address));
  assert.ok(s.calls.some(c => c.path === '/v1/nfts/' + inventory.token_ids[0]));
  assert.ok(s.replySources.includes('produced'));
  assert.equal(s.calls.some(c => c.method && /send|sign|nonce|trace|anvil/i.test(c.method)), false);
});

for (const count of [0, 16, 17]) test('NEW: ' + count + ' NFTs require every page before a complete inventory returns', async () => {
  const s = fixture({count}), result = await s.inventory();
  assert.equal(result.count, count);
  assert.deepEqual(result.token_ids, s.ids);
  assert.equal(s.pagePaths().length, Math.max(1, Math.ceil(count / 16)));
  if (count === 17) assert.equal(s.page(16).complete, false);
});

for (const source of [9, 10]) test('NEW: source' + source + ' portfolio adopts ownership pages before requesting its eight cards', async () => {
  const s = fixture({source, count: 1000, onFetch: async (path, _options, state) => {
    if (/\/nfts\/[0-9]+\/[0-9]+$/.test(path)) assert.equal(state.cards.length, 0);
  }});
  const result = await s.api.portfolio(OWNER, 124);
  assert.equal(result.inventory.count, 1000);
  assert.deepEqual(result.inventory.token_ids, s.ids);
  assert.deepEqual(s.cards, s.ids.slice(992, 1000));
  assert.equal(s.pagePaths().length, 63);
  assert.equal(s.requests.some(r => r.path === '/v1/wallets/' + OWNER + '/nfts'), false);
  assert.equal(s.identities, 2);
});

for (const source of [1, 2, 3]) test('NEW: legacy schema' + source + ' portfolio retains its complete endpoint and never selects pages', async () => {
  const s = fixture({source, count: 17}), result = await s.api.portfolio(OWNER);
  assert.deepEqual(result.inventory.token_ids, s.ids);
  assert.equal(s.requests.filter(r => r.path === '/v1/wallets/' + OWNER + '/nfts').length, 1);
  assert.deepEqual(s.pagePaths(), []);
});

const defects = [
  ['duplicate ID within a page', p => { p.token_ids[1] = p.token_ids[0]; }],
  ['duplicate ID across pages', (p, _offset, s) => { p.token_ids[0] = s.ids[15]; }],
  ['missing returned ID', p => { p.token_ids.pop(); }],
  ['reversed page order', p => { p.token_ids.reverse(); }],
  ['noncanonical decimal ID', p => { p.token_ids[0] = '0' + p.token_ids[0]; }],
  ['zero ID', p => { p.token_ids[0] = '0'; }],
  ['uint256-overflow ID', p => { p.token_ids[0] = (1n << 256n).toString(); }],
  ['changed count', p => { p.count++; }],
  ['changed owner', p => { p.wallet = OTHER; }],
  ['changed chain', p => { p.chain_id++; }],
  ['changed NFT contract', p => { p.nft_contract = address(88); }],
  ['wrong page schema', p => { p.schema = 2; }],
  ['wrong page kind', p => { p.kind = 'complete_wallet'; }],
  ['unavailable page', p => { p.available = false; }],
  ['wrong verified count', p => { p.verified_count--; }],
  ['wrong chunk size', p => { p.chunk_size = 32; }],
  ['replayed page offset', p => { p.offset = 0; }],
  ['premature end cursor', p => { p.next_offset = null; }],
  ['skipped next cursor', p => { p.next_offset += 16; }],
  ['multi-page complete flag', p => { p.complete = true; }],
  ['changed inventory digest', p => { p.inventory_sha256 = 'b'.repeat(64); }],
  ['changed block number', p => { p.provenance.block_number--; }],
  ['changed block hash', p => { p.provenance.block_hash = hash(98); }],
  ['changed block timestamp', p => { p.provenance.block_timestamp--; }],
  ['changed configuration identity', p => { p.provenance.configuration_sha256 = 'b'.repeat(64); }],
  ['missing accounting profile', p => { delete p.provenance.accounting_version; }],
  ['changed accounting profile', p => { p.provenance.accounting_version = 6; }],
  ['lost observed confirmation depth', p => { p.provenance.observed_head = BLOCK; }],
  ['noncanonical provenance flag', p => { p.provenance.eip1898_require_canonical = false; }],
  ['forged protocol finality', p => { p.provenance.protocol_finalized = true; }],
  ['changed finality scope', p => { p.provenance.finality = 'finalized'; }],
  ['unavailable history', p => { p.history.available = false; }],
  ['changed history block', p => { p.history.through_block--; }],
  ['changed history hash', p => { p.history.block_hash = hash(98); }],
  ['changed history start block', p => { p.history.from_block = 0; }],
  ['changed history start hash', p => { p.history.start_block_hash = hash(77); }],
  ['changed history start parent', p => { p.history.start_parent_hash = hash(77); }],
  ['history cursor behind the anchor', p => { p.history.indexer_next_block = BLOCK; }],
  ['malformed lifecycle availability', p => { p.lifecycle.new_economic_work_available_by_lifecycle = null; }],
  ['changed valid lifecycle availability', p => { p.lifecycle.new_economic_work_available_by_lifecycle = false; }],
  ['changed lifecycle state', p => { p.lifecycle.state = 'frozen'; p.lifecycle.state_code = 1; }],
];
for (const [label, change] of defects) test('NEW: ' + label + ' rejects the whole ownership result before cards', async () => {
  const s = fixture({count: 33, mutate: (p, offset, state) => { if (offset === 16) change(p, offset, state); }});
  await assert.rejects(s.api.portfolio(OWNER));
  assert.deepEqual(s.cards, []);
  assert.equal(s.requests.some(r => r.path === '/v1/wallets/' + OWNER + '/nfts'), false);
});

test('NEW: a consistent but false full-inventory digest is rejected after all pages', async () => {
  const s = fixture({mutate: p => { p.inventory_sha256 = 'b'.repeat(64); }});
  await assert.rejects(s.inventory());
  assert.equal(s.pagePaths().length, 2);
});

test('NEW: fewer than advertised IDs on the final page is never a complete wallet', async () => {
  const s = fixture({count: 17, mutate: (p, offset) => { if (offset === 16) { p.token_ids = []; p.verified_count = 0; } }});
  await assert.rejects(s.inventory());
});

test('NEW: history ingestion cursor and counters may advance while its exact start and target stay anchored', async () => {
  const s = fixture({count: 33, mutate: (p, offset) => {
    p.history.indexer_next_block += offset;
    p.history.logs_examined += offset;
    p.history.claim_events += offset;
  }});
  assert.deepEqual((await s.inventory()).token_ids, s.ids);
});

test('NEW: semantically identical lifecycle objects with reordered flat and nested keys are accepted', async () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  const s = fixture({count: 17, mutate: p => { p.lifecycle = reorder(p.lifecycle); }});
  const result = await s.api.portfolio(OWNER);
  assert.deepEqual(result.inventory.lifecycle, s.lifecycle);
  assert.equal(result.inventory.count, 17);
});

test('NEW: a first ownership page whose lifecycle differs from the protocol anchor is rejected', async () => {
  const s = fixture({mutate: (p, offset) => { if (offset === 0) p.lifecycle.origin.vault = address(77); }});
  await assert.rejects(s.api.portfolio(OWNER));
  assert.deepEqual(s.cards, []);
  assert.equal(s.pagePaths().length, 1);
});

test('NEW: mutating the caller anchor while its first page is pending cannot retarget ownership reads', async () => {
  const s = fixture({count: 17, onFetch: async (path, _options, state) => {
    if (path.endsWith('/0')) {
      state.requestedAnchor.block_number = BLOCK + 1;
      state.requestedAnchor.block_hash = hash(98);
      state.requestedAnchor.configuration_sha256 = 'b'.repeat(64);
    }
  }});
  const result = await s.inventory();
  assert.deepEqual(result.provenance, s.anchor);
  assert.deepEqual(result.token_ids, s.ids);
  assert.ok(s.pagePaths().every(path => path.includes('/nfts/' + BLOCK + '/')));
});

test('NEW: out-of-order pair completion retains inventory offset order', async () => {
  let release;
  const earlier = new Promise(resolve => { release = resolve; });
  const completed = [];
  const s = fixture({count: 33, onFetch: async path => {
    if (path.endsWith('/16')) await earlier;
  }, mutate: (_p, offset) => {
    completed.push(offset);
    if (offset === 32) release();
  }});
  const result = await s.inventory();
  assert.deepEqual(completed, [0, 32, 16]);
  assert.deepEqual(result.token_ids, s.ids);
  assert.equal(s.maximumRequests, 2);
});

for (const status of [404, 429, 503]) test('NEW: ownership page HTTP ' + status + ' rejects without legacy fallback or card display', async () => {
  const s = fixture({status});
  await assert.rejects(s.api.portfolio(OWNER));
  assert.equal(s.pagePaths().length, 1);
  assert.deepEqual(s.cards, []);
  assert.equal(s.requests.some(r => r.path === '/v1/wallets/' + OWNER + '/nfts'), false);
});

test('NEW: a rejected page read never becomes a cached partial inventory on refresh', async () => {
  let faulted = true;
  const s = fixture({count: 17, mutate: (p, offset) => { if (faulted && offset === 16) p.inventory_sha256 = 'b'.repeat(64); }});
  await assert.rejects(s.api.portfolio(OWNER));
  assert.deepEqual(s.cards, []);
  faulted = false;
  const result = await s.api.portfolio(OWNER);
  assert.deepEqual(result.inventory.token_ids, s.ids);
  assert.deepEqual(s.pagePaths().map(p => Number(p.split('/').at(-1))), [0, 16, 0, 16]);
});

test('NEW: external cancellation after a page discards ownership and stops later requests', async () => {
  const controller = new AbortController();
  const s = fixture({count: 1000, mutate: (_p, offset) => { if (offset === 0) controller.abort(); }});
  await assert.rejects(s.inventory({signal: controller.signal}));
  assert.equal(s.pagePaths().length, 1);
});

test('NEW: an already aborted read starts no ownership request', async () => {
  const s = fixture(), controller = new AbortController();
  controller.abort();
  await assert.rejects(s.inventory({signal: controller.signal}));
  assert.deepEqual(s.pagePaths(), []);
});

test('NEW: a revision change during page reading discards an otherwise valid inventory', async () => {
  const s = fixture({count: 1000, mutate: (_p, offset, state) => { if (offset === 0) state.api.cancel(); }});
  await assert.rejects(s.inventory());
  assert.equal(s.pagePaths().length, 1);
});

test('NEW: failure of one ownership page aborts its in-flight sibling', async () => {
  let notifySibling, siblingAborted = false;
  const siblingStarted = new Promise(resolve => { notifySibling = resolve; });
  const s = fixture({count: 33, onFetch: async (path, options) => {
    if (path.endsWith('/16')) await siblingStarted;
    if (path.endsWith('/32')) {
      notifySibling();
      await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
        siblingAborted = true;
        reject(Error('Synthetic sibling read aborted'));
      }, {once: true}));
    }
  }, mutate: (p, offset) => { if (offset === 16) p.inventory_sha256 = 'b'.repeat(64); }});
  await assert.rejects(s.inventory());
  await tick();
  assert.equal(siblingAborted, true);
  assert.equal(s.pagePaths().length, 3);
});

test('NEW: the remaining snapshot freshness deadline aborts a pending ownership read', {timeout: 2000}, async () => {
  let readAborted = false;
  const s = fixture({onFetch: async (_path, options) => {
    await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      readAborted = true;
      reject(Error('Synthetic ownership read expired'));
    }, {once: true}));
  }});
  // Leave twenty milliseconds on the reviewed anchor, instead of waiting for
  // the ordinary 120-second profile. Initial provenance is still fresh.
  s.api.clock = () => (TIME + s.manifest.max_age_seconds) * 1000 - 20;
  await assert.rejects(s.inventory());
  assert.equal(readAborted, true);
  assert.equal(s.pagePaths().length, 1);
});

test('NEW: a reorg after the last ownership page is rejected by final canonical revalidation', async () => {
  const s = fixture({count: 17});
  const original = s.api.provenance.bind(s.api);
  let capturedAnchor;
  s.api.provenance = async (p, ...rest) => {
    capturedAnchor ??= p;
    if (p === capturedAnchor && s.pagePaths().length === 2) s.currentHash = hash(98);
    return original(p, ...rest);
  };
  await assert.rejects(s.inventory());
  assert.equal(s.pagePaths().length, 2);
});

test('NEW: loss of confirmation depth after the last ownership page rejects the whole result', async () => {
  const s = fixture({count: 17});
  const original = s.api.provenance.bind(s.api);
  let capturedAnchor;
  s.api.provenance = async (p, ...rest) => {
    capturedAnchor ??= p;
    if (p === capturedAnchor && s.pagePaths().length === 2) s.currentHead = BLOCK;
    return original(p, ...rest);
  };
  await assert.rejects(s.inventory());
  assert.equal(s.pagePaths().length, 2);
});
