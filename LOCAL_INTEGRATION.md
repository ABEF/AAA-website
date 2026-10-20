## Contribution flow and accepted inputs - 2026-10-19

Latest user clarification: show ZZZ, USDG, USDC and ETH in the contribution
selector. WETH remains a supported accounting/wrapping asset, not a separate
selector choice. Never silently substitute TEST-1 for a named input.

Grow/Activate opens a contribution-only dialog; image/details opens the reward
breakdown. Only the contributed NFT's LP/artwork receives an updating marker.
Claims refresh claimed reward balances without marking artwork or unrelated NFTs.
Evolution selection waits for successful execution and confirmed current on-chain
LP reads. Preloading four fixed-identity states never selects evolution from input.
Rarity is bold; palette words retain individual colors. The local session on 8892
is preserved. A separate --named-assets fixture on 8893 has real disposable named
tokens, six-decimal stables and mock typed conversion; ETH wraps in a separate
explicit wallet step before exact WETH approval/Entry. This is not qualification
of production native-ETH/Pons execution. ETH-only LP payouts remain unimplemented.

## Palette lettering and payout audit - 2026-10-19

Each palette name is rendered in its own catalogue color, without a background
highlight, in demo and local cards/details. Onyx uses readable graphite on dark
cards. Pattern labels remain hidden; artwork/metadata are unchanged.

The user requires ETH-only holder rewards. Current local LP claims are real
mock-token payouts, and production LP ledger claims remain source ERC20; only
royalties have a batch ETH conversion path. Do not rename raw balances as ETH.
The contract Todo now owns the missing LP settlement path and the named local
asset/route fixture. Existing 8892 was preserved and wallet A received 100,000
more disposable input tokens; no claim was submitted by this audit.

## $5 increases and net NFT earnings - 2026-10-19

Rarity, color style, palette and royalty weight share one trait row beneath the NFT name/evolution row, in cards and details. The circuit pattern label is hidden here; artwork/metadata/gallery keep it. Long palettes remain horizontally readable without wrapping.

Activation stays $100; new increases start at $5 original USD-equivalent value,
with USDC/ZZZ/ETH/USDG choices in the example. The contract candidate and backend
enforce the same floors and 99% marginal new LP, gas separate. Preserve existing
v7 events and holdings; legacy smaller additions replay but new writes reject.

Cards/details display individual LP + equal-collective + royalties earned, not
gross pool fees. Their 24h/all-time labels and regular-weight values share one
compact line below centered LP attached. Rewards to claim is centered separately.
Claims never reduce total earned. Saved original demo NFTs have no dated net
history: show Unavailable for 24h rather than copying gross fees. Local history
must match NFT, chain and confirmed block; missing prices/components stay null.
Dormant NFTs omit rewards/history. No accounting reset, public server update or
existing local-chain restart. Main only; central contract Todo/operator/evidence
updated. Check Git for publication and source-bound reports for test scope.

# Local contract mode

