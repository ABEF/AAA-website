# AAA / ZZZ PoPL website instructions

Read `PROJECT_CONTEXT.md` when starting work on this project. It records the related smart contract repository and accepted product, data, and visual decisions.

- Website: https://github.com/ABEF/AAA-website, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/aaa-website`.
- Smart contracts: https://github.com/ABEF/AAA, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/zzz-protocol-v2-reviewed/zzz-protocol-v2`.
- Keep website and contract work in the appropriate repository. Do not present preview features as implemented or deployed contract behavior.
- Minting creates a dormant NFT with no LP. The latest local simulation activates with at least $100 in ZZZ or USDC value, funding permanently attached LP; later additions increase the same NFT's LP. Claims never withdraw locked principal.
- Preserve the dark navy/cyan website palette and user-approved egg artwork library: six color palettes × three rarities × four evolutions. Activated strengthens the border, Enhanced has one brighter/bolder frame with stronger egg seams, and Singularity ($10,000 LP) exclusively has the bold double frame plus background light. The newer egg direction supersedes the historical wireframe-cube preference.
- Keep all example balances and simulated actions clearly labeled until a reviewed live integration replaces them. Browser wallet connection currently requests public accounts/chain only.
- Use the existing dependency-free Node tooling. Relevant checks are `npm test`, `npm run check`, and `npm run build`.
- For every requested website modification: edit the local checkout first, verify it, commit and push to `ABEF/AAA-website`, then update the Ubuntu server and verify the public result. Complete all three destinations unless the user explicitly narrows the request or access is blocked. Keep deploy scripts free of credentials.
- The current requested public hostnames are `popldemo.0xwave.com` and `www.popldemo.0xwave.com`; check `PROJECT_CONTEXT.md` for their latest deployment status. Retain the original JPEGs as reference assets; the interface uses the generated egg library. Overview uses a native liquidity snapshot.
- Do not save credentials or access tokens in source files, documentation, Git remotes, or commits.

These are repository-local instructions, not a claim that global ChatGPT personal memory is enabled. Later explicit user instructions take precedence.

Latest local website economics: $100 activation in ZZZ/USDC value and 80/10/5/5 LP revenue allocation. The aligned Solidity update is under verification and remains undeployed; do not claim production readiness from website behavior. Use activation/attached-LP language while clearly stating that only funded rewards are claimable and principal is non-redeemable. Pool share is a small context figure, never a progress target.
