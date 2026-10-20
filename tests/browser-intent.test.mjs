import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedBrowserTransaction, selectedClaims, validateBrowserManifest} from '../browser-intent.js';

const ZERO = '0x' + '0'.repeat(40), EMPTY = '0x' + '0'.repeat(64);
const address = n => '0x' + n.toString(16).padStart(40, '0');
const word = n => BigInt(n).toString(16).padStart(64, '0');
const aw = a => a.slice(2).padStart(64, '0');
const A = address(1), B = address(2), NOW = 1700000000000;
const clone = value => structuredClone(value);
const manifest = () => ({
  schema: 1, mode: 'LOCAL ANVIL TEST ONLY', chain_id: 31337,
  genesis_hash: '0x' + '1'.repeat(64), accounts: [A, B],
  rpc_url: 'http://127.0.0.1:60861', pool: '0x' + '2'.repeat(64),
  contracts: Object.fromEntries(['vault', 'nft', 'entry', 'claim_router'].map((k, i) =>
    [k, {address: address(10 + i), runtime_code: '0x60016000'}])),
  input_assets: [
    {symbol: 'ZZZ', address: address(20), decimals: 18, route_id: EMPTY, enabled: true},
    {symbol: 'USDG', address: address(21), decimals: 6, route_id: '0x' + '3'.repeat(64), enabled: true},
    {symbol: 'USDC', address: address(22), decimals: 6, route_id: '0x' + '4'.repeat(64), enabled: true},
    {symbol: 'ETH', address: ZERO, decimals: 18, route_id: EMPTY, enabled: true},
  ],
  mint_value_wei: '50000000000000000', confirmations: 1, max_gas: 12000000,
  max_gas_price_wei: '100000000000', max_network_fee_wei: '1000000000000000000',
  native_eth_atomic: true,
});
const nft = (id = '7', owner = A, active = false) => ({
  token_id: id, owner, position: {activated: active},
  claimable: {default_settlement: 'native_eth', lp: [], royalties: []},
});
const state = () => ({nfts: [nft()]});
const intent = (action = 'activate', amount = '100', asset = 'ZZZ') => ({
  action, account: A, id: '7', amount, asset,
});
function entryDraft(i = intent(), m = manifest(), overrides = {}) {
  const a = m.input_assets.find(a => a.symbol === i.asset), amount = BigInt(i.amount) * 10n ** BigInt(a.decimals);
  const values = [
    BigInt(i.id), BigInt(m.pool), BigInt(a.address), amount, BigInt(a.route_id),
    a.route_id === EMPTY ? 0n : BigInt(i.amount) * 10n ** 18n * 99n / 100n,
    1n, BigInt(NOW / 1000 + 120), BigInt(i.action === 'increase'),
  ];
  const d = {
    action: i.action, requested_action: i.action, account: i.account, chain_id: 31337,
    contribution: i.amount, contribution_asset: a.symbol,
    transaction: {
      from: i.account, to: m.contracts.entry.address, chainId: '0x7a69',
      data: '0x35b13b87' + values.map(word).join(''), value: a.symbol === 'ETH' ? '0x' + amount.toString(16) : '0x0',
      gas: '0x989680', gasPrice: '0x1', nonce: '0x0',
    },
  };
  return {...d, ...overrides};
}
function approveDraft(i = intent(), m = manifest()) {
  const a = m.input_assets.find(a => a.symbol === i.asset), amount = BigInt(i.amount) * 10n ** BigInt(a.decimals);
  const d = entryDraft(i, m);
  d.action = 'approve';d.approval_raw = amount.toString();d.approval_asset = a.symbol;
  d.transaction.to = a.address;d.transaction.value = '0x0';
  d.transaction.data = '0x095ea7b3' + aw(m.contracts.entry.address) + word(amount);
  return d;
}
function mintDraft(m = manifest()) {
  return {
    action: 'mint', requested_action: 'mint', account: A, chain_id: 31337,
    transaction: {from: A, to: m.contracts.vault.address, data: '0x21bf772d', value: '0xb1a2bc2ec50000', chainId: '0x7a69'},
  };
}
function claimState() {
  const n = nft('7', A, true);
  n.claimable.lp = [{asset: ZERO, raw: '10', symbol: 'ETH', decimals: 18}, {asset: address(20), raw: '100', symbol: 'ZZZ', decimals: 18}];
  n.claimable.royalties = [{asset: ZERO, raw: '5', symbol: 'ETH', decimals: 18}, {asset: address(21), raw: '50', symbol: 'USDG', decimals: 6}];
  return {nfts: [n]};
}
function claimDraft(i, s, m = manifest()) {
  const cs = selectedClaims(s, i);
  return {
    action: 'claim', requested_action: i.action, account: i.account, chain_id: 31337,
    claims: cs.map(c => {
      const row = s.nfts.find(n => n.token_id === c.token_id).claimable[c.royalty ? 'royalties' : 'lp'].find(a => a.asset === c.asset);
      return {...c, symbol: row.symbol, decimals: row.decimals, simulated_raw: row.raw};
    }),
    transaction: {
      from: i.account, to: m.contracts.claim_router.address, value: '0x0', chainId: '0x7a69',
      data: '0xbbeaec93' + word(32) + word(cs.length) +
        cs.map(c => word(c.token_id) + aw(c.asset) + word(c.royalty ? 1 : 0)).join(''),
    },
  };
}
function setEntryWord(d, index, value) {
  const words = d.transaction.data.slice(10).match(/.{64}/g);words[index] = word(value);
  d.transaction.data = '0x35b13b87' + words.join('');
}
const validate = (d, i = intent(), m = manifest(), s = state()) => expectedBrowserTransaction(d, i, m, s, NOW);
const rejects = (d, i = intent(), m = manifest(), s = state()) => assert.throws(() => validate(d, i, m, s));

