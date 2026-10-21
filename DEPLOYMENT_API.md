# Reviewed API profile

The default website remains a simulation. `deployment-config.js` contains:

```js
export const DEPLOYMENT = null;
```

A non-null, independently reviewed configuration selects `read-and-prepare` mode.
It is a build input, not a URL/localStorage/wallet-supplied setting. It enables
confirmed reads and unsigned review only. It does not enable public signing or
change the isolated `/app/` Anvil profile.

Read the authoritative [operator configuration and recovery guide](https://github.com/ABEF/AAA/blob/main/docs/DEPLOYMENT_WEBSITE.md)
for exact fields, API proxy paths, CORS/CSP requirements, stop/restart and rollback.
No production addresses, Oracle, route, RPC or fee model are selected by default.

Implementation boundaries:

- `deployment-api.js`: typed GET/POST APIs; pinned chain/anchor/config/runtime,
  canonical age/depth checks; exact calldata, amounts, expiry and gas bounds.
- `deployment-session.js`: address authorization and deployment-isolated tab
  restoration; explicit choice for multiple addresses. No transaction methods.
- `deployment-view.js`: holdings, eight-card pagination, matching-block earnings,
  token-unit quotes and unsigned reviews. Missing values remain unavailable.
- `deployment-config.js`: default null; cannot enable a signer.
- `browser-wallet.js` / `browser-client.js`: existing local-only signing; unchanged.

Activation targets $100 with a minimal raw-unit round-up at the reviewed Oracle
price. Growth requires at least $5. The review checks the 1% marginal execution
loss bound and displays simulated LP addition and gas separately. An approval
review is the exact contribution amount to Entry; it never changes LP/artwork.
The new profile cannot submit either approval or Entry.

Focused checks, without rerunning unchanged suites:

```sh
node --test tests/deployment-api.test.mjs
node --check deployment-api.js
node --check deployment-session.js
node --check deployment-view.js
node --check app.js
npm run build
```

`tests/fixtures/deployment-api.json` contains eleven actual Python API outputs
from mocked byte-level RPC fixtures. Reproduce them using the contract repository's
`tests_python/export_website_api_fixtures.py --output <external-json-path>`.
Fixtures and headless browser checks do not prove live service or extension
compatibility. [Evidence](https://github.com/ABEF/AAA/blob/main/reports/deployment-adapter/VERIFICATION.md)
records 57 focused checks and eight isolated browser scenarios.

The shared signer expansion was rejected by automatic approval review and was not
applied. Public signing, speed-up/cancel handling, full collection aggregation,
production configuration/services and independent release approval remain open.
