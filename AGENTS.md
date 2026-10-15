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
