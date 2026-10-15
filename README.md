# ZZZ PoPL website

A responsive website and collection application for ZZZ Collection — Proof of Permanent Liquidity. The interface uses 72 standalone egg artworks: six colors × three rarities × four evolutions. The supplied logo and original illustration JPEGs are preserved.

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

- Overview: explains the NFT's attached LP and transferable fee rights through an example position, a contribution diagram and a three-step lifecycle. Selecting the example NFT opens the same position details used by Collection. The LP revenue chart shows the 80/10/5/5 allocation, followed by compact collection LP, 24-hour fees, lifetime fees and pool-volume figures. There are no fee calculators, amount inputs or period controls. NFT-sale royalties have a separate section, followed by the color/evolution guide and seven FAQs that start closed. Small arrow links open Collection and Artwork.
- Collection: starts with exactly $425,000 in example LP across 100 NFTs; 20 are dormant, and three positions exceed $100,000. Shows lifetime and 24-hour gross fees, level composition, a sample activity chart, pool/status/rarity/color/search filters, sorting, pagination and NFT details. Position details keep attached LP, lifetime fees and 24-hour fees together in one row.
- Artwork: browse 72 variants by palette, rarity and evolution, enlarge each image and download its example metadata. These are artwork variants for the existing 100 example positions, not 72 additional minted NFTs.
- Mint: creates a dormant NFT with $0 attached LP and no rewards. Minting increases the NFT count, never collection liquidity. In My NFTs, activate it with at least $100 in ZZZ or USDC value, funding LP in an example ZZZ/WETH or ZZZ/USDC pool. Later contributions increase the permanent LP allocation attached to that same NFT. The artwork controls explore designs; they do not select mint traits.
- My NFTs: connect an injected browser wallet (EIP-1193/EIP-6963) or the demo wallet to inspect example owned NFTs, attached LP, generated fees and claimable rewards. Individual and bulk simulated claims change funded reward balances without reducing principal or gross fees. Activation and LP additions use separate forms that acknowledge the permanent commitment.

The default connected demo portfolio contains four differently colored NFTs: Cyan Enhanced #444 and Blue Singularity #128 have claimable rewards; Emerald Enhanced #91 is already claimed; Violet Dormant #74 has no rewards. Reset demo restores this baseline; simulated mints can add positions afterward. The v5 saved-state namespace starts this revised example without replaying claims from the older v4 demo.

Demo events persist in browser localStorage under `zzz-popl-preview-v5`. Wallet connections are not persisted. Use Reset demo or remove that storage key to restore the original example dataset.

## Important boundary

Contracts are not deployed. Every NFT, LP valuation, fee history, portfolio assignment, mint, activation and claim in this website is illustrative. Browser-wallet connection retrieves a public address and chain identifier only. The application never requests token approvals, signatures, payments or blockchain transactions.

Connecting a real wallet does not fetch its actual NFTs: it displays the same explicitly labeled example portfolio. The contract development candidate implements a 0.05 ETH dormant mint and separate minimum $500 activation, but this website never calls them. The website previews $100 activation and an 80/10/5/5 LP revenue split; these economics have not been applied to Solidity. Rarity, dynamic egg metadata and NFT-sale royalty distribution remain proposed contract features.

A ZZZ or USDC contribution is entered as a USD-equivalent example. No ZZZ exchange rate or token-quantity quote is simulated. Contributions fund permanent LP attributed to the same NFT; holders can claim funded rewards, never redeem LP principal. Transfers carry the attached LP allocation and fee rights, including unclaimed funded rewards. NFT rarity and color remain fixed, and new contributions receive no retroactive fees.

Pool share is secondary context, never a progress target. The website remains a simulation and is not approved for real funds. Metadata JSON files are local examples, not contract tokenURI responses.

## Verify and build

Run these commands from your clone's root directory on any supported operating system:

```sh
npm test
npm run check
npm run build
node server.mjs --dist
```

The dependency-free static output is written to `dist/` and can be uploaded to a static host. The build includes the artwork catalog, all 72 PNGs, their 72 metadata JSON files and the artwork manifest. Hash routes work without server rewrites. The Node server above is for local preview; production can serve the static files directly.

