## Browser-wallet local integration - 2026-10-20

The explicit /app/?wallet=browser profile now uses injected EIP-1193 signing on
local Anvil only. BrowserWallet validates typed intent, chain/genesis/runtime,
nonce and gas; exact ERC20 approval is followed by a separately reviewed Entry
call. Saved per-account localStorage journals and Web Locks prevent duplicate
submission; unknown responses retain hash-only recovery. Never erase pending
intent or automatically resend. Artwork/sound waits for confirmed increased LP.

The public/static site remains a simulation. The new local fixture is port8900,
with independently checked source artifacts and mock venue/prices/randomness.
43 affected Python and 167 distinct JS checks pass across scoped runs, plus five
actual local transactions through an EIP-1193-shaped RPC test provider. Real
MetaMask/extension acceptance remains open. No production signing/services,
public deployment or paused-monitor restart. The large load campaign stays
deferred; release remains NOT APPROVED. See contract docs/BROWSER_WALLET.md and
reports/browser-wallet/VERIFICATION.md. Use main, preserve unrelated drafts and
keep central Todo, feature evidence, operator procedures and both memories aligned.

## Manual acceptance and next priority - 2026-10-20

The user reports all six proposed 8898 two-wallet scenarios passed: simultaneous
activation/top-ups, cancel after approval and reopen, pending refresh/recovery,
claim while another wallet contributes, and invalid inputs/insufficient balance.
This is user-reported manual evidence, not a new automated run or receipt audit.
See the contract repository's reports/local-wallet-concurrency/MANUAL_ACCEPTANCE.md.

The user deferred the dedicated 10/25/100-user load campaign. Do not run or schedule
it without a later request; production capacity remains UNVERIFIED. Next focus is
real browser-wallet integration with unsigned preparation and independent signing.
Bounded API work and safe recovery remain necessary before real funds. The shared
local signer/global lock is test-only. No code/test/service/public deployment or
monitor change is included in this documentation update. Main only; maintain the
contract central Todo, feature reference, operator notes and both repo memories.

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

## Local contract integration - 2026-10-19

The accepted scope is local integration before public deployment. Read
[LOCAL_INTEGRATION.md](LOCAL_INTEGRATION.md). The launcher's exact HTTP loopback
/app/ mount uses the existing design with confirmed ownership, current LP,
earnings, raw royalties and lifetime claims. Explicit confirmations cover
mint/approval/Entry/top-up/transfer/bounded combined claims; pending operation
IDs recover lost responses. Production extension-wallet signing remains open.
Default public/static mode is still a simulation; v7 storage/artwork are preserved.
Activation wording is gross $100 with 99% deployed and gas separate, superseding
older net-$100 notes. Use main, update contract Todo/features/operator procedures,
and check Git for publication. No public server deployment or monitor restart.

# AAA / ZZZ PoPL website instructions

Read `PROJECT_CONTEXT.md` when starting work on this project. It records the related smart contract repository and accepted product, data, and visual decisions.

- Website: https://github.com/ABEF/AAA-website, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/aaa-website`.
- Smart contracts: https://github.com/ABEF/AAA, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/zzz-protocol-v2-reviewed/zzz-protocol-v2`.
- Keep website and contract work in the appropriate repository. Do not present preview features as implemented or deployed contract behavior.
- Minting creates a dormant NFT with no LP. The latest local simulation activates with at least $100 in ZZZ or USDC value, funding permanently attached LP; later additions increase the same NFT's LP. Claims never withdraw locked principal.
- Preserve the dark navy/cyan interface and original egg texture/silhouette. The artwork expansion uses eight base colors, 58 allowed palettes, four circuit patterns, three rarities and four evolutions (2,784 rendering states). Activated strengthens the border, Enhanced has one brighter/bolder frame with stronger egg seams, and Singularity ($10,000 LP) exclusively has the bold double frame plus background light. The newer egg direction supersedes the historical wireframe-cube preference.
- Keep all example balances and simulated actions clearly labeled until a reviewed live integration replaces them. Browser wallet connection currently requests public accounts/chain only.
- Public website pages must omit GitHub/source-repository links and source prompts. The footer links to the ZZZ website; until official X/Telegram URLs are supplied, their icon buttons display a coming-soon message and have no navigation URL. Keep repository/deployment references in private project documentation.
- Use the existing dependency-free Node tooling. Relevant checks are `npm test`, `npm run check`, and `npm run build`.
- For every requested website modification: edit the local checkout first, verify it, commit and push to `ABEF/AAA-website`, then update the Ubuntu server and verify the public result. Complete all three destinations unless the user explicitly narrows the request or access is blocked. Keep deploy scripts free of credentials.
- The current requested public hostnames are `popldemo.0xwave.com` and `www.popldemo.0xwave.com`; check `PROJECT_CONTEXT.md` for their latest deployment status. Retain the original JPEGs as reference assets; the interface uses the generated egg library. Overview uses a native liquidity snapshot.
- Do not save credentials or access tokens in source files, documentation, Git remotes, or commits.

These are repository-local instructions, not a claim that global ChatGPT personal memory is enabled. Later explicit user instructions take precedence.

Latest local website economics: $100 activation in ZZZ/USDC value and 80/10/5/5 LP revenue allocation. The aligned Solidity update is under verification and remains undeployed; do not claim production readiness from website behavior. Use activation/attached-LP language while clearly stating that only funded rewards are claimable and principal is non-redeemable. Pool share is a small context figure, never a progress target.

Current artwork rules (2026-10-15): Amber is yellow; Crimson is red; Ivory is warm white; Onyx is black. Bicolor requires at least one of Ivory/Amber/Crimson/Onyx; tricolor adds Amber/Crimson/Onyx to an allowed pair without repeats. Palette, color style and circuit pattern are visual only. Fixed inventory is 200 monochrome / 500 bicolor / 300 tricolor with exact 60/30/10 rarity counts within each style, at most four identical full designs and unique Legendary designs. Preserve the four default portfolio states. Browser storage is v7; do not delete older namespaces. Website simulation does not establish production VRF or contract deployment.

Artwork gallery defaults: Cyan / Monochrome / Flowing arcs; preserve four evolution columns and complete evolution families when mixing styles. Royalty preview uses separate pending/cumulative counters; Previously claimed is cumulative LP + royalties for the NFT. New combined claim events persist scope=all, while old v7 claim events remain LP-only. Keep the existing storage namespace and historical trading-fee/principal values. These are simulation changes, not live royalty integration or contract enforcement.
