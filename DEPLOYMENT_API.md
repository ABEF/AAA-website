# Reviewed API profile

The default website remains a simulation. `deployment-config.js` contains:

```js
export const DEPLOYMENT = null;
```

A non-null, independently reviewed configuration selects `read-and-prepare` mode.
It is a build input, not a URL/localStorage/wallet-supplied setting. It enables
confirmed reads and unsigned reviews. Historical schema1/native2/current3
literal-loopback Anvil rehearsals retain their separate local-only submission
path. Source9/schema4 and source10/schema5 are unsigned even on Anvil and never
enter that signer. No profile enables public signing or changes the isolated `/app/`
Anvil deployment or its journals. `integration-config.js` also keeps
`INTEGRATION_DEPLOYMENT = null`.

Read the authoritative [operator configuration and recovery guide](https://github.com/ABEF/AAA/blob/main/docs/DEPLOYMENT_WEBSITE.md)
for exact fields, API proxy paths, CORS/CSP requirements, stop/restart and rollback.
No production addresses, Oracle, route, RPC or fee model are selected by default.

Implementation boundaries:

- `deployment-api.js`: typed GET/POST APIs; pinned chain/anchor/config/runtime,
  canonical age/depth checks; exact calldata, amounts, expiry and gas bounds.
- `deployment-source9.js`: explicit prior V9/schema4/29-pin authentication.
- `deployment-source10.js`: explicit mint2/V10/schema5/33-pin authentication,
  including the immutable mint/helper/renderer/NFT canonical bindings.
- `deployment-source9-data.js`: shared accounting7 physical LP, lifecycle and
  exact financial-data checks; mint profiles are not inferred from DTO shape.
- `deployment-source9-prepare.js`: shared Entry3/review2 and claim/planner
  validation behind exact closed V9/V10 profiles; unsigned even on local Anvil.
- `deployment-session.js`: address authorization and deployment-isolated tab
  restoration; explicit choice for multiple addresses. No transaction methods.
- `deployment-view.js`: holdings, eight-card pagination, matching-block earnings,
  token-unit quotes and unsigned reviews. Missing values remain unavailable.
- `deployment-transactions.js`: local Anvil-only typed review coordination, exact approval continuation, receipt/effect reconciliation and durable recovery. No nonlocal signing.
- `deployment-config.js`: default null; cannot enable public signing.
- `browser-wallet.js` / `browser-client.js`: existing local-only signing; unchanged.

## Local source10 mint2/V10 profile

Website schema5 explicitly selects `source_profile:10`,
`mint_integration_version:2` and accounting7/LP-allocation1/custody5, with canonical
`ZZZ_CANONICAL_SAME_CHAIN_EXACT_LP_SEADROP_V10`. Its33 distinct browser pins are
the prior29 roles plus `seadrop_mint`, `seadrop`, `metadata_renderer` and
`nft_canonical`. Runtime/getter proofs bind NFT.seaDropMint(), helper access/NFT/
SeaDrop/runtime hash, NFT.metadataRenderer(), renderer access(), and the fixed
NFT canonical companion/controller/coordinator slot. Helper capability is1;
the manifest/backend mint profile is2. These are independent version domains.

Holdings, both LP legs, exact rewards/earnings, terminal principal, contribution
quotes, exact approvals and typed unsigned Entry3/claim reviews are supported
locally. Direct mint fails before API or simulation. Protocol mint channel is
OpenSea; actual phase/proof/payer eligibility remains unverified, not false or an
invented available sale. Immutable mint identity failures reject the profile;
mutable sale-price/phase changes do not block healthy LP/reward actions.

The same scoped USD bounds, marginal deployed-LP proof, net/share requirements,
caller limits, expiry and independent final simulation remain. Current LP ETH/ZZZ
and up to65 admitted royalty currencies form at most66 distinct descriptors;
this is separate from the router's32-entry claim count. A reviewed300bps
contribution ceiling permits the new3% default; an independently reviewed200bps
ceiling still rejects300. Gas-policy1/2 selectors remain independent and neither
enables signing. [Profile procedure](https://github.com/ABEF/AAA/blob/main/docs/SOURCE10_WEBSITE_PROFILE.md) and [source evidence](https://github.com/ABEF/AAA/blob/main/reports/v10-website-20261109/REVIEW.md)
do not qualify actual dependencies, browser signing or a public rollout.

## Preserved source9/V9 profile

Website manifest schema4 explicitly selects `source_profile:9`, accounting7,
LP-allocation1, custody5, protocol-policy1, direct Entry-routing3/review2,
pricing2, portfolio2, royalty4/reporting5 and canonical
`ZZZ_CANONICAL_SAME_CHAIN_EXACT_LP_V9`. The browser requires 29 distinct reviewed
runtime roles and independently checks canonical-block versions, module/parent
bindings, fixed Rewards canonical child and both physical LPs. Website manifest,
release inventory and HTTP envelope versions are distinct: core read replies
remain schema2 and earnings/chunk replies schema1. Source8/accounting6/V8 and
served schema3/accounting3/V4 retain their own explicit identities. The newer
[SeaDrop mint2/canonicalV10/schema17 contract candidate](https://github.com/ABEF/AAA/blob/main/docs/OPENSEA_MINT.md)
is not admitted by this source9 manifest. The separate source10/schema5 consumer
supports it locally; old manifests, fixtures and journals are not upgraded.

Contribution inputs are exactly native ETH and fixed deployment ZZZ. Direct
Entry3 encodes the seven-field request plus reviewed maximum loss and scoped
contribution-policy fingerprint; it has no Entry conversion route or output
minimum. Governed minima default to $100 activation/$5 growth; current policy and
stronger pool minima determine each review. Cosmetic thresholds also come from
the authenticated current policy. Original source9 evidence used a2% contribution
budget; the fresh contract default is now3%, conversion1%, maintenance3%. The
manifest's independently reviewed `maximum_contribution_loss_bps` is not widened
by that source change: a200bps ceiling rejects a300bps on-chain cap until separately
re-reviewed. Gas and stricter caller/venue floors remain separate. An exact-amount approval adds no LP; the complete Entry review must be
prepared again after confirmation.

Royalties remain claims in their original currencies after the fixed one-hour
opening window. Exact LP rewards remain ETH/fixed-ZZZ: funded ZZZ awaiting ETH
conversion is shown separately and never added to claimable ETH. Earned,
claimable, claimed and converted amounts remain separate. Terminal ETH/ZZZ
principal is read independently from rewards and earnings; the website does not
prepare principal distribution. Missing history/pricing remains unavailable.

The manifest explicitly selects `transaction_policy_schema:1` or optional2.
Policy1 retains12M/schema1. Policy2 requires a matching backend configuration and
schema2 draft/plan, an operator-reviewed 21,000–64,000,000 cap, the same confirmed
block gas bound and complete20% headroom.

Activation/growth independently use optional `activation_policy_schema:1|2`.
Omission retains schema1 and the unchanged12M budget. Explicit2 requires a
matching activation schema2/configuration identity and fee review. Its network
envelope binds `configured_gas_limit`, `confirmed_block_gas_limit`,
`effective_gas_limit` and `full_twenty_percent_headroom:true`; the effective cap
is the lower of reviewed `limits.gas` and the exact confirmed block limit.
The full rounded-up20% estimate headroom and separate network-fee ceiling must
fit. The controlled fork rehearsal explicitly selected16M; that is not a default
increase or target-chain gas approval. A higher activation ceiling does not widen
claim policy1 beyond12M, and transaction policy2 does not select activation2.

The claim planner preserves every selected entry, accepts at most32 entries with
at most10 trials, validates the next exact batch and requires replanning after confirmation;
there is no automatic queue or submission. Source9 has no signing path, even on
Anvil, and does not enable direct mint or the separately implemented SeaDrop
mint2/V10 mint transaction path. Source10 adds V10 read/unsigned support, while
actual OpenSea onboarding/fees, reviewed configuration and operating acceptance
remain open.

`tests/fixtures/source9-api-v3.json` contains 35 actual Python handler DTOs across
nine public methods against explicitly synthetic RPC/venue/authority/fee data.
The exporter checks exact full-raw/checkpoint2 earnings agreement. Reproduce new
bytes with the contract repository's
`tests_python/export_source9_website_fixtures.py --output <new-json-path>`; output
creation is exclusive and temporary history/configuration paths bind each
generated artifact's identities. That historical JSON file and its Entry3 unit
drafts retain their synthetic scope. See the
[original source9 review](https://github.com/ABEF/AAA/blob/main/reports/source9-website-20261109/REVIEW.md)
for its exact source bindings and retained limits.

The separate [actual Entry3 rehearsal and handoff](https://github.com/ABEF/AAA/blob/main/reports/source9-actual-entry-20261109/REVIEW.md)
records confirmed ETH/ZZZ activation and real backend/website unsigned reviews on
an owned fork. External depth was separately seeded; USD feeds and VRF were
controlled dependencies. Preserve the original depth/gas failures and the exact
reviewed source/configuration pins. This does not qualify public market depth,
independent feeds, extension signing, production providers or operating rollout.
Approval and unsigned review do not change LP or artwork: require the confirmed
Entry receipt and fresh authenticated LP/metadata state. Prepare again after
approval, price/policy changes or expiry; never rewrite or resubmit saved calldata
automatically. The source9 browser remains unsigned throughout.

## Historical adapter evidence

Focused checks, without rerunning unchanged suites:

```sh
node --test tests/deployment-transactions.test.mjs
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

The historical shared signer expansion was rejected by automatic approval review and was not
applied. Public signing, speed-up/cancel handling, full collection aggregation,
production configuration/services and independent release approval remain open.

### Complete wallet totals

The reviewed API now supplies bounded16-NFT summary chunks at one confirmed
block. The client checks the complete ordered inventory and every chunk before
showing wallet-wide attached LP and claimable ETH. Account changes cancel old
reads and reset pagination. Historical wallet earnings and source-token rewards
are not substituted into that ETH total. See the [local runbook](https://github.com/ABEF/AAA/blob/main/docs/LOCAL_API_REHEARSAL.md).

## Royalty opening and exact-unit source helpers

Fresh reporting5/settlement4 uses original-currency whole units after final sale end plus1hour. Reporting4/settlement3 remains historical. The client verifies the opening configuration against its confirmed snapshot timestamp and rejects positive locked royalty claims; LP-only claims stay separate. Dormant cards show no deadline. Source9 retains the explicit accounting7/LP1/V9 consumer and source10 separately supports mint2/V10 as described above; it does not relabel historical source8/accounting6/V8 helpers or current3/native2 manifests. Actual runtime/configuration and live operating acceptance remain open. Existing live sites are unchanged. Public signing remains disabled; the shared signer remains Anvil-only.