test('manifest accepts only the explicit bounded loopback deployment profile', () => {
  assert.equal(validateBrowserManifest(manifest()).chain_id, 31337);
  for (const patch of [
    {chain_id: 1}, {mode: 'PRODUCTION'}, {rpc_url: 'https://example.com'},
    {rpc_url: 'http://localhost:60861'}, {accounts: [A, A]}, {confirmations: 0},
    {mint_value_wei: '0'}, {max_gas: 30000001}, {max_gas_price_wei: '0'},
  ]) assert.throws(() => validateBrowserManifest({...manifest(), ...patch}));
});

test('manifest rejects missing runtimes and invalid asset admission', () => {
  const m = manifest();m.contracts.entry.runtime_code = '0x';assert.throws(() => validateBrowserManifest(m));
  for (const edit of [
    m => {m.input_assets[0].decimals = 19;},
    m => {m.input_assets[0].symbol = 'WETH';},
    m => {m.input_assets[0].symbol = 'ETH';},
    m => {m.input_assets[3].address = address(30);},
    m => {m.input_assets[0].route_id = 'bad';},
  ]) {const a = manifest();edit(a);assert.throws(() => validateBrowserManifest(a));}
});

test('manifest rejects zero or aliased core contracts and duplicate input tokens', () => {
  for (const edit of [
    m => {m.contracts.vault.address = ZERO;},
    m => {m.contracts.entry.address = m.contracts.vault.address;},
    m => {m.input_assets[1].address = m.input_assets[0].address;},
    m => {m.input_assets[0].address = ZERO;},
    m => {m.input_assets[0].address = m.contracts.entry.address;},
  ]) {const m = manifest();edit(m);assert.throws(() => validateBrowserManifest(m));}
});

test('mint matches exact Vault selector and exact 0.05 ETH', () => {
  const d = mintDraft(), i = {action: 'mint', account: A};
  assert.equal(validate(d, i).value, '0xb1a2bc2ec50000');
  for (const field of ['to', 'value', 'data']) {
    const b = clone(d);b.transaction[field] = {to: address(99), value: '0x1', data: '0x21bf772d00'}[field];rejects(b, i);
  }
});

test('sender, wallet identity, chain and requested action cannot be rebound', () => {
  for (const mutate of [
    d => {d.account = B;}, d => {d.chain_id = 1;}, d => {d.requested_action = 'increase';},
    d => {d.transaction.from = B;}, d => {d.transaction.chainId = '0x1';},
  ]) {const d = entryDraft();mutate(d);rejects(d);}
  rejects(entryDraft(), {...intent(), account: address(99)});
});

test('exact ERC20 approval approves only requested raw amount to Entry', () => {
  for (const symbol of ['ZZZ', 'USDG', 'USDC']) {
    const i = intent('activate', '100', symbol), d = approveDraft(i), a = manifest().input_assets.find(a => a.symbol === symbol);
    const r = validate(d, i);
    assert.equal(r.to, a.address);assert.equal(r.value, '0x0');
    assert.equal(BigInt('0x' + r.data.slice(-64)), 100n * 10n ** BigInt(a.decimals));
  }
});

