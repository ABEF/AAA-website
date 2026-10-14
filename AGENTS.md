# AAA / ZZZ PoPL website instructions

Read `PROJECT_CONTEXT.md` when starting work on this project. It records the related smart contract repository and accepted product, data, and visual decisions.

- Website: https://github.com/ABEF/AAA-website, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/aaa-website`.
- Smart contracts: https://github.com/ABEF/AAA, locally at `C:/Users/Ali/Desktop/2.x holas/Oto/zzz-protocol-v2-reviewed/zzz-protocol-v2`.
- Keep website and contract work in the appropriate repository. Do not present preview features as implemented or deployed contract behavior.
- Minting creates a dormant NFT with no LP. Activation adds at least $500 permanently locked LP; later additions increase the same NFT's LP. Claims never withdraw locked principal.
- Preserve the dark navy/cyan palette and unfilled wireframe cube artwork. Active states strengthen the lines and glow; Enhanced and Singularity are visibly distinct.
- Keep all example balances and simulated actions clearly labeled until a reviewed live integration replaces them. Browser wallet connection currently requests public accounts/chain only.
- Use the existing dependency-free Node tooling. Relevant checks are `npm test`, `npm run check`, and `npm run build`.
- Do not save credentials or access tokens in source files, documentation, Git remotes, or commits.

These are repository-local instructions, not a claim that global ChatGPT personal memory is enabled. Later explicit user instructions take precedence.