## Illustrative data and rewards

The collection has $425,000 of permanent LP across 100 example positions, with 20 dormant positions. Total example ZZZ pool liquidity is $1,250,000, so the collection's share is 34%. Example 24-hour pool volume is $848,000. At an assumed 0.30% swap fee, gross pool fees are $2,544 and the collection's proportional fee estimate is $864.96.

This is sample arithmetic, not live chain data or a yield guarantee. TVL share is not generally the fee-earning share of concentrated liquidity. The example assumes the same proportion of active liquidity earns fees throughout the day and excludes Uniswap protocol deductions. Actual revenue depends on the pool, active ranges and a funded reward-sharing arrangement. See [Uniswap fee concepts](https://developers.uniswap.org/docs/get-started/concepts/fees).

The collection is modeled as 10 weeks old (70 days), giving $60,547.20 of lifetime gross fees at the example daily rate. Daily fees are apportioned across active NFTs while conserving the aggregate to the cent. Minting and LP additions do not rewrite recorded fee history. LP additions increase both collection LP and total example pool liquidity, leaving external pool liquidity fixed.

Collected LP revenue is allocated 80% to NFT owners, 10% to collective rewards, 5% to permanent LP compounding and 5% to ZZZ buyback and burn. The display model uses largest-remainder rounding to conserve cents; Solidity accounts in raw token units. Compounding is an allocation budget and is not silently added to the displayed LP snapshot. Claimable example balances are funded ledger examples, not guaranteed returns derived from the displayed LP value.

NFT-sale royalties use a separate reward pool: Commun ×1, Rare ×2 and Legendary ×3 after activation; dormant NFTs have zero royalty weight. These are relative shares of royalties actually received, not different marketplace royalty rates or multipliers on LP rewards. No royalty balance or enforced marketplace payment is simulated.

## Artwork library

NFT artwork uses six palettes (Cyan, Blue, Violet, Emerald, Amber and Crimson), three fixed rarities (Commun, Rare and Legendary), and four LP evolutions:

| Evolution | Example attached LP |
| --- | --- |
| Dormant | $0 |
| Activated | From $100 |
| Enhanced | From $1,000 |
| Singularity | From $10,000 |

Activated has a fine luminous border. Enhanced has one brighter, bolder border and stronger egg-seam highlights. Singularity alone has the double border and background light. Legendary has a more reflective platinum finish.

All 72 standalone PNGs and 72 example metadata JSONs are in `assets/nfts/`. `artworks.js` is the canonical catalog, and `assets/nfts/manifest.json` records the variants and image hashes. NFT IDs keep their color and rarity through mint, activation, LP addition and claim previews. Mint traits are deterministic examples, not a production rarity allocation policy.

Generated artwork used the built-in image-generation tool. Prompts and provenance are retained in local project context and the related contract design workspace. Original reference JPEGs remain available as reference assets.

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

Before replacing the demo ledger, provide reviewed chain/deployment addresses and contract ABIs, verified NFT ownership reads, token valuation sources, a confirmed/reorg-aware indexer for collection totals and fee history, and funded reward balances. The candidate separates paid dormant minting from owner activation and pools physical LP custody. The native/Pons-market adapter, production bridge, valuation policy, staged operations and independent audit remain release gates.

Rarity-weighted NFT-sale royalties need a separate funded ledger; do not reuse LP revenue allocations or infer royalty enforcement from metadata. Activation and LP additions need reviewed token approvals, pool parameters, minimum liquidity, deadlines and wallet-confirmed transactions matching the final ABI. Claims must use the actual rewards ABI and current NFT ownership. Verify those integrations against the release checklist before enabling real funds.

The public protocol repository is [ABEF/AAA](https://github.com/ABEF/AAA). This website repository is [ABEF/AAA-website](https://github.com/ABEF/AAA-website). See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for accepted product decisions and the related repository paths, and [AGENTS.md](AGENTS.md) for repository instructions.
