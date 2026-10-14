# AAA / ZZZ PoPL project context

Recorded on 2026-10-14 from decisions in the project conversation. Update this note when the user changes those decisions. This is durable project context for future work in these repositories.

## Two related repositories

| Project | GitHub | Local directory |
| --- | --- | --- |
| Website | https://github.com/ABEF/AAA-website | `C:/Users/Ali/Desktop/2.x holas/Oto/aaa-website` |
| Smart contracts | https://github.com/ABEF/AAA | `C:/Users/Ali/Desktop/2.x holas/Oto/zzz-protocol-v2-reviewed/zzz-protocol-v2` |

The website introduces ZZZ Collection / Proof of Permanent Liquidity (PoPL) and provides an interactive collection and portfolio preview. The contract repository contains the Solidity development candidate and supporting technical material. Changes, commits, and publication should target the repository appropriate to the user's request.

## Accepted product behavior

- Minting creates a dormant NFT with $0 LP, no Power, and no earned fees. It changes NFT supply only.
- Activation requires adding at least $500 of LP, permanently locked in the vault. Activation increases both the NFT's LP and the collection's locked LP.
- An active NFT holder can add more permanently locked LP to the same NFT. This increases its position and collection LP; it does not withdraw principal or create retroactive fees.
- The NFT can be transferred or sold; associated economic rights follow ownership while the principal stays locked forever.
- Collected swap fees are allocated 50% to the NFT owner, 30% to collective rewards, 10% to LP compounding, and 10% to buyback and burn. The actual contract accounting uses token units, Power, funded balances, and checkpoint rules; displayed dollar examples are explanatory.
- The website should show collection LP, LP associated with each NFT, lifetime and last-24-hour generated fees, and rewards claimable for the connected example portfolio. Mint, activate, add LP, individual claim, and bulk claim are separate interactions.

## Agreed illustrative data

- 100 example NFTs, 20 dormant; a few positions have at least $100,000 locked LP.
- Collection locked LP: $425,000. Total available ZZZ pool liquidity: $1,250,000. The collection's TVL share is 34%.
- Example last-24-hour trading volume: $848,000. Assumed swap fee: 0.30%.
- Gross pool fees: $2,544 per day. At an assumed proportional 34% fee-earning share, collection gross fees are $864.96 per day, before Uniswap protocol deductions.
- Collection age: 10 weeks, or 70 days. With the same illustrative daily rate, lifetime gross fees are $60,547.20.
- Lifetime allocations: $30,273.60 owner rewards, $18,164.16 collective rewards, $6,054.72 compounding, and $6,054.72 buyback and burn.
- The compounding allocation is a budget; do not silently add it to the current $425,000 LP snapshot. New LP deposits do not rewrite historical generated fees.
- TVL share is not generally the active fee-earning share in concentrated liquidity. The calculation explicitly assumes proportional active liquidity throughout the day. It is an illustration, not live data or a yield forecast.
- Overview headline: "34% of total available pool liquidity. Committed for good."

## Accepted visual choices

- Use the supplied blue/cyan branding on a dark navy site. The "02 / SHARED PRODUCTIVITY" section must match the dark palette.
- Original reference assets are `logo.jpg`, `collec.jpg`, and `nft.jpg` in the parent `Oto` directory. Website copies are in `assets/`.
- The collection JPEG informed the lifecycle and economic explanations. The user subsequently requested removing it from the displayed site and improving the native 50/30/10/10 section instead. Retain it as a reference asset.
- Keep NFT artwork as an unfilled wireframe cube. Dormant lines are muted; active lines become brighter and thicker with restrained cyan glow. Enhanced is visibly bolder and Singularity has the brightest near-white outlines. Do not fill the entire hexagon or cube faces.
- Conceptual levels: Dormant $0; Online $500; Enhanced $1,000; Advanced $5,000; Elite $25,000; Singularity $100,000. These are product illustrations, not implemented contract guarantees.
- The NFT illustration in "More than a mint" uses a normal image cursor and a small bottom-right enlargement arrow, matching Overview. Avoid a zoom-in plus cursor.