test('excessive, reset, wrong spender, wrong token and payable approvals are rejected', () => {
  for (const edit of [
    d => {d.transaction.data = '0x095ea7b3' + aw(manifest().contracts.entry.address) + word(2n ** 256n - 1n);},
    d => {d.transaction.data = '0x095ea7b3' + aw(manifest().contracts.entry.address) + word(0);},
    d => {d.transaction.data = '0x095ea7b3' + aw(address(99)) + word(100n * 10n ** 18n);},
    d => {d.transaction.to = address(99);}, d => {d.transaction.value = '0x1';},
    d => {d.approval_raw = '0';}, d => {d.approval_asset = 'USDG';},
  ]) {const d = approveDraft();edit(d);rejects(d);}
});

test('native ETH never accepts an approval transaction', () => {
  const i = intent('activate', '100', 'ETH'), d = approveDraft(i);
  rejects(d, i);
});

test('native contribution uses exact ETH amount and no ERC20 value', () => {
  const i = intent('activate', '100', 'ETH'), d = entryDraft(i);
  assert.equal(BigInt(validate(d, i).value), 100n * 10n ** 18n);
  d.transaction.value = '0x0';rejects(d, i);
  const token = entryDraft();token.transaction.value = '0x1';rejects(token);
});

test('native contribution requires the native-atomic fixture policy', () => {
  const m = manifest();m.native_eth_atomic = false;
  const i = intent('activate', '100', 'ETH');rejects(entryDraft(i, m), i, m);
});

test('activation accepts exactly 100, top-up accepts 5 through 99999', () => {
  validate(entryDraft());
  const s = state();s.nfts[0].position.activated = true;
  for (const amount of ['5', '8', '99999']) {const i = intent('increase', amount);validate(entryDraft(i), i, manifest(), s);}
  for (const amount of ['99', '101', '99999']) {
    const i = intent('activate', amount);rejects(entryDraft(i), i);
  }
  for (const amount of ['0', '4', '100000', '05', '5.0', '-5', '1e2', ' 5', '5 ']) {
    const i = intent('increase', amount), d = entryDraft(intent('increase', '5'));
    d.contribution = amount;rejects(d, i, manifest(), s);
  }
});

test('activation and top-up require the exact current owner and activation state', () => {
  const active = state();active.nfts[0].position.activated = true;
  rejects(entryDraft(), intent(), manifest(), active);
  const i = intent('increase', '5');rejects(entryDraft(i), i);
  const other = state();other.nfts[0].owner = B;rejects(entryDraft(), intent(), manifest(), other);
  rejects(entryDraft(), intent(), manifest(), {nfts: []});
});

test('top-up value must remain a decimal string without number coercion', () => {
  const i = intent('increase', '5'), d = entryDraft(i), s = state();s.nfts[0].position.activated = true;
  d.contribution = 5;rejects(d, {...i, amount: 5}, manifest(), s);
});

test('disabled and unsupported input assets fail before signing', () => {
  const m = manifest();m.input_assets[0].enabled = false;rejects(entryDraft(), intent(), m);
  rejects(entryDraft(), {...intent(), asset: 'WETH'});
});

test('Entry calldata must match NFT, pool, source, raw amount, route and increase flag', () => {
  for (const [index, value] of [[0, 8n], [1, 1n], [2, BigInt(address(99))], [3, 99n], [4, 1n], [8, 1n]]) {
    const d = entryDraft();setEntryWord(d, index, value);rejects(d);
  }
  const d = entryDraft();d.transaction.to = address(99);rejects(d);
});

test('Entry selector and exact static ABI length exclude extra calls and words', () => {
  for (const edit of [
    d => {d.transaction.data = '0x12345678' + d.transaction.data.slice(10);},
    d => {d.transaction.data += word(1);},
    d => {d.transaction.data = d.transaction.data.slice(0, -2);},
    d => {d.transaction.data = d.transaction.data.slice(0, 10) + 'g'.repeat(576);},
  ]) {const d = entryDraft();edit(d);rejects(d);}
});

test('converted input requires at least 99% local output and at most input value', () => {
  const i = intent('activate', '100', 'USDC'), d = entryDraft(i);
  validate(d, i);
  for (const minimum of [99n * 10n ** 18n - 1n, 100n * 10n ** 18n + 1n]) {
    const bad = clone(d);setEntryWord(bad, 5, minimum);rejects(bad, i);
  }
});

test('Entry minimum liquidity must be positive and fit uint128', () => {
  for (const minimum of [0n, 2n ** 128n]) {
    const d = entryDraft();setEntryWord(d, 6, minimum);rejects(d);
  }
});