The existing website can use real, disposable local contract state while retaining
its design. Start the contract repository's `scripts/local-stack.py` with this
checkout as `--website`, following the [local stack guide](https://github.com/ABEF/AAA/blob/main/docs/LOCAL_TEST_STACK.md).
Open `http://127.0.0.1:8890/app/#my-nfts` (substitute the launcher's port).
Normal `npm run dev` and public static hosting still run the labeled simulation.

Choose Test wallet A or Test wallet B. These are local unlocked accounts on the
launcher's own Anvil child; no browser extension, private key or public funds
are used. My NFTs and Collection show confirmed ownership/current LP and real
processed earnings. Artwork maps actual revealed traits to the existing library.
Mint ordinals are readable labels; full uint256 strings identify transactions.
ETH royalties retain raw currency units when a USD price is unavailable. LP
earnings combine individual LP, equal-collective and royalties at today's prices; all three must have available prices at the same NFT/chain/block snapshot.
Previously claimed includes all actual LP and royalty payouts in the history.

Royalty multipliers on local NFT cards come from the revealed rarity: Commun ×1, Rare ×2, Legendary ×3. Dormant cards retain that multiplier in gray; activation enables participation without changing rarity. Unrevealed NFTs show Unrevealed, never an assumed multiplier. This display is separate from the ledger’s zero effective weight before activation.

Mint, transfer, exact approval, Entry activation/top-up and combined claims use
explicit confirmations. Approval and LP contribution are separate steps. The
updated fixture accepts 100–99,999 whole TEST-1 for activation and 5–99,999 for increases, marked at $1 by a mock feed. Existing running deployments keep their old configuration until intentionally replaced. At least
99% must become marginal deployed LP; gas is separate. Claim-all is bounded
to ten NFTs / 32 currency operations per confirmation. A larger wallet requires
another reviewed batch, never an automatic unbounded transaction sequence.

Confirmations expire after 60 seconds and are bound to the local account and
state revision. Fresh simulation/gas checks precede submission. Cancel/Escape
send nothing. A successful approval may remain when the later LP step is
cancelled. Lost responses recover through Refresh with the identical operation
ID. Storage failure blocks submission. Uncertain outcomes block new actions
until the local records are inspected. Restarting the launcher creates a new
chain/session, discards old browser intent and requires wallet selection again.
There is no persistent-chain recovery promise.

`local-client.js` handles exact amounts, session verification, confirmation and
recovery. `local-view.js` renders into the existing layout. Local mode requires
the exact HTTP loopback `/app/` mount plus the verified launcher handshake.
The production demo adapter and its v7 storage are unchanged. Read failures
clear financial projections (labeled last-confirmed artwork can remain); demo balances are never used as fallback. Inline artwork
styles are allowed only by the local mounted page's CSP; script/connect sources
remain same-origin. The launcher exposes only allowlisted public files.

The root local panel still provides operator fee-funding/rebalance tools. Venue,
feeds and randomness are explicit mocks; the core contracts and accounting are
the current unmodified compiled candidate. This does not qualify real swaps,
Pons funding, production VRF, wallet-provider signing, receipt reorg/replacement
recovery or production hosting. No public server deployment accompanies this work.

Checks: 13 local-client cases, 47 existing domain/artwork cases, syntax/static
checks and a static build. The [contract evidence](https://github.com/ABEF/AAA/blob/main/reports/local-website/VERIFICATION.md)
records server/confirmation checks and actual local receipts. Release remains
NOT APPROVED. For new behavior, update this guide and the contract operator manual,
central Todo and feature/evidence reference together.

Dormant NFT details omit the claim button. Activation and transfer remain available; after activation, the claim button is enabled only when confirmed claimable funds exist and local state permits it.

## Refresh, evolution and concurrent access

The fast session endpoint exposes only the two disposable public wallet addresses,
without waiting for indexer/history reads. Selection is saved in tab session
storage and restored only for that exact deployment; disconnect persists and a
new chain/session resets selection. This stores no private key or signer.

Dormant cards and details omit fee history, claimable royalties/LP, lifetime claims
and earnings breakdown. Active cards have separate **Claim** and **Grow attached
LP** buttons. The latter opens the contribution form; Claim requires funds and
fresh state. An activated NFT stays eligible if market value lowers its artwork.

On refresh, last-confirmed NFT identity and artwork remain visible with a status
label; balances show Updating, not a false error or cached amount. Actions wait
for current data. Actual failures show Unavailable. Confirmed evolution changes
crossfade after loading the new artwork; reduced-motion removes the animation.
No optimistic level or rewards are invented from the contribution amount.

Overlapping client refreshes share one request. Only an explicit busy 409 from
GET /state retries, at most 13 attempts within its 90-second deadline with capped
backoff. Writes and other errors do not auto-retry. If confirmation succeeds but
the subsequent balance read fails, refresh the data, never create another payment.
Same-ID pending recovery and exact revision/ownership/simulation guards remain.

The local launcher intentionally serializes its shared indexer and transactions;
production needs independent wallet signing and bounded concurrent reads. Shared
pool quote races, same-NFT ownership/claim races, nonce/replacement handling and
peak-load rehearsal remain explicit central Todo requirements. This local UI
improvement is not a claim of production load capacity. The session endpoint
change was applied with a fresh disposable deployment; original receipts and a
raw chain snapshot were preserved externally (not qualified persistent recovery).

Focused follow-up checks: 25 local-client/presentation cases and nine local HTTP
cases; actual local evolution receipts and browser verification are recorded in
the contract repository's scoped evidence. No unchanged Solidity suite rerun.

The local A/B transfer control exercises ownership changes only. It is not a sale, listing, purchase or marketplace feature. NFT secondary sales take place on external marketplaces such as OpenSea.


### Activation review feedback and targeted artwork status

Contribution validation, preparation progress and errors appear beside the review
button inside the NFT dialog. Invalid amounts or missing acknowledgement explain
what to fix; preparation disables the form and labels the button as preparing.
After a confirmed approval, the acknowledgement carries to the LP step only for
the same deployment, wallet, NFT and exact amount. Changing the amount clears it.
Approval and Entry still require separate explicit transaction confirmations.

Only the NFT receiving a confirmed activation/top-up shows the artwork Updating
badge during balance refresh. Other artwork stays visible without that badge;
stale financial values/actions still wait for the confirmed portfolio snapshot.
A plain refresh or token approval does not label every artwork as changing.

### Confirmation resilience

The website rejects missing/nonfinite or over-60-second draft lifetimes, counts
elapsed preparation, and checks monotonic/wall expiry plus current chain/account/
revision before execute. Losing confirmed state blocks confirmation. Context extras
cannot override the selected wallet/action. Existing duplicate-operation and lost-
response recovery remain in force; no new automatic writes. Reload JS without
restarting the current disposable session. The production API's new parallel
read/unsigned workers do not change this local signer's serial mutation lock.

### Position summary

Cards display fixed royalty weight as a trait and combine LP/royalty claimable
amounts by currency in Rewards to claim. The breakdown separates attached LP,
current reward components, 24-hour/all-time earnings and lifetime claimed totals.
Dormant NFTs omit rewards; stale reads suppress monetary values as before.
No signer, server or operator-procedure change is needed; reload updated assets.

The activation form offers only ZZZ / ETH (WETH accounting identity). Pool labels
are omitted from NFT detail views. Existing legacy demo records are preserved.
The contract candidate permits one contribution pool at a time, with future
governed switches; this UI is not an on-chain deployment.

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

## Local fixed activation and two-transaction flow - 2026-10-20

The local /app/ profile fixes activation at $100 using the fixture's explicit $1
mock token price; top-ups start at $5. Entry is token quantity, with USD equivalent
below. Exact ERC20 approval opens the next LP review automatically, but every
transaction still requires confirmation. Keep the modal open while receipts and
confirmed balances load. Never optimistically update LP/artwork after approval.

The contract/backend repository now prepares direct exact replacement allowances
(no automatic reset). Tokens requiring reset fail closed. A separate native fixture
on 8898 uses production Entry's atomic ETH wrapping path; ETH is one transaction,
ERC20 at most approval plus Entry. The old 8896 chain is preserved; its WETH pool
cannot accept native ETH atomically and that input is disabled in its UI. Both
are local mocks, not public deployment or wallet-extension qualification. Fixed
$100 is a local UI/API rule; production Entry still has a minimum rather than an
exact-value cap. Keep this distinction in release documentation.

See contract reports/local-contribution-flow/VERIFICATION.md and docs/WORK_HANDOFF.md.
Main only; check Git for publication. Public website/server and monitor unchanged.