## Website implementation and verification

- Buildless HTML/CSS/JavaScript with Node.js 20+ standard-library tools and no third-party runtime dependencies.
- Routes: `#overview`, `#collection`, `#mint`, `#my-nfts`. Local preview: `http://127.0.0.1:4173`.
- Commands: `npm run dev`, `npm test`, `npm run check`, `npm run build`. Static output: ignored `dist/`; source files and original assets are committed.
- Browser wallet support uses injected EIP-1193/EIP-6963 providers or a demo wallet. It only requests public accounts and chain identifiers. It does not sign, approve tokens, or submit blockchain transactions.
- All displayed positions and actions are labeled simulations. Connecting a real wallet still displays the example portfolio, not that address's actual on-chain holdings.
- Preview events persist under localStorage key `zzz-popl-preview-v4`; wallet connections do not persist. The footer's Reset demo restores the baseline dataset.
- Example portfolio includes NFTs #444, #128, #91, and dormant #74. Claims change funded example balances without reducing LP or generated fee history. Cent allocation conserves each displayed total.
- Most recent automated verification: 25 Node tests passed; syntax, unique IDs, local references, application selectors, and four routes passed. Desktop browser interactions were checked. Responsive CSS exists, but a completed mobile browser test has not been recorded.

## Contract candidate and integration boundary

- No contracts are deployed for this website. The requested separate dormant-mint-then-activate lifecycle needs implementation and review: the current vault candidate combines deposit and issuance.
- The candidate targets hookless Uniswap v4 static-fee pools with conventional ERC-20 assets, including WETH rather than native ETH. It contains 16 Solidity modules, lifetime contribution/Power accounting, funded reward checkpoints, and bounded reward assets.
- Cross-chain migration is canonical-to-satellite with sealed routes; a production transport is not supplied. Review the actual architecture and interfaces before expanding functionality.
- The initial contract repository import was committed and pushed as `a9707e89a8059c11bd1b8b0db82efa722ce5ddca`. Documentation was reorganized; original implementation and security-source checksums were preserved. Original historical README and manifest are under `reports/history/`.
- Native Windows Python validation ran 84 tests: 81 passed, one Unix-permission assertion failed, and two failed because `fcntl` was unavailable. The historical Unix report is separate evidence. Foundry/Solc compilation, EVM tests, real Uniswap fork integration, production bridge transport, and an independent audit remain outstanding.
- Before enabling real minting, activation, deposits, or claims, implement/review the intended ABI, configure deployment addresses and chain, authenticated ownership reads, valuation sources, a reorg-aware indexer, funded claim balances, token approvals, and wallet-confirmed transactions.

## Public website deployment

- On 2026-10-14, the user authorized deployment to their Ubuntu server and chose the server IP rather than a domain.
- Public preview URL: http://46.225.185.212. HTTPS is not configured. The site's existing simulation boundaries still apply.
- Ubuntu 24.04 runs Nginx on port 80. Nginx is enabled to start after a reboot. The pre-existing service on port 8443 was left alone.
- Static document root: `/var/www/aaa-website/current`, pointing to `/var/www/aaa-website/releases/87b66e2-20261014`. Nginx site configuration: `/etc/nginx/sites-available/aaa-website`, with a `sites-enabled` symlink.
- The release contains the nine built public files from website commit `87b66e2ef19f5564e50b45f598ea3b4b1024d8f4`. All nine returned HTTP 200 with matching SHA-256 hashes from outside the server. Source notes and Git metadata are not served.
- There is no Node development server, Git credential, or server password in the deployed static build. Credentials must remain outside project files.
- README setup instructions use `git clone`, relative `cd aaa-website`, and commands from the clone's root. Keep public setup instructions independent of the author's local paths and compatible with Windows, macOS, and Linux.

## Handling context and credentials

`AGENTS.md` points agents to this note when working in the corresponding project directory. This does not imply global ChatGPT personal memory is enabled. Keep the copies in both projects aligned after material decisions. Do not store pasted tokens or credentials here or in Git.
