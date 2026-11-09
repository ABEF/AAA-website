The historical [local API wallet rehearsal](DEPLOYMENT_API.md) supports typed submission/recovery only on local Anvil. The source9 and source10 profiles read and prepare unsigned reviews even on Anvil; the shared signer remains unchanged. Public demo mode remains simulated.

# ZZZ PoPL website

A responsive website and collection application for ZZZ Collection — Proof of Permanent Liquidity. The artwork library uses eight colors, 58 allowed palettes, four circuit patterns, three rarities and four evolutions: 2,784 visual states. The original egg shapes, materials and textures, supplied logo and reference JPEGs are preserved.

## Demo and integration targets

The existing [popldemo](https://www.popldemo.0xwave.com/) remains the public
simulation. [Poplint](https://www.poplint.0xwave.com/) is a separate current3
read/unsigned-review build. Missing reviewed contracts/API displays unconfigured,
never demo holdings. Public signing remains disabled. See
[environment and deployment procedures](SITE_ENVIRONMENTS.md).

## Contract source and served releases

Current contract source is [accounting7/exact LP1/custody5](https://github.com/ABEF/AAA/blob/main/docs/POSITION_V7.md)
with [SeaDrop mint2/canonicalV10/schema17](https://github.com/ABEF/AAA/blob/main/docs/OPENSEA_MINT.md).
The local [source10 consumer](https://github.com/ABEF/AAA/blob/main/docs/SOURCE10_WEBSITE_PROFILE.md) now explicitly supports
website manifest schema5/source_profile10/mint2/canonicalV10 while accounting stays7.
Its33 browser runtime pins include SeaDrop, the mint helper, predeployed metadata
renderer and fixed NFT canonical companion, with independent canonical-block
getter checks. Direct Entry3/review2 and royalty4/reporting5 remain unchanged.
The prior source9 consumer retains manifest schema4/canonicalV9/schema16 and29pins;
its fixtures and saved reviews are not relabeled. See [scope and evidence](https://github.com/ABEF/AAA/blob/main/reports/v10-website-20261109/REVIEW.md). Both profiles read physical LP legs, governed contribution minima and
cosmetic thresholds, exact whole-unit rewards and terminal principal separately.
Original-currency royalties stay separate from fixed-ZZZ LP rewards awaiting ETH
conversion. Optional transaction policy2 and bounded claim planning remain unsigned.
The independent `activation_policy_schema` defaults to1 and the unchanged12M
budget. Explicit policy2 requires a matching backend schema2 configuration,
confirmed-block gas bound and full20% headroom. Claim policy1 keeps its12M cap,
even when an explicitly reviewed activation ceiling is higher.

Neither source profile has a submission path, including on Anvil. Both public
configuration exports remain null, and the shared signer is unchanged. The served
poplint artifact remains historical current3 and unconfigured; popldemo remains
the existing simulation. Source8/accounting6/V8 and earlier manifests, runtimes
and journals retain their own identities. The separate
[controlled Entry3 rehearsal](https://github.com/ABEF/AAA/blob/main/reports/source9-actual-entry-20261109/REVIEW.md)
records actual ETH/ZZZ activation and unsigned HTTP/RPC reviews on an owned fork.
It uses separately seeded external liquidity and controlled USD feeds/VRF;
it does not qualify public market depth, independent feeds, extension signing or
production operation. Actual services, wallets and rollout remain open. Keep the
[original source9 review](https://github.com/ABEF/AAA/blob/main/reports/source9-website-20261109/REVIEW.md)
and [API profile](DEPLOYMENT_API.md) at their own evidence scopes.

## Published demo

The public site remains a simulation; historical local browser-signing
rehearsals are separate profiles. Preserve the existing port8902 setup and its
original deployments/journals; this documentation does not start or relabel it. The reviewed API adapter is disabled in the public build.
[Publication checks](https://github.com/ABEF/AAA/blob/main/reports/deployment-adapter/PUBLICATION.md)
record the current server/public bytes and remaining production boundaries.

## Reviewed API integration - 2026-10-21

A separate build-configured profile reads confirmed holdings and prepares unsigned
mint, exact approval, activation/growth and ETH-claim reviews against the existing
APIs. It accepts ordinary authorized accounts, uses real token-unit price quotes,
and verifies reviewed deployment/config/runtime/calldata/LP/gas bounds.

**The shipped `deployment-config.js` remains `DEPLOYMENT = null`.** The public
site continues to simulate financial actions; the existing local browser signer
is unchanged. The new adapter has no send/sign method. See [operator setup](DEPLOYMENT_API.md)
and [focused evidence](https://github.com/ABEF/AAA/blob/main/reports/deployment-adapter/VERIFICATION.md).
Actual public signer integration, extension acceptance and live service/route/feed
qualification remain open.

## Wallet confirmation reads

The shared transaction flow uses the selected extension for authorization/signing
and a deployment-pinned read-only RPC for simulation, balances and confirmation.
Mint, exact approval, activation, LP growth and claims share this boundary.
Approval never changes LP or artwork; confirmed Entry execution and current
on-chain position data are required. Recover saved hashes without resubmitting.
See [scoped evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/CHAIN_READER.md).
The enabled signing profile remains local; production deployment/RPC/route/fee
qualification and actual extension acceptance are still required.

## Browser-wallet integration - 2026-10-20

The disposable contract profile supports **browser-wallet signing** at
`/app/?wallet=browser`. It prepares unsigned mint, exact approval, activation,
LP addition and claim transactions; the extension signs them. Confirmed receipts
and on-chain LP readings control balance/artwork updates. Refresh recovers a saved
transaction hash without sending the payment again.

Run the contract repository's local launcher, then open that URL in Chrome with
a compatible extension and a disposable fixture account. The connection dialog
shows the current RPC and chain ID. See [local integration](LOCAL_INTEGRATION.md)
and the [operator runbook](https://github.com/ABEF/AAA/blob/main/docs/BROWSER_WALLET.md).
The default/public site remains a simulation. Actual extension acceptance, public
deployment pins and qualified production services remain open. The dedicated
10/25/100-user campaign is deferred; production capacity remains unverified.

## Run locally

Requires Git and Node.js 20 or newer. The same commands work on Windows, macOS, and Linux. No third-party dependencies or package installation are needed.

Open a terminal in the directory where you want to clone the project, then run:

```sh
git clone https://github.com/ABEF/AAA-website.git aaa-website
cd aaa-website
npm run dev
```

If you already cloned the project, open a terminal in your clone's root directory (the folder containing `package.json`) and run `npm run dev` there. No particular drive, username, or parent directory is required.

Open `http://127.0.0.1:4173`. Stop the server with Ctrl+C. For a different port, set the `PORT` environment variable in your shell before starting.

## Pages and interactions

- Overview: the opening “Understand PoPL · 26 seconds” button plays the self-hosted, silent explainer in a responsive dialog. Playback starts only on click and stops/resets when closed (including Escape, backdrop click or route change). Native controls support pause, seek and replay; a download link and accessible description are provided. The video is a concept illustration, not evidence of deployed contracts. Overview explains the NFT's attached LP and transferable fee rights through an example position, a contribution diagram and a three-step lifecycle. Selecting the example NFT opens the same position details used by Collection. The LP revenue chart shows the 80/10/5/5 allocation, followed by compact collection LP, 24-hour fees, lifetime fees and pool-volume figures. There are no fee calculators, amount inputs or period controls. NFT-sale royalties have a separate section, followed by the color/evolution guide and seven FAQs that start closed. Small arrow links open Collection and Artwork.
- Collection: starts with exactly $425,000 in example LP across 100 NFTs; 20 are dormant, and three positions exceed $100,000. Shows lifetime and 24-hour gross fees, level composition, a sample activity chart, pool/status/rarity/contained-color/color-style/search filters, sorting, pagination and NFT details. Position details keep attached LP, lifetime fees and 24-hour fees together in one row.
- Artwork: browse 2,784 artwork states by contained color, color style, circuit pattern, rarity and evolution; enlarge each image and download its metadata example. The full rendering library is distinct from the fixed inventory of 1,000 NFTs and the 100 seeded example positions.
- Mint: previews a 0.05 ETH dormant mint within a 1,000-NFT cap (600 Commun, 300 Rare and 100 Legendary). The initial example has 100 minted NFTs with a 60/30/10 rarity mix; later preview mints draw unused full entries from the fixed inventory within remaining rarity quotas. This deterministic simulation is not a VRF request. Each mint creates a dormant NFT with $0 attached LP and no rewards. Minting increases the NFT count, never collection liquidity. Fresh production contributions use native ETH or fixed ZZZ only, defaulting to $100 activation and $5 growth. Some preserved demo/legacy fixtures still show wider example selectors; they are not supported production inputs. Later contributions start at $5 in value and increase the attached LP allocation of that same NFT. The artwork controls explore designs; they do not select mint traits.
- My NFTs: connect an injected browser wallet (EIP-1193/EIP-6963) or the demo wallet to inspect example owned NFTs, attached LP, generated fees and claimable rewards. Individual and bulk simulated claims include separate funded LP and NFT-sale royalty balances, without reducing principal or gross trading fees. Previously claimed is the NFT's lifetime total across LP rewards and royalties, not its latest claim. Activation and LP additions use separate forms that acknowledge the permanent commitment.

The default connected demo portfolio contains four differently colored NFTs: Cyan Enhanced #444 and Blue Singularity #128 have claimable rewards; Emerald Enhanced #91 is already claimed; Violet Dormant #74 has no rewards. Reset demo restores this baseline; simulated mints can add positions afterward. The v7 saved-state namespace starts the finite artwork inventory without replaying obsolete v6 events. Earlier saved events are not deleted.

Demo events persist under `zzz-popl-preview-v7`, with per-NFT operations and
cross-tab coordination. Wallet choice persists within the tab through navigation
and refresh; browser wallets restore through public-account reads only. Use
Reset demo to restore the baseline and invalidate pending previews. The
[interaction-state guide](FRONTEND_STATE.md) explains concurrency, failure recovery,
wallet persistence and the remaining production integration boundary.

## Local contract integration

The existing website also runs against disposable Anvil contracts at the local
launcher’s `/app/` mount. See [local integration](LOCAL_INTEGRATION.md) for setup,
confirmation, gas, ownership, history and recovery. This mode uses local test
accounts; production extension-wallet signing and public deployment remain open.

## Important boundary

No public PoPL deployment is configured. In the default static/demo mode, every NFT, LP valuation, fee history, portfolio assignment, mint, activation and claim in this website is illustrative. Browser-wallet connection retrieves a public address and chain identifier only. The default static mode never requests token approvals, signatures, payments or blockchain transactions. The separate local mode explicitly confirms disposable test transactions.

Connecting a real wallet does not fetch its actual NFTs: it displays the same explicitly labeled example portfolio. The accepted contract configuration is a 0.05 ETH dormant mint, default minimum $100 activation/$5 growth with at least 97% deployed as marginal LP at the fresh default3% contribution cap and gas separate, an 80/10/5/5 revenue split with equal collective shares across active NFTs, and the capped rarity/royalty rules described below. The aligned fresh Solidity candidate has source-scoped verification; production remains unapproved and the default simulation does not call it. Independently reviewed source9/client200bps ceilings remain2% and reject a300bps on-chain cap until separately re-reviewed. The local mode uses its compiled core with mock venue/feed/randomness dependencies. Actual pricing/routes/VRF, authorities, OpenSea, current services/site, operating qualification and independent audit remain release gates. The fresh architecture has no integrated bridge or external custody-address exit.

Some historical demo contribution forms use a USD-equivalent example; fresh ETH/ZZZ execution requires actual token units and reviewed prices. No ZZZ exchange rate or token-quantity quote is simulated. Contributions fund permanent LP attributed to the same NFT; holders claim funded rewards and cannot redeem principal during normal operation. Fresh contracts also support governance-triggered terminal ETH/ZZZ return; the older served build does not implement that lifecycle. Transfers carry the attached LP allocation and fee rights, including unclaimed funded rewards. NFT rarity, color style, palette and circuit pattern remain fixed, and new contributions receive no retroactive fees.

Pool share is secondary context, never a progress target. The website remains a simulation and is not approved for real funds. Metadata JSON files are local examples, not contract tokenURI responses.

## Verify and build

Run these commands from your clone's root directory on any supported operating system:

```sh
npm test
npm run check
npm run build
node server.mjs --dist
```

The dependency-free static output is written to `dist/` and can be uploaded to a static host. The build includes the portable palette/inventory catalog, all 2,784 self-contained SVG artwork states, their metadata JSON files and the artwork manifest. Original raster artwork remains preserved in source assets. Hash routes work without server rewrites. The Node server above is for local preview; production can serve the static files directly.

## Illustrative data and rewards

The collection has $425,000 of permanent LP across 100 example positions, with 20 dormant positions. Total example ZZZ pool liquidity is $1,250,000, so the collection's share is 34%. Example 24-hour pool volume is $848,000. At an assumed 0.30% swap fee, gross pool fees are $2,544 and the collection's proportional fee estimate is $864.96.

This is sample arithmetic, not live chain data or a yield guarantee. TVL share is not generally the fee-earning share of concentrated liquidity. The example assumes the same proportion of active liquidity earns fees throughout the day and excludes Uniswap protocol deductions. Actual revenue depends on the pool, active ranges and actual harvested receipts from the selected LP. See [Uniswap fee concepts](https://developers.uniswap.org/docs/get-started/concepts/fees).

The collection is modeled as 10 weeks old (70 days), giving $60,547.20 of lifetime gross fees at the example daily rate. Daily fees are apportioned across active NFTs while conserving the aggregate to the cent. Minting and LP additions do not rewrite recorded fee history. LP additions increase both collection LP and total example pool liquidity, leaving external pool liquidity fixed.

Collected LP revenue is allocated 80% to NFT owners, 10% equally to active NFTs as collective rewards, 5% to permanent LP compounding and 5% to ZZZ buyback and burn. The display model uses largest-remainder rounding to conserve cents; Solidity accounts in raw token units. Compounding is an allocation budget and is not silently added to the displayed LP snapshot. Claimable example balances are funded ledger examples, not guaranteed returns derived from the displayed LP value.

A 5% marketplace royalty is requested, but payment depends on marketplace support. All (100%) royalties actually received enter a separate reward pool: Commun ×1, Rare ×2 and Legendary ×3 after activation; dormant NFTs display their fixed rarity weight but have zero royalty eligibility until activation. These are relative shares of royalties actually received, not different marketplace royalty rates or multipliers on LP rewards. A separate illustrative royalty round allocates $12.50 per activated rarity unit: $12.50 Commun, $25 Rare and $37.50 Legendary. Dormant NFTs receive zero, and later activations/additions receive no retroactive allocation. Pending royalties and cumulative royalties claimed stay separate from the LP ledger. Combined preview claims clear both funded balances; Previously claimed sums their cumulative histories. Existing v7 claim events without a scope remain LP-only; new combined events use scope=all. No actual marketplace payment or royalty enforcement occurs.

## Artwork library

The gallery opens with **Cyan / Monochrome / Flowing arcs**. Each four-card row compares **Dormant / Activated / Enhanced / Singularity**, with one rarity per default row. Mixed-style browsing keeps complete evolution families together. Narrow screens use a keyboard-accessible horizontal comparison region, preserving the four columns.

The eight base colors are **Cyan, Blue, Violet, Emerald, Amber, Crimson, Ivory and Onyx**. Amber is yellow, Crimson is the project red, Ivory is warm white, and Onyx is black.

- **Monochrome:** any one of the eight colors.
- **Bicolor:** two distinct colors, including at least one of Ivory, Amber, Crimson or Onyx. This gives 22 unordered pairs.
- **Tricolor:** an allowed bicolor pair plus Amber, Crimson or Onyx, with no repeated color. This gives 28 unordered triples.

Reversing color order does not create a different palette. All 58 palettes can appear in Commun, Rare or Legendary. Color style, assigned colors and circuit pattern are visual traits only and have no effect on LP rewards or royalty weights.

The four catalogue patterns are Flowing arcs, Segmented panels, Orbital rings and Twin circuit routes (the retained internal ribs identity). The self-contained SVGs preserve the existing raster egg material and silhouette while applying consistent palette and circuit detailing. The original 72 PNGs are retained as historical source artwork.

| Color style | Commun | Rare | Legendary | Total NFTs |
| --- | ---: | ---: | ---: | ---: |
| Monochrome | 120 | 60 | 20 | 200 |
| Bicolor | 300 | 150 | 50 | 500 |
| Tricolor | 180 | 90 | 30 | 300 |
| Total | 600 | 300 | 100 | 1,000 |

A finite inventory enforces these quotas and permits at most four NFTs with identical palette, circuit pattern and rarity finish. Legendary finished designs are unique. Evolution changes do not create additional NFTs. The rendering catalog covers 58 palettes × 4 patterns × 3 rarities × 4 evolutions = **2,784 artwork states**; only the 1,000 inventory entries are collection slots.

| Evolution | Current attached LP value |
| --- | --- |
| Dormant | $0 before activation |
| Activated | Activation from $100; fallback stage for active positions below Enhanced |
| Enhanced | From $1,000 |
| Singularity | From $10,000 |

Activated has a fine luminous border. Enhanced has one brighter, bolder border and stronger egg-seam highlights. Singularity alone has the double border and background light. Legendary keeps its more reflective platinum finish.

`palette-system.js` defines color rules and the fixed inventory. `artworks.js` exposes the rendering catalog. `assets/nfts/manifest.json` records artwork paths and hashes; `assets/nfts/metadata/` contains the example metadata. Metadata includes Rarity, Color style, Palette, each assigned Color, Circuit pattern and Evolution, with a separate royalty weight. It never makes palette or pattern an economic multiplier.

The first 100 example NFTs consume 100 real inventory slots with a 20/50/30 color-style mix and 60/30/10 rarity counts. Their four default portfolio entries remain monochrome, differently colored and in the requested evolution/claim states. Preview mints consume remaining inventory slots without replacement. An inventory slot identity is distinct from the displayed NFT number; displayed IDs after the seed still start at #1001. Preview draws are deterministic examples, not verifiable randomness.

Rarity, palette and circuit pattern remain unchanged through activation, top-ups and claims. Evolution follows current LP market value and can downgrade; the website has no live price feed. Activation eligibility remains a separate lifecycle decision. Actual contracts, production VRF, hosted metadata integrity and royalty funding require separate production verification.

The original raster artwork was generated using the built-in image-generation tool. The current palette and circuit expansion preserves those materials through code-native SVG compositions; it does not replace the egg texture. Original reference JPEGs remain available.

## Existing Ubuntu deployment

The development preview has an existing Nginx deployment on Ubuntu 24.04 at `46.225.185.212`. Public hostname targets are [popldemo.0xwave.com](https://popldemo.0xwave.com) and [www.popldemo.0xwave.com](https://www.popldemo.0xwave.com). A GitHub push does not update that server; publishing a static release is a separate step.

Nginx serves built static files from `/var/www/aaa-website/current`, a symlink to a release directory under `/var/www/aaa-website/releases/`. The original IP configuration is `/etc/nginx/sites-available/aaa-website`; the domain configuration is `/etc/nginx/sites-available/aaa-website-popldemo`. Sites are enabled through `sites-enabled`. Nginx starts automatically after a reboot. No Node process is required on the server.

Unless the user narrows the scope, website changes follow this order: edit and verify locally, commit and push to GitHub, then deploy the committed version and verify the public result. `deploy/install-release.sh` verifies static-package SHA-256 checksums, publishes a release named by its full Git commit and atomically switches `current`. `/var/www/aaa-website/deployed-commit` records that version outside the public document root. Keep credentials outside the repository.

### DNS and HTTPS

OVH manages the DNS zone. The hostname records were verified against OVH's authoritative DNS server and a public resolver on 2026-10-14:

| Type | Subdomain | Target |
| --- | --- | --- |
| A | `popldemo` | `46.225.185.212` |
| A | `www.popldemo` | `46.225.185.212` |

These hostnames are separate from the existing `0xwave.com` site. Keep its root-domain records and other services intact.

`deploy/enable-https.sh` configures both Nginx hostnames, installs a Let's Encrypt certificate for both, redirects domain HTTP requests to HTTPS, enables the Certbot renewal timer and runs a renewal dry run. Run the initial setup with root or sudo after DNS points to the server. Later static releases reuse the HTTPS configuration.

Instructions: [OVH DNS zones](https://docs.ovhcloud.com/en/guides/web-cloud/domains/dns-zone-edit), [Certbot with Nginx](https://eff-certbot.readthedocs.io/en/stable/using.html#nginx).

## Future live integration

Before replacing the demo ledger, provide reviewed chain/deployment addresses and contract ABIs, verified NFT ownership reads, token valuation sources, a confirmed/reorg-aware indexer for collection totals and fee history, and funded reward balances. The candidate separates paid dormant minting from owner activation and pools physical LP custody. The fresh principal pool is native ETH/fixed ZZZ, static and hookless. Pons/creator-payment and integrated bridge paths are retired; actual pool/feed/route qualification and independent audit remain release gates.

Verify the separate funded rarity-weighted NFT-sale royalty ledger and its 100%-received accounting; do not reuse LP revenue allocations or infer royalty enforcement from metadata. Production rarity assignment needs reviewed VRF integration, remaining-quota accounting and failure/retry operations. Activation and LP additions need reviewed token approvals, pool parameters, minimum liquidity, deadlines and wallet-confirmed transactions matching the final ABI. Claims must use the actual rewards ABI and current NFT ownership. Verify those integrations against the release checklist before enabling real funds.

The public protocol repository is [ABEF/AAA](https://github.com/ABEF/AAA). This website repository is [ABEF/AAA-website](https://github.com/ABEF/AAA-website). See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for accepted product decisions and the related repository paths, and [AGENTS.md](AGENTS.md) for repository instructions.

The [resilience follow-up](FRONTEND_STATE.md#resilience-verification---2026-10-19)
adds immutable preview caching, expired/navigation-cancelled intents and strict
local confirmation lifetime/context checks. The associated contract repository
has bounded parallel read/unsigned-preparation services; neither change turns
the public simulation into live wallet transactions. Scoped checks: 90 JS passes.

## Current payout and contribution boundary

Fresh source supports native ETH settlement for funded LP rewards; funded ZZZ
LP rewards awaiting conversion remain separate and must never be relabelled ETH.
Royalty4 instead pays original admitted currencies, without conversion or unwrap.
Older TEST-1/TEST-2 fixtures retain their actual currencies and explicit runtime
profiles. Fresh contributions accept native ETH/fixed ZZZ only; some preserved
demo/legacy selectors still show USDG/USDC. Source documentation does not change
those running fixtures or enable their use in production. Actual conversion
routes, feeds and matching website integration remain unqualified.

## LP reward ETH settlement - 2026-10-20

For the new local contract profile, `claimable.default_settlement=native_eth`
means Rewards to claim and standard claims include only settled ETH from LP
and royalties. Source balances stay visible in the breakdown as awaiting ETH
conversion; never relabel ZZZ/TEST tokens as ETH or count conversion as new
earnings. Older source-only fixtures remain supported by their explicit profile.
The new isolated fixture is on port 8896; prior user sessions were not reset.
Public/static mode remains a simulation. The contract/backend candidate enforces
the approved 1% LP conversion loss cap with separate gas; real routes, services
and independent release approval remain open. No public contracts were deployed.
See the contract repository's LP_ETH_SETTLEMENT guide and scoped evidence.
Use main and verify Git/server receipts for publication.

### Actual local API rehearsal

The [contract runbook](https://github.com/ABEF/AAA/blob/main/docs/LOCAL_API_REHEARSAL.md)
starts a separate real Anvil/API stack. Full-wallet LP and funded ETH totals use
complete same-block chunks, independently of the eight-card page. Missing totals
are unavailable, never zero. The shared signer stays local-only; public
DEPLOYMENT remains null. Actual extension and production qualification remain open.

## Production mint venue and earnings

Production minting is intended for OpenSea. This website's Mint page is a
demonstration; direct local minting remains an integration test tool. The reviewed
production profile refuses direct mint preparation. The SeaDrop mint2 contract
implementation exists in the separate V10 source profile; actual OpenSea onboarding,
fee terms, collection URL, matching deployment/configuration and operating
acceptance must be qualified before launch. The local source10 read/unsigned
consumer does not prepare SeaDrop mint transactions or establish buyer eligibility. Activation, growth, positions and claims
remain website responsibilities. Public signing is still disabled.

The opt-in API profile displays 24h/all-time earnings for every currently held
NFT, independent of the visible page, and collection holder allocations. Earnings
include LP individual/collective shares and royalties at the confirmed current
prices, including earlier owners' history. They are separate from claimable ETH.
Missing chunks or nonzero-component prices mean unavailable, not zero. See the
[operator definitions](https://github.com/ABEF/AAA/blob/main/docs/EARNINGS_HISTORY.md#current-holdings-totals)
and [scoped evidence](https://github.com/ABEF/AAA/blob/main/reports/wallet-earnings/VERIFICATION.md).

## Confirmed collection explorer

The opt-in reviewed API profile lists canonical collection positions and complete
current attached LP, with 16-row pages, search/filters and read-only position
details. LP is read from NFT.currentLPValue at one confirmed block; every chunk
must validate before a total appears. Unknown values never become zero. See the
[operator procedure](https://github.com/ABEF/AAA/blob/main/docs/COLLECTION_READS.md).
The public configuration remains null; public data/actions are simulated.

Fresh contract source now includes governance-only same-main residual consolidation; automatic keeper actions and the served website are unchanged. Use the contract operator guide; this documentation does not add a website transaction or rollout.
