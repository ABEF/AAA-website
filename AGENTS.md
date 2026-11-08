# AAA / ZZZ PoPL website instructions

Reviewed 2026-11-09. Read PROJECT_CONTEXT.md and the contract repository's current
AGENTS.md/README/Todo/operator guide. This is current guidance, not an append-only
history. Previous memory files are backed up outside Git in the contract-side
documentation-cleanup evidence directory; Git retains every earlier revision.

## Scope and publication

- Website: ABEF/AAA-website, this checkout. Contracts: ABEF/AAA, sibling
  zzz-protocol-v2-reviewed/zzz-protocol-v2. Use main only.
- Keep two explicit public targets: popldemo is the existing demo, poplint is
  current3 integration with its own dist-poplint build, /var/www/popl-integration
  root, Nginx site/certificate and read-only configuration. Never use the demo
  installer/dist/root to publish poplint. See SITE_ENVIRONMENTS.md.
- Current public demo website is a simulation. Do not present demo numbers/buttons
  as deployment or actual revenue. Public DEPLOYMENT remains null; browser
  signing remains Anvil-only. No public payment capability is authorized.
- Preserve existing Anvil services, NFTs/LP/balances/journals, port8902 and dist
  overlay. Historical native2/legacy local profiles are not current3 contracts;
  never relabel/reset them. Staging heartbeat remains paused by user request.
- Website source changes normally follow local implementation/verification,
  website commit/push, then separately authorized server update/verification.
  A contract/docs-only memory commit does not authorize build/server/service or
  public contract transactions/deployment/sealing. Verify actual remote heads.
- Never print or commit keys, credentialed endpoints or passwords. Preserve
  unrelated work. Keep source/evidence/publication/deployment facts distinct.

## Local source9 consumer

Website manifest schema4 explicitly selects source9/accounting7/LP-allocation1/
custody5/Entry3/review2/royalty4/reporting5/canonicalV9. Source9 is a consumer
label, not ACCOUNTING_VERSION9. Verify all 29 reviewed browser runtime roles and
independent canonical-block getters, including fixed Rewards canonical-child
bindings and both physical LPs. Read governed minima and cosmetic thresholds;
never substitute the historical defaults for authenticated current settings.