test('Entry deadline must be future and at most 180 seconds ahead', () => {
  for (const deadline of [BigInt(NOW / 1000 - 1), BigInt(NOW / 1000), BigInt(NOW / 1000 + 181)]) {
    const d = entryDraft();setEntryWord(d, 7, deadline);rejects(d);
  }
  const edge = entryDraft();setEntryWord(edge, 7, BigInt(NOW / 1000 + 180));validate(edge);
});

test('displayed contribution and approval labels must match intent', () => {
  for (const edit of [d => {d.contribution = '1000';}, d => {d.contribution_asset = 'USDG';}]) {
    const d = entryDraft();edit(d);rejects(d);
  }
});

test('claims independently encode exactly ETH LP plus ETH royalties', () => {
  const s = claimState(), i = {action: 'claim', account: A, id: '7'}, d = claimDraft(i, s);
  assert.deepEqual(selectedClaims(s, i), [
    {token_id: '7', asset: ZERO, royalty: false},
    {token_id: '7', asset: ZERO, royalty: true},
  ]);
  assert.equal(validate(d, i, manifest(), s).data, d.transaction.data);
});

test('claim calldata rejects substituted tokens, NFTs, ledger flags and appended claims', () => {
  const s = claimState(), i = {action: 'claim', account: A, id: '7'}, d = claimDraft(i, s);
  for (const edit of [
    d => {d.transaction.data = d.transaction.data.replace(word(7), word(8));},
    d => {d.transaction.data = d.transaction.data.slice(0, 10 + 3 * 64) + aw(address(20)) + d.transaction.data.slice(10 + 4 * 64);},
    d => {d.transaction.data = d.transaction.data.slice(0, -64) + word(0);},
    d => {d.transaction.data += word(8) + aw(ZERO) + word(0);},
    d => {d.transaction.to = address(99);}, d => {d.transaction.value = '0x1';},
  ]) {const bad = clone(d);edit(bad);rejects(bad, i, manifest(), s);}
});

test('claim display must match the exact selected NFT, currency and ledger entries', () => {
  const s = claimState(), i = {action: 'claim', account: A, id: '7'}, d = claimDraft(i, s);
  for (const edit of [
    d => {d.claims = [];}, d => {d.claims.push(clone(d.claims[0]));},
    d => {d.claims[0].token_id = '8';}, d => {d.claims[0].asset = address(20);},
    d => {d.claims[0].royalty = true;}, d => {d.claims[0].symbol = 'ZZZ';},
    d => {d.claims[0].decimals = 6;}, d => {d.claims.reverse();},
  ]) {const bad = clone(d);edit(bad);rejects(bad, i, manifest(), s);}
});

test('claim simulation display cannot exceed current confirmed balances or use noncanonical raw amounts', () => {
  const s = claimState(), i = {action: 'claim', account: A, id: '7'}, d = claimDraft(i, s);
  for (const amount of ['11', '-1', '1.0', '01', '1e3', '0x1', 1, (2n ** 256n).toString()]) {
    const bad = clone(d);bad.claims[0].simulated_raw = amount;rejects(bad, i, manifest(), s);
  }
  const zero = clone(d);zero.claims[0].simulated_raw = '0';validate(zero, i, manifest(), s);
  const lower = clone(d);lower.claims[0].simulated_raw = '9';validate(lower, i, manifest(), s);
});

test('empty claims and another owner cannot become a prepared claim', () => {
  const s = claimState(), i = {action: 'claim', account: A, id: '7'}, d = claimDraft(i, s);
  const changed = clone(s);changed.nfts[0].owner = B;rejects(d, i, manifest(), changed);
  rejects(d, {...i, id: '8'}, manifest(), s);
  rejects(d, i, manifest(), state());
});

test('claim_all is bounded to ten NFTs and includes only the selected wallet', () => {
  const s = {nfts: Array.from({length: 12}, (_, n) => {
    const item = nft(String(n + 1), n === 0 ? B : A, true);
    item.claimable.lp = [{asset: ZERO, raw: '1', symbol: 'ETH', decimals: 18}];
    item.claimable.royalties = [{asset: ZERO, raw: '1', symbol: 'ETH', decimals: 18}];
    return item;
  })};
  const i = {action: 'claim_all', account: A};
  const claims = selectedClaims(s, i);
  assert.equal(claims.length, 20);assert.equal(claims[0].token_id, '2');assert.equal(claims.at(-1).token_id, '11');
  validate(claimDraft(i, s), i, manifest(), s);
});

test('unknown actions and backend action substitutions cannot be signed', () => {
  const d = entryDraft();
  rejects(d, {...intent(), action: 'transfer'});
  d.action = 'mint';rejects(d);
});
