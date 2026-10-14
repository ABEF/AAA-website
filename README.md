# ZZZ PoPL website

A responsive website and collection application for ZZZ Collection — Proof of Permanent Liquidity. It displays the supplied logo and NFT illustration; the collection guide informed the native explanations.

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

- Overview: explains permanent liquidity, transferable fee rights, the 50/30/10/10 allocation, architecture, and project status. Includes an interactive fee calculator and the supplied NFT illustration. The collection guide informed the native lifecycle and economic explanations; its JPEG is retained as a reference asset but is no longer displayed on the site.
- Collection: starts with exactly $425,000 in example LP across 100 NFTs; 20 are dormant, and three positions exceed $100,000. Shows lifetime and 24-hour gross fees, level composition, a sample activity chart, pool/status/search filters, sorting, pagination, and NFT details.
- Mint: creates a dormant NFT with $0 LP and $0 Power. Minting increases the NFT count, never collection liquidity. In My NFTs, activate it by adding at least $500 of permanently locked LP to ZZZ/WETH or ZZZ/USDC. Holders can then add more permanent LP to the same NFT at any time. Activation and top-ups increase both its position and collection LP.
- My NFTs: connect an injected browser wallet (EIP-1193/EIP-6963) or the demo wallet. Inspect example owned NFTs, LP, lifetime fees, 24-hour fees, individual/collective balances, and claimable rewards. Individual/bulk simulated claims update balances without reducing principal or gross fees. Dormant activation and permanent LP top-ups have separate amount forms and irreversible-lock acknowledgements.

Demo events persist in browser localStorage under `zzz-popl-preview-v4`. Wallet connections are not persisted. Remove that storage key to restore the original example dataset.

## Important boundary

Contracts are not deployed. Every NFT, LP valuation, fee history, portfolio assignment, mint, activation, and claim in this website is illustrative. Browser-wallet connection retrieves a public address and chain identifier only. The application never requests token approvals, signatures, payments, or blockchain transactions.

Connecting a real wallet does not fetch its actual NFTs: it displays the same explicitly labeled example portfolio. Dormant minting, activation, and levels illustrate the supplied product concept; they are not implemented features of the current Solidity candidate.

The supplied JPEGs are displayed unchanged. The site's text identifies trading fees, funded claim rights, and collective allocation independently of conceptual claims in those images. The repository remains an uncompiled development candidate, not independently audited or approved for real funds.

## Verify and build

Run these commands from your clone's root directory on any supported operating system:

```sh
npm test
npm run check
npm run build
node server.mjs --dist
```

The dependency-free static output is written to `dist/` and can be uploaded to a static host. Hash routes work without server rewrites. The Node server above is for local preview; production can serve the static files directly.

## Current Ubuntu deployment

The public development preview is available at [http://46.225.185.212](http://46.225.185.212), deployed on 2026-10-14 using Nginx on Ubuntu 24.04. The user selected the IP address for now; HTTPS has not been configured.

Nginx serves only the built static files. Its document root is `/var/www/aaa-website/current`, a symlink to `/var/www/aaa-website/releases/87b66e2-20261014`. The site configuration is `/etc/nginx/sites-available/aaa-website`, enabled through `sites-enabled`. Nginx starts automatically after a reboot. No Node process is required on the server.

All nine deployed public files were verified against the local build with SHA-256 checksums. Future updates should build a new release directory, switch the `current` symlink, validate with `nginx -t`, and reload Nginx. Keep server credentials outside the repository.

## Future live integration

Before replacing the demo ledger, provide reviewed chain/deployment addresses and contract ABIs, an authenticated-by-chain ownership read path, oracle/token valuation sources, a confirmed/reorg-aware indexer API for collection totals and fee history, and funded reward balances. The requested dormant-mint-then-activate lifecycle needs an explicitly implemented and reviewed contract interface; the current vault candidate combines deposit and issuance. Activation and LP top-ups need token approvals, pool parameters, minimum liquidity, deadlines, and wallet-confirmed transactions matching the final ABI. Claims must use the actual rewards ABI and current NFT ownership. Verify those integrations against the release checklist before enabling real funds.

The public protocol repository is https://github.com/ABEF/AAA.

## Current illustrative market scenario

Collection permanent LP: $425,000. Total ZZZ pool liquidity: $1,250,000. Collection TVL share: 34%. Example 24-hour pool volume: $848,000. At an explicitly assumed 0.30% swap fee, gross pool fees are $2,544 and the collection's gross proportional fee estimate is $864.96.

The overview prominently shows the liquidity share, locked LP, pool total, and adjustable volume/fee inputs. Example historical daily fees are allocated across active NFTs and total exactly $864.96. Minting and new LP deposits do not retrospectively change historical generated fees. Later LP additions increase the example pool total alongside the collection LP, leaving external pool liquidity fixed.

TVL share is not generally the fee-earning share of concentrated liquidity. This calculation assumes equal active-liquidity share throughout the day and excludes any Uniswap protocol deductions. The hypothetical calculator is separate from the fixed sample historical fee ledger. For a 0.25% LP fee assumption, the same inputs give $720.80. These are arithmetic scenarios, not live chain data or yield guarantees.

Reference: https://developers.uniswap.org/docs/get-started/concepts/fees

The collection is modeled as 10 weeks old (70 days). At the unchanged example daily rate, lifetime gross fees equal $60,547.20. The 10% compounding allocation equals $6,054.72; it is displayed as an allocated budget and is not silently added to the current $425,000 LP snapshot. Newly minted or newly activated NFTs start without retroactive fees. Dormant cube artwork is a dim outline; active artwork preserves the original unfilled wireframe cube, with brighter cyan lines and a restrained glow.

The economics section replaces the collection JPEG with explained allocation destinations, transparent/collective/permanent/transferable principles, and 24-hour versus 10-week examples. Dollar allocations use largest-remainder rounding to preserve the total; this is a display model, not the Solidity raw-token-unit allocation algorithm.

NFT artwork keeps the unfilled wireframe design. Stroke weight and restrained cyan glow progress through Dormant, Online, Enhanced, Advanced, Elite, and Singularity; Enhanced is bolder and Singularity has the brightest near-white outlines.

## Related project and saved context

Website source: https://github.com/ABEF/AAA-website. Smart contracts: https://github.com/ABEF/AAA.

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the two local repository paths and accepted product, demo, and design decisions. [AGENTS.md](AGENTS.md) directs future agents to that project context.