This profile is unsigned even on Anvil. Keep `DEPLOYMENT` and
`INTEGRATION_DEPLOYMENT` null, the shared signer byte-identical, existing journals
untouched and served current3/popldemo releases unchanged. Source8/accounting6/V8
and older profiles remain explicit historical consumers. Read the
[source9 review](https://github.com/ABEF/AAA/blob/main/reports/source9-website-20261109/REVIEW.md)
before describing local compatibility as operating acceptance.

Keep original-currency royalties, exact ETH/ZZZ LP rewards, pending ZZZ-to-ETH
conversion, earned history, claims and terminal returned principal separate.
Missing values stay unavailable. Transaction-policy selector1/2 must match the
reviewed backend; policy2 never widens policy1 or Entry3 activation implicitly.
Claim planning retains every selected entry and prepares at most the next batch;
there is no automatic queue, submission or retry.

## Product and interface rules

Fresh royalty settlement4 source uses original-currency claims, reporting schema5,
converter:null. The unsigned review includes admitted royalty currencies and
verifies their exact reviewed symbols/decimals/amounts; LP rewards retain their
separate ETH-conversion policy. No royalty swap or WETH unwrap occurs. Historical
profiles remain ETH-focused; never relabel them. This source change is not a
website/server rollout: public DEPLOYMENT stays null and browser signing stays
Anvil-only. Shared browser-wallet.js, existing journals and demo overlays remain
unchanged. See the contract repository's last24h-audit-20261105 evidence and
operator guide for current settings/claims/initial16 / reviewed64-ERC20 currency capacity.


- Fresh production candidate accepts only native ETH or the fixed deployment ZZZ
  for activation/growth. Default minima$100activation/$5growth, governed future
  minima and stronger pool minima;
  2%contribution/1%conversion/3%maintenance defaults with governed10%ceilings,
  gas separate and caller minima retained. Actual independent prices/routes
  remain unqualified. Existing example source copy still requires alignment.
- Mint adds no LP or reward eligibility. Intended primary mint is OpenSea,
  buyer0.05ETH gross/net recipient proceeds after actual platform fee; current
  direct mint is not that integration. Website mint is demonstrative.
- Holders cannot redeem principal during normal operation. The fresh accounting7
  contract candidate permits a governance-triggered terminal ETH+ZZZ return to
  current holders, retaining NFT transfers/royalties/earned rewards. Do not label
  the older served current3 artifact as implementing that lifecycle.
  Current owner inherits unclaimed rights;
  LP rewards are individual shares+equal activated collective, royalties use
  separate rarity1/2/3. No Power. Do not include compound/buyback/gross intake
  in NFT claimable totals or count claims/conversions twice.
- Preserve dark visual style and accepted egg texture. Do not regenerate assets
  merely to recolor them. Artwork has four mapped evolutions per immutable
  rarity/palette/pattern; preload and change only after actual confirmed LP.
- Show per-NFT pending artwork only for that NFT's actual contribution, not
  every portfolio refresh/claim. Never update before pool execution confirms.
  ACTI full sound for activation, EV for other upgrades, synchronized with the
  image change. Respect browser audio policy and reduced-motion preferences.
- Cards: centered attached LP/rewards; one total Rewards to claim, separate
  net24h/all-time earned history, detailed breakdown. Rarity bold; palette names
  colored with their own colors. No visible circuit-pattern trait in cards.
  Image opens breakdown; Claim and Grow attached LP are separate actions.
- Current3 integration must explicitly match actual runtime/profile/data. Keep
  missing prices/history unavailable; distinguish lifetime earned, claimable
  and lifetime claimed. Recovery preserves exact saved intents/transaction
  hashes; no automatic resend or duplicate confirmed approvals.
- Keep GitHub links/Todo UI removed. Footer social icons remain product-facing.
  Demo default positions retain one dormant, two enhanced and one singularity
  with distinct colors and useful claimable examples; rarity is not evolution.

Static artwork reference metadata now keeps fixed rarity weight1/2/3 separate
from activation eligibility. Generator/preview and2784reference descriptions were
published at cae44a1d; 696 dormant traits changed from 0 to 1/2/3. The 72 historical references,
all2784SVG image hashes, manifest, effective demo accounting, signer and null
public configurations are unchanged. Three focused metadata methods and syntax
checks pass. No asset regeneration/build/deployment/service/Anvil action.
See the contract [whole-project execution](https://github.com/ABEF/AAA/blob/main/reports/whole-project-execution-20261029/REVIEW.md).
That metadata-only correction did not implement the separate accounting6 consumer
or qualify marketplace/hosting.

## Documentation and verification

Current contract source is [accounting7/LP-allocation1/portfolio2/custody5/Entry3/royalty4/V9](https://github.com/ABEF/AAA/blob/main/docs/POSITION_V7.md),
with schema16 release inventory. The local website source9 consumer is separate
from the served accounting3 integration and preserved Anvil profiles. Historical
source8/accounting6/V8 evidence remains source-scoped; it is not fresh7 acceptance.
Actual reviewed configuration, services, providers, gas, wallets and rollout
remain open. Local source changes alter no running environment.

The source9 fixture exporter produced 35 actual handler DTOs across nine public
methods using explicitly synthetic RPC/venue/authority/fee data, including exact
raw/checkpoint2 earnings comparisons. This is consumer compatibility evidence,
not live data or EVM execution. Entry3 review tests use typed synthetic drafts;
no complete actual Entry3 trace fixture is claimed. Do not convert these DTO
counts into a final test count or combine them with historical test stages.

The contract repository's docs/project-todo.json generates its sole TODO.md.
No website Todo page. Keep feature/operator/roadmap/release/context there current;
preserve historical report bytes and exact source/evidence scope. User-declined
sale-rights UI is Not planned, not implemented.

Current3 website evidence is in contract reports/current3-website-20261026:
451affected JS passes (46new included),7separate integration checks and3browser
cases; actual Python DTO code uses synthetic dependencies. Poplint serving/TLS
and demo-preservation checks are separate observations, not real API/provider,
extension, market or audit approval. Preserve Anvil-only signer, legacy journals
and null unconfigured integration; public signing remains disabled.

Run useful affected checks and reuse unchanged evidence only with exact pins;
do not add overlapping counts or repeat whole suites for docs. Production remains
NOT APPROVED: actual current contracts/API/feeds/routes/VRF/authorities/OpenSea,
metadata hosting, gas/operating qualification and independent audit remain open.

Fresh royalty4 source uses reporting5: sale closing time plus a fixed1-hour
activation window; original-currency claims stay locked until then. Source-only,
no site/service/signer change. Reporting3 remains historical royalty2; reporting4 remains historical royalty3.

Do not display the royalty deadline on dormant NFT cards (user preference).

Fresh royalty4 allocates whole original units with GCD-normalized rotating rarity tickets. Fresh LP-allocation1 separately preserves exact whole-unit LP books and phase; historical accounting6 fractions retain their original meaning. No royalty swap or unwrap occurs. Source9 read/unsigned support does not relabel served current3 manifests or qualify a live integration. The default optional royalty sync ceiling is1m gas; actual capacity/gas qualification remains open. No dormant deadline notice.

Fresh contract source now includes governance-only same-main residual consolidation; automatic keeper actions and the served website are unchanged. Use the contract operator guide; this documentation does not add a website transaction or rollout.
