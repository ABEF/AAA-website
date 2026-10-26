# AAA / ZZZ PoPL website instructions

Reviewed2026-10-26. Read PROJECT_CONTEXT.md and the contract repository's current
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

## Product and interface rules

- Fresh production candidate accepts only native ETH or the fixed deployment ZZZ
  for activation/growth. Minimum$100activation/$5growth, stronger pool minima;
  2%contribution/1%conversion/3%maintenance defaults with governed10%ceilings,
  gas separate and caller minima retained. Actual independent prices/routes
  remain unqualified. Existing example source copy still requires alignment.
- Mint adds no LP or reward eligibility. Intended primary mint is OpenSea,
  buyer0.05ETH gross/net recipient proceeds after actual platform fee; current
  direct mint is not that integration. Website mint is demonstrative.
- Holder cannot redeem LP principal. Current owner inherits unclaimed rights;
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

## Documentation and verification

Current keeper/LP source audit is in the contract repository's
reports/keeper-lp-audit-20261026. Health now requires exact loaded-config digest;
typed conversion flags distinguish malformed data from valid disabled controls.
No website signer/policy change follows.354Python passes/5Unix skips and9range
methods are scoped evidence, not a Linux/public-service qualification.


Contract TODO.md generated from docs/project-todo.json is the single task list.
Maintain source-linked features/operator/roadmap/release/context there; no website
Todo page. Keep concise current docs, not another dated preamble on every change.
Run useful affected checks; reuse unchanged evidence only with exact pins and
never combine overlapping counts as a new regression. Production NOT APPROVED:
current3 integration, actual services/feeds/routes/VRF/authorities/OpenSea,
artwork hosting, operating qualification and independent audit remain open.
