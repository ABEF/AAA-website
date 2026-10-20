## Wallet RPC quantity diagnostics - 2026-10-20

The user reported Invalid transaction quantity after the mint review. At the
observed local block 319, Wallet A's next nonce was 0x23, both latest mint drafts
used that nonce with no observed hash, and no pending transaction was present.
The supplied text was the app review, not a receipt. Actual MetaMask failure
cause remains unconfirmed; do not claim a successful mint or a proven root cause.

Wallet-returned numeric fields accept bounded unsigned hexadecimal padding;
unsigned prepared transactions and journals remain strictly canonical. Invalid
responses identify their field without logging raw provider data. Preflight
failure says nothing was submitted by this operation; uncertain submissions
retain recovery. No automatic retry sends. 123 affected signer/client tests and
5,593-file build pass; see reports/browser-wallet/RPC_QUANTITIES.md.
No backend/contract, public transaction, service reset or deployment change.
Keep main, Todo/evidence/operator notes and both memories consistent.

## Fresh MetaMask button selection - 2026-10-20

The user still reproduced the previous-account issue. Explicit reconnect no
longer prefers a remembered sender over fresh provider accounts. The MetaMask
picker button always requests fresh eth_accounts permission on that user gesture;
refresh never prompts. If several accounts are returned, the user must select
one in the website instead of guessing which popup account was intended.
Unfinished selection blocks account restoration and clears only remembered
connection selection, not pending transaction journals. Exact chain/genesis,
sender authorization and pending recovery remain enforced.

90 affected client/UI-state cases and the 5,593-file build pass. See
reports/browser-wallet/FRESH_SELECTION.md. Actual Chrome/MetaMask acceptance is
still open: mock-provider tests do not verify the extension popup. No backend,
contract, transaction, chain reset, service restart or public deployment.
Use main; preserve unrelated drafts and keep operator/Todo/evidence consistent.

## Authorized wallet account selection and clean picker - 2026-10-20

Fresh wallet picker sessions hide previous-attempt diagnostics and old provider
controls; actual pending-recovery notices and internal connection guards remain.
After choosing a provider, its authorized fixture accounts are selectable in the
website. Never infer the intended account solely from eth_accounts[0] or silently
choose a different allowed account. Wallet A may be selected even if an older
address is returned first; selection survives reload while still authorized.
The extension's private popup selection is not readable by the website.

Signer checks now require the explicitly reviewed sender to remain a valid member
of eth_accounts, plus unchanged account-event revision, network/genesis and all
existing economic/receipt checks. Revocation, wrong chain/genesis and pending
journals still block operations. Missing account permission requires one explicit
wallet authorization; no permission request on refresh and no silent substitution.

180 affected tests pass across 171 existing and nine new focused cases; syntax
and 5,593-file build pass. Read reports/browser-wallet/AUTHORIZED_ACCOUNTS.md.
No holder transaction, backend/contract change, chain/service restart, public
deployment or monitoring change. Actual MetaMask UI acceptance remains open.
Use main, preserve unrelated drafts, maintain the central Todo, feature evidence,
operator notes and both memories. Production remains NOT APPROVED.

## Main wallet button account retry - 2026-10-20

The user clarified that refresh restored the rejected MetaMask address and
clicking the main MetaMask button appeared to do nothing. The previous separate
chooser did not fix that normal button's read-only retry path. Main provider
click now rereads a previously rejected/restored account and invokes its selected
extension's chooser if that address is still inadmissible. If external wallet
selection already corrected it, normal verified reconnect avoids another prompt.
Refresh itself never opens permissions. Pending journals and exact deployment
checks remain; no silent account substitution or transaction send.

53 client tests pass, including four new rejected/restored/cancelled/corrected
retry cases. See reports/browser-wallet/ACCOUNT_CHOOSER.md (follow-up) and
docs/BROWSER_WALLET.md. Actual MetaMask acceptance still needs the user's click.
No backend/contract change, service/chain reset, public deployment or monitoring
change. Use main and maintain Todo/features/operator notes and both memories;
preserve unrelated drafts. Production remains NOT APPROVED.

## In-page wallet account selection - 2026-10-20

The user reports Rabby works but MetaMask exposes a previous site-authorized
address while another account is visible in the extension. Do not assume the
website can silently change wallet permissions. The local connection dialog now
offers Choose a different account in the selected extension. Its explicit click
requests only eth_accounts permissions, then reads current accounts/network and
verifies the admitted fixture account and exact deployment. Ordinary reconnect
remains read-only when already authorized; no automatic permission prompts.

Expected account-change events during the chooser do not invalidate the final
fresh verification. Cancellation, unsupported methods, busy prompts, empty/wrong
accounts and wrong networks stay unverified. Pending transactions block account
selection and retain their journals. No signing/transaction/approval occurs.
49 client checks pass including seven new cases; JS syntax and 5,593-file build
pass. See reports/browser-wallet/ACCOUNT_CHOOSER.md and docs/BROWSER_WALLET.md.
Actual MetaMask chooser acceptance remains user verification. No backend,
contract, Anvil/service/public deployment or monitoring changes. Use main;
keep Todo/features/operator procedures and both memories consistent, preserve
unrelated drafts. Production remains NOT APPROVED.

## Automatic receipt confirmation follow-up - 2026-10-20

The user still saw manual recovery after mint. The reported b041662e...6822560
receipt succeeded at block274. Read-only replay with its original review
reproduced old pending behavior under a synthetic lagging eth_blockNumber;
this cache condition was not directly observed in the extension.

One-confirmation inclusion now requires two canonical block hash/number reads,
without a separate cached head veto. Additional confirmations still require
the configured depth. Automatic polling is 21 attempts/1500ms, bounded by a
45-second monotonic read budget (each RPC also has its existing 15-second cap).
This supersedes the previous three-attempt/750ms note. The separate 90-second
wallet response wait remains. Same hash only; no automatic resubmission.
Persistent faults retain recovery, and the client displays the specific pending
reason. Economic, original gas, identity, genesis and reorg checks remain.

54 wallet and 42 client checks pass, with seven new cases. Read-only replay
confirms the actual mint without signing, acknowledgement or backend writes.
See reports/browser-wallet/AUTO_CONFIRMATION.md and docs/BROWSER_WALLET.md.
Refresh Chrome to load the changed client; actual extension acceptance remains
open. No service/Anvil restart, contract change, public deployment or monitor
restart. Keep main, preserve unrelated drafts, maintain Todo/features/operator
procedures and both memories. Production remains NOT APPROVED.

## Mint confirmation and local read latency - 2026-10-20

The user confirmed the minted NFT appears after Recover status. The successful
mint was inspected on-chain; the original UI failure cause is not established.
Wallet submission now has a separate 90-second response wait (read RPCs retain
15 seconds), and receipt faults retry the same hash up to three times. Never
resubmit a payment automatically or erase unresolved recovery records.
Same-account/session refresh preserves labeled confirmed cards with actions
disabled; failed reads and account changes do not present cached values as current.
Confirmed LP execution still controls artwork and sound.

The local serialized portfolio read now reuses its literal-loopback HTTP
connection, closing it at the end or on failure. Chain, canonical hash, response
identity, size and work-budget checks remain. Default production RPC transport
is unchanged. Eight-NFT state reads measured 6.057s before, 3.723s cold and 1.904s
warm after. This is not production capacity qualification.

48 signer, 8 contribution-flow and 35 Python cases pass; website build passed.
Read reports/browser-wallet/MINT_WAIT_PERFORMANCE.md and docs/BROWSER_WALLET.md.
Only the web process changed to 21472; original Anvil10988/RPC61752, session,
revision22 and eight NFT owner/LP/reward/trait records were preserved. Always
read running.json before process control. No holder/operator test transactions,
public deployment, unchanged Solidity rerun or paused-monitor restart.
Use main, preserve unrelated drafts, keep the single Todo ledger/features/operator
procedures and both memories consistent. Release remains NOT APPROVED.

## MetaMask connection and approval recovery - 2026-10-20

Connection diagnostics now distinguish site-authorized account, network ID and
exact local RPC/genesis. Reconnecting uses fresh public reads; importing/selecting
Test A in MetaMask alone does not authorize it for the site. Failed verification
never marks the connection ready. Gas-limit padding is tolerated only within hard
policy and canonical paid-gas/price/cost limits from the unchanged original review.
Economic fields, nonce and submitted gas-price ceiling remain exact. Never clear
an unresolved journal or repeat a confirmed approval.

31 Python, 41 connection-adapter and 44 signer cases pass in scoped runs.
The user's existing MetaMask approval fbcd791c...a0c86e7 was independently verified
and recorded without resubmission; this is not complete extension-flow acceptance.
Only web process 10672 was replaced by 25784; Anvil10988/RPC61752, session and all
six NFT owners/LP/activation/claimable balances were preserved. Port8900 remains
the local fixture. Read running.json before process control; never reset Anvil
to resolve a page error. The external fixed-fixture recovery helper never owns
or terminates that chain. See the contract report
reports/browser-wallet/CONNECTION_RECOVERY.md and docs/BROWSER_WALLET.md.

Production must request Robinhood Chain using independently reviewed deployment
configuration; current signing remains local31337 only. Public server/signing,
unchanged Solidity and paused monitoring are untouched. Main only, preserve
unrelated drafts; central Todo, features, operator procedures and both memories
are maintained. Production remains NOT APPROVED.

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

## Independent local wallet execution - 2026-10-20

The current 8898 service pins the sender nonce for each exact server-held review.
Other-wallet transactions no longer invalidate it solely by advancing the shared
revision. Same-wallet activity, expiry, owner/lifecycle changes and increased gas
still require new review. Two actual local mints reviewed at revision34 both
confirmed (#15 for wallet A, #16 for wallet B); the existing 14 NFTs and their LP
were preserved. See contract reports/local-wallet-concurrency/NONCE_VERIFICATION.md.
No website code changed in this follow-up; its previous 64-case source bindings
still match. 70 distinct affected backend Python cases pass. Reload both pages
following the web-only service upgrade; recover saved operations by the same ID.
Anvil was not restarted. Public deployment/production wallet qualification remains
open; port8896 was not upgraded. Keep main and preserve unrelated drafts.

## Second-wallet service contention - 2026-10-20

The exact pre-handler `/action` busy response now waits with the identical saved
operation ID, revision and payload: at most 30 attempts within the existing
90-second request timeout. This supersedes older blanket no-submission-retry
notes only for that specific response. Lost or ambiguous responses keep durable
recovery; stale reviewed drafts require fresh review. The dialog provides Recover
status for unresolved intent. Reload both browsers; do not clear storage or reset
Anvil. 64 focused checks and a real service-lock/pre-ledger-rejection probe pass.
No production contract/backend or public server change.

## Independent browser sessions - 2026-10-20

Local Chrome/Codex clients now reconcile newer unsigned confirmations against
confirmed chain state, rather than rejecting them against stale cached revisions.
The refresh/reprepare path is bounded and never submits. An operation after review
still requires fresh review; explicit rejection refreshes balances, ambiguous
responses retain saved-operation recovery. Reload both pages to load the update;
no service/Anvil restart or NFT/LP reset. Public static behavior is unchanged.
59 focused checks and concurrent unsigned preparation against running 8898 pass.
See contract reports/local-wallet-concurrency/VERIFICATION.md. Production wallet
integration and hosting qualification remain open; no public deployment.

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

## Local preparation and balance contention - 2026-10-20

The local adapter retries only exact pre-handler busy responses for GET /state
and unsigned POST /prepare (30 attempts maximum, one 90-second request timeout).
Account/state changes cancel queued preparation. No /action submission or lost
response is automatically retried. Draft lifetime includes processing from the
final preparation attempt; rejected busy attempts create no draft. Keep explicit
approval/Entry confirmations. The running 8896 service serves this code directly;
reload the page without resetting its NFTs. Forty-three client cases pass and a
live unsigned activation review recovered after seven busy responses with zero
submissions and unchanged revision. Contract evidence: reports/local-preparation-busy.
Local ETH/USD is absent: history USD can be unavailable independently of confirmed
LP and exact ETH claims. Public signing/hosting qualification remains open.

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

## Approved static twin circuit routes - 2026-10-20

The user explicitly chose **Vertical ribs**, not Orbital rings, for replacement.
Its display label is now Twin circuit routes: two groups of four continuous
static traces following opposite sides of the egg, with no chips or animation.
Keep the original texture, rarity materials, colors and evolution borders.
Retain stable pattern ID `ribs` / numeric slot 3 and every inventory assignment
and image path. Only the 696 artwork states and reference metadata in that slot
change; the other three patterns remain byte-identical. Apply palette colors to
the traces, with neutral highlight for Onyx. This is visual, with no reward,
rarity, supply, wallet or on-chain LP/accounting change.

The NFT detail view omits the Previously claimed frame at the user's request.
Keep 24h/all-time earnings and current Rewards to claim. Lifetime claim accounting
remains intact; earnings include claimed and unclaimed rewards, not only payouts.

## Gallery, sample rewards and confirmed tier celebration - 2026-10-20

Artwork cards have one evenly spaced trait row below evolution: rarity, color
style, individually colored palette names and fixed royalty multiplier. Hide the
pattern label here, retaining artwork, filters and metadata. Dormant multipliers
are gray, not zero. Preserve four evolution columns and horizontal mobile comparison.

Remove the one-choice pool selector and Collection pool filter/column. New demo
activations still target ZZZ/WETH (ETH display); legacy saved pool IDs remain
replayable. Local fixture routing and production pool controls are unchanged.

Append one idempotent `claim-testing-20261020` sample funding event after saved
actions, under the existing cross-tab event lock. The sample $864.96 LP receipt
allocates 80% by attached LP, 10% equally among active NFTs, with 5%/5% excluded
from holder balances; a separate $100 royalty receipt uses active rarity weights.
Preserve principal, traits and cumulative claims. No replay/refill on refresh after
claiming, no dormant/retroactive entitlement, no reset of saved holdings. The
starting portfolio remains four colors: Dormant, Enhanced, Enhanced, Singularity;
Legendary is a separate rarity, not an evolution. User contributions may evolve it.
Old undated net 24h earnings remain unavailable. Public amounts are simulations.

After a successful contribution and confirmed higher LP/tier, use the supplied
ACTI clip for activation (3.69 seconds; the user approved its full audible sound)
and EV for later upward evolutions (1.425 seconds). Only surrounding silence was
removed; keep originals unchanged. This supersedes the synthesized chime and the
original 1.5-second ACTI limit. Both are audio-only AAC/MP4 for compatibility with
existing local fixture asset lists. Prefetch, decode once after a user gesture,
then start the selected sound and image crossfade in the same render frame.
Local mode requires a successful receipt plus refreshed increased LP and higher
evolution in the same session/account. Approval, wrapping, claims, failures,
ordinary refreshes and same-tier additions never celebrate. Wait for the image;
reduced motion suppresses the highlight, unavailable audio never blocks financial
actions. Duplicate card/dialog views play one cue. No on-chain behavior changed.
Shared effect exports live in artworks.js, already allowed by existing local
server resource lists; do not add a new required module without compatibility
checks or force a chain restart. Normal publication is local verification, main
commit/push, then website deployment.

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

## Portfolio image navigation - 2026-10-19

Clicking an NFT image in My NFTs opens that NFT's position and rewards breakdown,
matching its detail link and the existing local-contract adapter. The image inside
the preview breakdown can still open enlarged artwork. Accessible button labels
describe the new action. No balances, transaction behavior, operator procedures
or central Todo status changed. Verify this small navigation change with syntax,
build and browser checks; unchanged accounting tests need no rerun.

## NFT breakdown copy - 2026-10-19

Removed the repeated principal disclaimer below Attached liquidity in both the
main-site and local-integration NFT breakdown. Other principal disclosures remain.
Gross trading-fee history still means fees before the 80/10/5/5 allocation, distinct
from claimable LP rewards and royalties. This is presentation-only: no accounting,
operator procedure or central Todo status changes. Earlier test evidence retains
its original scope; this copy follow-up uses syntax/build and browser verification.

## NFT card traits and reward summary - 2026-10-19

My NFTs places the fixed NFT-sale royalty weight below the artwork pattern using
the same trait typography; dormant weights remain gray. Cards show LP attached; active cards also show one
Rewards to claim total (LP plus royalties). Reward components,
earnings history and cumulative claims are grouped in the detail breakdown.
The local adapter sums exact balances only within the same currency; no assumed
ETH conversion or USD price. Dormant NFTs have no reward section. Saved holdings,
transactions, backend and contract semantics are unchanged. Thirty-five focused
JS tests, syntax/build and main-site browser checks pass. Public server unchanged;
production integration remains open. Use main and Git for publication status.

## Concurrent website/API resilience - 2026-10-19

Read FRONTEND_STATE.md; API/runbook evidence lives in the contract repository.
The API now admits bounded independent spawned requests (4 workers/8 connections
per process by default), with absolute ingress/header limits, explicit busy replies
and failed-cleanup quarantine. Main website has an immutable exact-storage cache,
15-second/navigation cancellation for unsent previews and strict local confirmation
expiry/context checks. Scoped evidence: 47 Python and 90 JS passes, static build
and browser check. No Solidity/unchanged broad suites rerun, public service change,
signer expansion, public transaction or monitor restart. Keep the local signer
serial. Hosting/provider/Linux and multi-device wallet qualification remain open.
Todo/features/operator procedures updated; main only, check Git for publication.
Preserve unrelated drafts and the user's current example positions. Release NOT
APPROVED. The public site remains a simulation.

## Main website interaction hardening - 2026-10-19

The user requested improvements in the actual website, not just its local test
harness. Default app.js now tracks independent per-NFT actions, rejects overlap,
uses locked latest-state commits across tabs, and invalidates pending work on
reset or wallet/network changes. Wallet selection restores silently across reload;
dormant financial controls are hidden, royalty traits remain visible, and changed
artwork crossfades. See FRONTEND_STATE.md and the contract frontend-state evidence.
Default mode is still a simulation; the local adapter/server remains unchanged.
Production wallet/receipt recovery, multi-device signing and service/load approval
remain open. No public deployment or paused-monitor restart. Main only.

## Local activation-review follow-up - 2026-10-19

The review form shows validation/progress/errors inside the NFT dialog. Confirmed
approval preserves acknowledgement only for the same session/account/NFT/amount;
Entry still requires separate review/confirmation, and amount edits clear it.
Only the activated/topped-up NFT gets the artwork Updating badge. Other cards
retain their images while stale financial values/actions remain guarded. UI only;
reload the page, no service restart/public deployment/contract change. Main only.

Local wallet labels are Test wallet A / B. The website is not a marketplace: secondary NFT sales happen on OpenSea. The local transfer control is only an ownership-accounting rehearsal.

## Local refresh and evolution - 2026-10-19

Local wallets arrive from the fast /session handshake and persist across navigation
and soft refresh in tab session storage, bound to the exact disposable deployment.
Confirmed NFT artwork stays visible with an updating label during slow reads;
stale balances are masked and transactions disabled. Only a confirmed changed
evolution image crossfades, after loading; reduced motion skips the animation.
Dormant cards/details omit rewards/history. Active cards split Claim and Grow
attached LP. Sticky activation, not current artwork tier, controls eligibility.
Read contention retries only the explicit busy response within finite bounds;
confirmed writes never become retryable new actions after a balance-read failure.
Production multi-user wallet/service qualification remains open; never expose
the local two-account signer. See LOCAL_INTEGRATION.md and contract evidence.
Public website/server and paused monitoring remain unchanged. Use main.

## Royalty multiplier display - 2026-10-19

Local NFT cards show the fixed revealed rarity multiplier (Commun ×1 / Rare ×2 / Legendary ×3), grayed while dormant. Do not use effective ledger weight zero as the displayed rarity multiplier. Unrevealed remains unknown. This is presentation only; activation eligibility and accounting are unchanged.

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

# AAA / ZZZ PoPL project context

Recorded on 2026-10-14 from decisions in the project conversation. Update this note when the user changes those decisions. This is durable project context for future work in these repositories.

## Overview explainer video - 2026-10-16

- The Overview hero now places “Understand PoPL · 26 seconds” beside Explore the collection, opening a self-hosted silent video in a dark responsive dialog. This replaces the hero’s How it works shortcut; the lifecycle section and #how-it-works route remain available.
- The approved video is revision 7: 1080 x 1350, 30 fps, 26 seconds, no audio. Each completed chapter includes two extra seconds of reading time. Original egg artwork, activation-to-NFT-to-vault flow, both fee streams and transfer of both rights remain intact. Video and poster are versioned under assets/videos/.
- Play starts on the button click, never on page load. Native video controls support pause/seek/replay. Closing, Escape, backdrop click and route changes stop and reset it. The dialog uses native focus handling, a screen-reader explanation, a download link and a no-autoplay preload policy. Local preview now supports MP4 byte ranges; production remains static hosting.
- Website-only presentation change: no economics, storage state, smart-contract code or wallet transaction behavior changes. Follow the required local verification, commit/push and server deployment order; record final publication evidence outside source.

## Artwork comparison and royalty preview - 2026-10-15

- Artwork defaults are Cyan / Monochrome / Flowing arcs, with Dormant, Activated, Enhanced and Singularity as four consistent columns. Default rows are Commun, Rare and Legendary. Mixed styles interleave complete evolution families, never individual stages. On narrow screens the comparison scrolls within its own keyboard-accessible region.
- NFT detail and portfolio cards show Royalties to claim separately. Total claimable includes LP owner, collective and royalties. Previously claimed is the NFT's cumulative LP-plus-royalty history, rather than the most recent payment. LP trading-fee histories/principal remain unchanged.
- The separate funded example royalty round assigns $12.50 per activated rarity unit; #444 has $12.50 pending, #128 has $25 pending, #91 has $37.50 royalties already claimed and dormant #74 has zero. Default claimable/claimed states and all four colors remain intact. Mint/activation/top-ups receive no retroactive royalty allocation.
- Preserve localStorage v7. Existing claim events without scope remain LP-only on replay; new combined claims persist scope=all. Claimed LP and royalty counters accumulate separately and are summed for display. No real wallet transaction, payment, backend connection or enforced royalty policy is added by this UI work.

## Eight-color artwork expansion — 2026-10-15

This current section supersedes the older six-color/72-variant implementation notes below. Preserve the dated notes as historical evidence. Current economics remain a 0.05 ETH dormant mint, $100 net deployed LP activation and 80/10/5/5 LP revenue allocation with equal collective membership; Power is removed. Website actions remain simulations and contracts remain undeployed.

- User-approved base colors are Cyan, Blue, Violet, Emerald, Amber (yellow), Crimson (red), Ivory (warm white) and Onyx (black). Color is purely artwork and independent of rarity or rewards.
- Allowed bicolor palettes have two distinct colors and at least one of Ivory/Amber/Crimson/Onyx (22 pairs). Tricolor adds Amber/Crimson/Onyx to an allowed bicolor pair with three distinct colors (28 triples). With 8 monochrome palettes, there are 58 unordered colorways.
- The four approved circuit patterns are Flowing arcs, Segmented panels, Orbital rings and Twin circuit routes (stable ID ribs). Original egg silhouette, texture and rarity finish are preserved; code-native SVG compositions add palette and circuit variation.
- The finite 1,000-entry artwork inventory is 200 monochrome / 500 bicolor / 300 tricolor. Each style has exact 60/30/10 rarity composition, totaling 600 Commun / 300 Rare / 100 Legendary. A complete palette/pattern/rarity design occurs at most four times; Legendary finished designs are unique. Every palette is available in each rarity. Color style and pattern confer no economic benefit.
- The rendering catalog covers 58 palettes × 4 patterns × 3 rarities × 4 evolutions = 2,784 states, not 2,784 NFTs. Original 72 PNGs remain preserved. Metadata exposes color style, palette, assigned colors, circuit pattern, rarity and evolution separately from royalty weights.
- First 100 demo NFTs consume fixed inventory entries with 20/50/30 styles and 60/30/10 rarities. New preview mints consume unused inventory entries, preserving full-supply quotas and visual repetition limits. Displayed NFT IDs and fixed inventory slot IDs are separate. Preview randomness is deterministic; no live VRF or transaction is requested.
- Default owned positions remain Cyan Enhanced #444 and Blue Singularity #128 (claimable), Emerald Enhanced #91 (already claimed), and Violet Dormant #74. Financial examples stay $425,000 LP, 100 NFTs and 20 dormant positions. Storage namespace v7 starts the new inventory without deleting previous namespaces.
- Artwork filters support contained color, color style, pattern, rarity and evolution. Mint artwork controls are for exploration only; they do not select mint traits. Colors and patterns are visible in NFT detail/portfolio traits, while LP and royalty economics remain unchanged.
- Public pages omit repository/source links and prompts. The footer links to the ZZZ website (`https://zzz.protocol.link/`). X and Telegram use native icon buttons with coming-soon feedback until the user supplies their official URLs. Private repository and deployment documentation keeps its GitHub references.
- This entry records the implementation candidate. Check final publication evidence before claiming a GitHub/server release. Website rendering and metadata examples do not prove production contract behavior, authentic VRF support or metadata hosting readiness.

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
- The user later removed the supplied NFT JPEG from Overview to avoid repeating it. Keep it on Mint with its enlargement arrow. Overview leads with a native liquidity snapshot, then trading/fee figures, a five-step lifecycle, the fee calculator, and the existing dark allocation section.

## Website implementation and verification

- Buildless HTML/CSS/JavaScript with Node.js 20+ standard-library tools and no third-party runtime dependencies.
- Routes: `#overview`, `#collection`, `#mint`, `#my-nfts`. Local preview: `http://127.0.0.1:4173`.
- Commands: `npm run dev`, `npm test`, `npm run check`, `npm run build`. Static output: ignored `dist/`; source files and original assets are committed.
- Browser wallet support uses injected EIP-1193/EIP-6963 providers or a demo wallet. It only requests public accounts and chain identifiers. It does not sign, approve tokens, or submit blockchain transactions.
- All displayed positions and actions are labeled simulations. Connecting a real wallet still displays the example portfolio, not that address's actual on-chain holdings.
- Preview events persist under localStorage key `zzz-popl-preview-v4`; wallet connections do not persist. The footer's Reset demo restores the baseline dataset.
- Example portfolio includes NFTs #444, #128, #91, and dormant #74. Claims change funded example balances without reducing LP or generated fee history. Cent allocation conserves each displayed total.
- Most recent automated verification: 25 Node tests passed; syntax, unique IDs, local references, application selectors, and four routes passed. The redesigned Overview was checked at desktop width and at 390px mobile width without horizontal overflow. Overview contains no NFT JPEG, Mint retains its illustration/enlargement button, the 0.25% calculator example returns $720.80, and the browser reported no console errors.

## Contract candidate and integration boundary

- No public-chain contracts are deployed. Commit `14b773ee3612a80c32a01761c334080abd083e15` implements the 0.05 ETH dormant mint, separate current-owner activation with at least $500 of actually deployed LP, permanent top-ups and unchanged reward checkpoints. The previous free deposit/issuance entrypoint is removed. Deployment and independent review remain outstanding; the website remains a simulation.
- The candidate targets hookless Uniswap v4 static-fee pools with conventional ERC-20 assets, including WETH rather than native ETH. It contains 16 Solidity modules, lifetime contribution/Power accounting, funded reward checkpoints, and bounded reward assets.
- The user requires future unknown EVM chains/pools and repeated LP migration: close LP, bridge attributed principal between protocol vaults, then create LP again. The candidate now supports post-seal timelocked append-only route onboarding, remote-to-remote canonical graph approval, repeated migrations/returns, authenticated custody epochs, immutable ACK snapshots and legacy reward delivery. NFTs and contribution Power remain on their original canonical chain. A production transport, native-ETH/hook integration and live multi-chain validation are not supplied. Approving future destinations is a governance trust power, not proof that arbitrary destination code preserves principal.
- Governance is the deployment-selected `GOVERNANCE_MULTISIG`, which remains unset. NFT owners do not automatically vote. The local template has a two-day timelock plus two-day migration delay; executors may execute only the exact approved operation. Sealing removes bootstrap setup authority and fixes module bindings while allowing timelocked new route approval.
- The selected actual market is Robinhood Chain (4663) ZZZ/native ETH, pool `0x6538e2c223ed70228114983afecbe5e69fe627e2fafdf367bdd6bdeff2ad391f`, token `0x7dbf38976f6D3b9c529e7D9484A71898B409eE6a`, fee=0, tickSpacing=200, PonsV2MemeHook `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`. Core LP fees are zero; hook fees follow creator/Pons recipient rules. Liquidity share does not grant a share of hook revenue. The user explicitly deferred deciding the project's reward integration. Details and primary sources are in `docs/ROBINHOOD_POOL.md`; previous website 0.30% figures remain hypothetical.
- Latest local implementation verification: 134 Solidity tests passed in 11 suites, four 1,000-case fuzz tests; 30 Python ABI/indexer tests passed; full compilation, all 16 module size gates and source consistency passed. Mock LP venues/bridge support an A->B->C->A->B test with no remint or Power change; this is not live chain/provider testing. Profile now uses Solc 0.8.26, via IR, Yul disabled, optimizer runs 1. Vault runtime is 24,439 bytes, only 137 below EIP-170. Evidence is in `reports/IMPLEMENTATION_UPDATE.md` and `reports/implementation/`. Ubuntu GitHub Actions passed for the published commit: 86 Python tests, 134 Solidity tests, compilation and size/source checks. Run: https://github.com/ABEF/AAA/actions/runs/38531875891.
- The initial contract repository import was committed and pushed as `a9707e89a8059c11bd1b8b0db82efa722ce5ddca`. Documentation was reorganized; original implementation and security-source checksums were preserved. Original historical README and manifest are under `reports/history/`.
- Initial native Windows Python validation ran 84 tests: 81 passed, one Unix-permission assertion failed, and two failed because `fcntl` was unavailable. On 2026-10-14, the repaired Ubuntu GitHub Actions workflow passed all 84 Python tests, source checks, contract compilation/size checks, and all 70 Solidity tests. Native Windows Foundry also passed all 70 Solidity tests. Run: https://github.com/ABEF/AAA/actions/runs/38525810030, commit `3c6f83ed87610869da740ce945b47f1673f73794`.
- CI repairs pinned the published Uniswap v4-periphery version `1.0.3` with a lockfile, disabled only Solidity 0.8.26's crashing Yul optimizer while retaining the EVM optimizer, and renamed a rollback test that accidentally matched Foundry's removed `testFail*` convention. All 16 contract source files remain unchanged. Vault runtime size is 23,451 bytes, within the 24,576-byte limit. Current repair evidence is in `reports/CI_REPAIR.md` and `reports/ci-repair/`; original historical reports remain separate. Real Uniswap fork integration, gas benchmarking of this compiler profile, production bridge transport, and an independent audit remain outstanding.
- Before enabling real minting, activation, deposits, or claims, implement/review the intended ABI, configure deployment addresses and chain, authenticated ownership reads, valuation sources, a reorg-aware indexer, funded claim balances, token approvals, and wallet-confirmed transactions.

## Public website deployment

- On 2026-10-14, the user authorized deployment to their Ubuntu server and chose the server IP rather than a domain.
- Initial preview URL: http://46.225.185.212. This first deployment used HTTP before the later domain/HTTPS setup below. The site's existing simulation boundaries still apply.
- Ubuntu 24.04 runs Nginx on port 80. Nginx is enabled to start after a reboot. The pre-existing service on port 8443 was left alone.
- Static document root: `/var/www/aaa-website/current`, pointing to `/var/www/aaa-website/releases/87b66e2-20261014`. Nginx site configuration: `/etc/nginx/sites-available/aaa-website`, with a `sites-enabled` symlink.
- The release contains the nine built public files from website commit `87b66e2ef19f5564e50b45f598ea3b4b1024d8f4`. All nine returned HTTP 200 with matching SHA-256 hashes from outside the server. Source notes and Git metadata are not served.
- There is no Node development server, Git credential, or server password in the deployed static build. Credentials must remain outside project files.
- README setup instructions use `git clone`, relative `cd aaa-website`, and commands from the clone's root. Keep public setup instructions independent of the author's local paths and compatible with Windows, macOS, and Linux.
- The user then selected `popl.0xwave.com` as the desired website hostname. DNS is managed by OVH; the existing `0xwave.com` site uses a separate server and must be preserved.
- The earlier Nginx configuration recognised both `popl.0xwave.com` and the server IP. A request using that Host header returned the correct build with a matching SHA-256 hash. OVH authoritative DNS reported that earlier subdomain did not exist.
- The earlier requested OVH record was type A, subdomain `popl`, target `46.225.185.212`, TTL default. The user instead created the `popldemo` records described below; agents have not edited the OVH DNS zone.

### Current hostname and publishing workflow

- The user actually published A records for `popldemo.0xwave.com` and `www.popldemo.0xwave.com`, both pointing to `46.225.185.212`. These are the current website targets, superseding the earlier requested `popl` hostname. OVH authoritative DNS and public resolver 1.1.1.1 both returned the correct IPv4 address on 2026-10-14; no IPv6 records were returned.
- Nginx routing must explicitly name both `popldemo` hostnames. A request for them previously reached the default welcome page because only the earlier `popl` hostname was configured.
- The HTTPS setup is tracked in `deploy/enable-https.sh`: a separate Nginx site for the two names, a Let's Encrypt certificate covering both, HTTP-to-HTTPS redirects, and a Certbot renewal timer and renewal check. Website code remains a clearly labeled simulation.
- Required workflow for every requested website modification: **edit locally → verify → commit and push to ABEF/AAA-website → deploy that committed version to Ubuntu → verify the public result**. This is standing user authorization to complete website updates across all three destinations. Do not deploy uncommitted product changes.
- `deploy/install-release.sh` publishes a checksum-verified static build into a directory named by its full Git commit, atomically switches `/var/www/aaa-website/current`, and preserves the previous release for rollback. `/var/www/aaa-website/deployed-commit` records the active commit outside the public document root.
- Do not change the `0xwave.com` root DNS or deploy smart contracts as part of website publishing. Preserve the separate root-domain site and the existing port-8443 service.

## Handling context and credentials

`AGENTS.md` points agents to this note when working in the corresponding project directory. This does not imply global ChatGPT personal memory is enabled. Keep the copies in both projects aligned after material decisions. Do not store pasted tokens or credentials here or in Git.

## Local egg library and clearer Overview (2026-10-15)

- The user explicitly requested this website work **locally only**. Do not commit, push or update Ubuntu for this pass. This overrides the normal three-destination publishing workflow for the current changes.
- Keep 100 baseline example positions with **72 artwork variants**, not 72 minted positions: Cyan, Blue, Violet, Emerald, Amber and Crimson × Commun/Rare/Legendary × Dormant/Activated/Enhanced/Singularity. Generated PNGs and preview metadata live in `AAA-website/assets/nfts/`.
- Rarity and color stay fixed per NFT. Activation and permanent LP additions select its next evolution image. Threshold illustrations: $0/$500/$1,000/$10,000. The newer egg direction supersedes the old cube and six-level illustration.
- Latest border correction: Enhanced uses the lighter/finer outer frame; Singularity uses the brightest/boldest near-white double frame and retains its background light. Do not swap the whole egg images or remove the Singularity background.
- Commun/Rare/Legendary have separate NFT-sale royalty redistribution weights ×1/×2/×3 only after activation; dormant weight is zero. These weights never affect LP fee allocation or Power, and do not multiply a marketplace royalty rate. Mint preview options explicitly say “royalties shares”. Position cards say “Permanent LP attached” and “NFT-sale royalty weight”, without the redundant “Separate from LP fees” line.
- The new Artwork route has color/rarity/evolution filters, pagination, image enlargement and example metadata downloads. Mint has a visual explorer; exploration does not select mint traits or change dormant minting. Example trait assignment is deterministic for preview only; production rarity assignment and funded NFT-sale royalty contracts remain unimplemented.
- Overview is reorganized into one collection snapshot, three lifecycle steps, LP revenue allocation, separate NFT-sale royalties, and a compact essential FAQ. The repeated architecture and benefit blocks are removed; the hypothetical fee calculator is expandable. Financial baseline and 50/30/10/10 allocations remain unchanged.
- Source checks pass for all five routes and 72 artwork/metadata entries. All 33 Node tests pass, including rarity independence from LP rewards and artwork changes across activation/top-ups. The Overview calculator still gives $720.80 at 0.25%; mobile checks show no horizontal overflow. No Solidity source, real transaction, GitHub publication or Ubuntu deployment is part of this work.

### Latest steering: activation-first presentation and 80/10/5/5

This supersedes the earlier $500 and 50/30/10/10 website preview decisions above, for the current local-only website changes. The user changed activation to at least 100 USDC or $100 worth of ZZZ at its price. The preview form now accepts ZZZ/USDC as a contribution choice and validates a minimum $100 USD-equivalent; it does not invent a ZZZ price, token quote or conversion execution. Activation funds permanent LP attributed to that NFT, and later additions grow its attached LP allocation. Holders claim funded fee rewards only; principal cannot be redeemed. Trading fee rights have no expiry, and a buyer inherits the same attached LP allocation and reward rights. LP market value and actual rewards are not guaranteed.

Overview now leads with this NFT-to-attached-LP relationship. Collection total LP remains visible; the pool-share percentage is a small contextual figure with no progress bar or implication of a 100% target. Repeated sections remain removed. Latest user allocation: **80% NFT owner / 10% collective / 5% compounding / 5% buyback and burn**. Updated chart, calculator, Mint text, history budget and tests. $864.96 is allocated $691.97/$86.49/$43.25/$43.25 using deterministic cent remainders. Lifetime compounding budget is $3,027.36. Existing funded example claim balances are illustrative and separate from the gross allocation calculator.

All 72 final PNGs are installed locally, including 36 revised Enhanced/Singularity frames. Built-in image_gen was used; initial originals are preserved. Exact initial and edit prompt sets are in the contract project's `design/nft-metadata/72-variants-prompts-v1.json` and `border-swap-prompts-v2.json`. Preview metadata now uses $100 for Activated. The website's 100-position baseline, $425,000 LP and gross fee history are preserved; locally saved user preview events can increase the displayed supply/LP.

Important boundary: the Solidity candidate still has its existing $500 activation and prior allocation rules. No Solidity source or deployment configuration was changed for these website requests. Applying the new economics to contracts requires separate implementation and security verification. No commit, push, Ubuntu update, real transaction or contract deployment occurred.

Default demo portfolio explicitly confirmed: one Dormant (#74), two Enhanced (#444/#91), one Singularity (#128). The user requested restoring these four starting positions; the local Reset demo action restored the $425,000/100-position collection baseline and removed simulated extra mints. A test assertion now protects the four-state portfolio composition.

### Final border rule: single Enhanced, double Singularity

The user clarified after reviewing v3: **Enhanced needs exactly one bright border; reserve the double border exclusively for Singularity.** Preserve Enhanced's stronger egg-seam/rim highlights so it remains visibly above Activated. This supersedes the earlier Enhanced double-frame experiment. Final Enhanced generation/edit prompts are `design/nft-metadata/enhanced-single-border-prompts-v4.json`; v1-v3 evidence remains historical. The final PNG library still has72 variants, not additional NFT positions.

Read-only contract answer: `ZZZVault._join` accepts one-sided input of a configured pool token and invokes `_balanceUsing`; `ZZZStrategy._plan` derives the swap ratio from the actual price/range requirements rather than a fixed50/50 division. Slippage, net-value and deployed-LP checks can revert an unsuitable deposit. The current candidate rejects native ETH and hooked pools; the selected Pons pool is unsupported. USDC-to-ZZZ/ETH arbitrary-input routing is not implemented. No Solidity modification or new contract test run was implied by this answer.

Final local verification after single-border v4: 33 Node tests passed; 75 HTML IDs/five routes and all72 artwork/metadata pairs checked; static build155 files, source/build SHA256 matched,148 local HTTP checks passed, private notes404. All36 revised Enhanced/Singularity assets retain unique hashes. Representative card-size comparison and final corner-refinement images visually checked; no browser console errors. Temporary QA tabs/server were closed; the main4173 preview remains available.


### Commun Enhanced border correction (v5)

The user approved Rare and Legendary borders and requested correcting Commun Enhanced only. Updated the six Commun Enhanced PNGs to one clean continuous bright border matching the approved Rare Enhanced frame in each color; removed detached corner inserts and extra inset rails. The Commun egg and stronger lighting are preserved. All other 66 artwork PNG hashes remain unchanged. Singularity retains its exclusive double border.

Manifest v5 records the new hashes; exact built-in image_gen prompts and provenance are in the related contract project's design/nft-metadata/commun-enhanced-border-prompts-v5.json. Checks passed: all 72 unique artwork/metadata pairs, 155 source/build file hashes, 148 local HTTP checks, and visual gallery verification of all six corrected images. No application logic, economics or contract changes. Local only; no commit, push or server update.

### Overview NFT-to-LP card redesign

Latest requested card layout: centered PoPL #444 above the actual dynamically selected egg artwork; Permanent LP attached and its USD value below. Removed the old diamond and extra LP ATTACHED badge. Added a ZZZ/USDC contribution-to-permanent-LP diagram and an infinity cue: Trading fee rights. No expiry. For whoever holds this NFT. Hold, sell/transfer, and permanent-principal explanations now use three matching icon rows, including a lock for nonredeemable principal. Funded-only claims and transferable allocation/fee rights remain explicit. Existing assets/economics unchanged.

Verified desktop and390px layouts (no horizontal/flow/capital overflow), dynamic image/enlargement target, keyboard enlargement and no browser errors. All33 existing Node tests passed for the app change; final source checks,155-file build/source hashes and148 local HTTP checks passed after the last markup/CSS refinement. Local-only scope continues; no commit/push or server update and no Solidity changes.

Overview contribution caption refinement: the user shortened the copy to "Activate from $100 in value" and requested placing it next to a longer arrow. It now sits above the conversion arrow, with ZZZ/USDC inputs left and Permanent LP right. Removed the standalone paragraph. Mobile uses stacked currency chips and a100px arrow; checked390px and320px with no page or flow overflow. Static source checks and local build passed. Existing local-only scope remains; no economics or contract change.

Restored four omitted Overview essentials after user review: rarity affects only NFT-sale royalty weights (Commun x1/Rare x2/Legendary x3, activated only, dormant weight0, no LP-share/Power effect or marketplace-rate multiplier); later contributions grow the same NFT allocation; LP allocation/unclaimed funded rewards/future fee rights follow a sale or transfer; and current preview evolution thresholds are0/100/1000/10000 USD. Kept the withdrawal, reward-risk and preview-status questions, for seven FAQs total. The rarity answer is first and expanded by default. Local source checks/build passed, accordion behavior and visible copy verified, no browser errors. Local-only scope remains; no economics, Solidity or publication change.

Latest Overview order: hero/NFT card, How it works, LP revenue, NFT-sale royalties/artwork, collection statistics, then A few essentials and the closing links. Moved the complete existing liquidity/share/fees/volume/disclaimer block directly before the FAQ without changing its content, values or bindings. The card lock row now reads "LP stays attached." with the principal restriction unchanged. Source check/build and browser adjacency/value verification passed. Local-only scope continues.

Latest local Overview refinements: collection LP total and pool-share text are centered independently of the positions link (desktop and390px center offset0, no mobile overflow). The hero explanation is three bullets with only Activate, liquidity and rewards emphasized. Lifecycle step02 now says "Activate from $100 in ZZZ or USDC value. Add more to grow its permanent LP." Step03 says "Fee rights have no expiry and follow the NFT. Hold it to claim funded rewards." Both explanations visually occupy two lines at the current desktop preview size. Source checks/build passed after the final copy edit. Local-only scope and all economic values remain unchanged.

Latest Overview visual/copy decisions supersede the earlier large centered snapshot and bottom-before-FAQ placement. The collection figures now form a compact two-row desktop summary directly below Explore the fee calculation: attached LP,24h fees,lifetime fees,24h ZZZ volume; then pool-share context,10-week example,0.30% gross-fee assumption/funding-not-live disclosure and the existing positions link. Values and metric bindings are unchanged. It wraps naturally on phones rather than hiding financial context. Verified84px desktop height and one-line context; no horizontal overflow at390px or320px.

The artwork summary below rarity cards is now a restrained panel with six named color swatches, a four-stage evolution guide ($0/$100+/$1,000+/$10,000+), and fixed-color/rarity explanation. Mobile uses2x2 stages. Links retain their existing destinations. Legendary copy is now "Brilliant mirrored platinum." (verified one desktop line). Lifecycle headings are "Mint. Activate. Earn." and "Earn the fee rights." The royalty section heading is "An additional reward share." and describes NFT-sale royalties alongside trading-fee rewards; rarity still has no LP fee impact.

Final local verification:82 HTML IDs/five routes/all72 artwork and metadata pairs checked;155-file static build passed and changed-source/build hashes match; desktop/phone browser layout checked without console errors. No image files, economic logic, Solidity, commit/push or Ubuntu update. Current local-only scope continues.

Latest local-only UI steering: removed the separate volume/swap-fee estimator and its app.js render function/listeners/import/call. Keep the direct collected-fee amount input and Last24hours/10-week history allocation options. Custom amounts only change the displayed80/10/5/5 split; history remains unchanged. The compact collection summary now follows allocation directly, with each number below its label and an assumptions/context line. This supersedes the earlier below-calculator arrangement because that calculator has been removed.

Allocation descriptions are concise single lines. The royalty introduction uses two lines with funded royalties and unchanged LP shares explicit. Artwork-page RARITY/EVOLUTION/THECOLLECTION blocks stay on one desktop row from681px (verified at1020px), stacking on phones. The overview color legend spans all six desktop columns; the four evolution nodes span the guide edge to edge. Activated has a cyan glow, Enhanced a brighter pale-cyan glow, Singularity the brightest white core/halo; Dormant is unlit. Phone layout retains2x2 stages and no overflow.

Verification: all33 existing tests passed after estimator removal;77 IDs/five routes/all72 artwork-metadata pairs checked;155-file build passed and four changed source/build hashes match. Browser tested10-week amount60547.20, custom1000 split800/100/50/50, restored24h amount864.96, two one-line royalty spans, numbers below labels, three desktop info blocks aligned, no390px overflow or browser errors. No economic logic, asset PNGs, Solidity, Git publication or server update. Current local-only scope continues.


Latest local-only Overview steering supersedes the prior restored collected-fee controls: remove the Last 24 hours / 10-week history buttons, collected-fee amount field and helper text. Keep the allocation chart and 80/10/5/5 rows, with illustrated amounts calculated from current collection 24h fees on each render; remove obsolete handlers/selectors. The six named color items now use full-row space-between distribution with identical gaps between item edges, replacing the first/last alignment exceptions that created uneven spacing. Mobile retains the three-column color grid. No economics, artwork asset, contract or publication change.

The user explicitly chose to restore the volume × swap-fee calculator behind the collapsed Explore the fee calculation + disclosure; do not restore the removed direct collected-fee controls. Keep its estimates isolated from collection history and allocation. Lifecycle introductory sentence is directly below Mint. Activate. Earn. across the available desktop width. Removed the compact statistics context line beginning 34% of $1,250,000, including its 10-week/assumed-fee wording; retained the positions link. Existing overall demo labeling and calculator assumptions remain.

Section labels 01 / HOW IT WORKS and 02 / LP REVENUE share the same cyan color, monospace typography and size (10px desktop / 9px phone), avoiding the revenue paragraph styling overriding its eyebrow.

Verification of this local Overview revision: all33 existing tests pass; source check81 IDs/five routes/72 artwork-metadata pairs; static155-file build passes. Browser confirms desktop color-item gaps differ by less than0.02px, identical01/02label color and size, one-line desktop lifecycle subtitle, no direct fee controls or removed context copy, restored collapsed calculator864.96 at0.30%,720.80 at0.25%, arbitrary848500volume supported, and unchanged collection history.390px phone layout including expanded calculator has no horizontal overflow. No browser errors. No commit, push, Ubuntu update or Solidity change.


Latest local-only steering supersedes the restored calculator: remove the entire Explore the fee calculation disclosure, formula subtitle, calculator fields and app rendering/listeners/import. Collection baseline calculations and displayed allocation remain unchanged. The See all positions link is now an 8px shortcut absolutely positioned in the compact statistics frame bottom-right; remove its old full-width wrapper and row. Reserve only a few extra pixels of bottom padding so it fits without overlapping the numbers. No publication or contract change.


Local Overview spacing refinement: reduce hero bottom padding44 to28px; lifecycle top/bottom58/58 to36/34px; revenue top55 to34px, preserving revenue bottom55px. Phone uses hero bottom28px, lifecycle30/32px and revenue30/40px; other section padding unchanged. This reduces the gap before How it works and before LP Revenue without changing copy, artwork, economics or page behavior. Local-only scope continues.

Local Overview refinement: removed the top borders and their top padding from the three lifecycle articles. The How it works heading, introduction and three steps now read as one section on desktop and phones. Other section borders and economics remain unchanged; local-only scope continues.

Local royalty introduction: An additional reward share. is one heading line, with the two-sentence explanation below it. Intro uses royalties (no funded qualifier); other claim and allocation descriptions remain unchanged. Keep royalties emphasis and rarity independent from LP fees. Mobile heading scales to fit; local-only scope continues.


Local LP Revenue presentation: remove all four example dollar allocations (691.97/86.49/43.25/43.25), retaining the 80/10/5/5 percentages, chart and explanations. Remove the obsolete allocation render function/call and unused live-region attributes; use two-column dot/text rows. Collection statistics, underlying fee-split accounting and contract code are unchanged. Local-only scope continues.

Shortened LP Revenue introduction to: Revenue serves four purposes. LP sets your reward share; rarity has no effect. Keep it within two lines in the preview, retaining LP/rarity distinction.

Latest local LP Revenue introduction: Revenue serves four purposes. LP sets your reward share. Removed the rarity clause here at user request; other rarity explanations remain.

Local Mint-page refinement: removed the Give ownership / a real foundation promotional block, its activation paragraph and three numbered benefits. Artwork explorer/enlargement and mint form remain. No mint or activation logic change; local-only scope continues.

Latest local Mint subtitle: Start with a dormant NFT. Activate it to start earning. User-requested wording only; simulation and claim restrictions unchanged.


Local Overview artwork enlargement: omit the evolution LP threshold prefix (for example $1,000+ LP) when opening the featured PoPL #444 image. Keep the royalty weight, LP-rarity clarification and preview note. Artwork gallery and Mint enlargements retain their threshold context; metadata and artwork files remain unchanged. Local-only scope continues.

Latest local featured NFT example: PoPL #444 has1432 USD of attached LP instead of4270. Updated the shared baseline, Overview fallback and existing test fixture together. It remains Enhanced. The collection baseline remains425000 USD through the existing balancing calculation; the184 USD claim example remains. No artwork, contract or publication change.


Latest local Overview click behavior supersedes the featured artwork-only enlargement: clicking the NFT below PoPL #444 opens the existing shared position-details dialog, exactly as Collection row444 arrow does. This includes1432 USD attached LP, generated all-time/24h fees, Power, individual/collective rewards and claimable example amounts, with existing wallet-aware controls and simulation labels. Bind the button to data-nft-id and describe position details in its accessible label. Other artwork enlargement paths stay unchanged; remove the obsolete Overview-only artwork-caption option. Local-only scope continues.


Latest user decision: there is no Power in the website product. Remove the Power position statistic, Starting Power Mint row, Power wording in royalty/FAQ/collective explanations and unused preview data fields. Collective copy simply says shared among eligible NFTs; do not invent a replacement eligibility or weighting policy. The three position metrics (permanent LP attached, fees all time, fees last24h) share one row on desktop and phones. Preserve actual demo balances, fee-split logic, rarity behavior and simulation labels. This local website decision does not itself change the separate Solidity candidate; no contract edits or publishing are part of this task.

Position reward-history label now says Previously claimed, removing in preview at user request. The dialog header and other simulation disclosures remain.

LP amount labels now say LP ATTACHED (or LP attached in position cards), omitting Permanent at user request. Permanence/principal explanations remain.


Local Overview refinements: the collection-statistics See all positions and artwork-guide Explore all72 designs links now display only an arrow, retaining their descriptive accessible names and destinations. The artwork arrow stays top-right on phones too. All seven A few essentials FAQs start collapsed with plus indicators; no question is open by default. This supersedes the earlier initially-expanded rarity FAQ. Local-only scope continues.

Final local verification for the no-Power/label/shortcut/FAQ refinements: all33 existing tests passed; source checks74 IDs/five routes/72 artwork-metadata pairs and155-file static build passed. Browser verified exactlythree aligned metric cards and values at desktop,390px and320px with no overflow; labels LP ATTACHED and Previously claimed; no visible Power; both shortcut visible texts are arrow-only with descriptive accessible names; allseven FAQs initially closed with plus indicators. Existing80/10/5/5 and demo balances remain unchanged. No Solidity, Git publication or Ubuntu update.


## GitHub publication authorized (2026-10-15)

The user requested committing and pushing the accumulated local website work to ABEF/AAA-website. This lifts the local-only restriction for GitHub publication of the website. This request does not update the Ubuntu deployment or authorize any contract publication/deployment. Release verification: all33 Node tests passed, five routes and all72 artwork/metadata pairs checked, image hashes verified and a155-file static build passed. README now describes the final interface; earlier unpublished/local-only statements above describe their historical stage.


## Default portfolio refresh (2026-10-15)

The user requested four distinct colors and mixed claim statuses in My NFTs. Defaults: #444 Cyan Commun Enhanced ($1,432 LP; $184 claimable), #128 Blue Rare Singularity ($100,500 LP; existing example rewards claimable), #91 Emerald Legendary Enhanced ($1,200 LP; existing rewards moved to previously claimed), and #74 Violet Legendary Dormant ($0 LP; no rewards). Collection totals remain $425,000 and 100 positions, with 80 active and 20 dormant. Fees and rarity rules stay unchanged. Saved-state namespace is now zzz-popl-preview-v5 so old v4 claim-all actions do not override the requested defaults; old stored events are not deleted. New v5 actions remain persistent, and Reset demo restores this baseline. Follow normal local verification, GitHub publication and Ubuntu deployment for this change. No contract change or real transaction is authorized.


## Contract-aligned collection rules (2026-10-15)

Latest accepted economics supersede historical $500/50-30-10-10/Power references: activation requires at least $100 of net deployed LP; LP revenue is 80% NFT owner / 10% collective equally across active NFTs / 5% compounding / 5% buyback and burn. A 0.05 ETH dormant mint adds no LP. The collection cap is 1,000 NFTs, with exact rarity totals 600 Commun / 300 Rare / 100 Legendary. Production assignment is intended to use reviewed VRF and remaining-quota accounting. Website draws are deterministic simulations, not live VRF; a cap limits minted count, not NFT-ID values.

Keep 100 initially minted examples (60 Commun / 30 Rare / 10 Legendary), 80 active, 20 dormant, $425,000 LP and the four user-approved owned positions/colors/claim states. Keep all existing 72 artwork variants; no new palettes or PNGs are generated by this alignment. Preview mints consume remaining quotas, stop at 1,000 total, and still begin with ID #1001. v6 browser storage prevents obsolete v5 events from being replayed against the revised rarity seed; earlier storage is not deleted.

A 5% marketplace royalty is requested; payment is not enforced across all marketplaces. All royalties actually received go to the separate active-NFT royalty pool, weighted Commun x1 / Rare x2 / Legendary x3. Rarity never changes LP-fee shares. Evolution follows current LP valuation and may downgrade when value falls; this website has no live market price feed or revaluation simulation. Do not interpret a falling valuation as reversing activation or removing royalty eligibility.

The aligned contract candidate is under verification and undeployed. Reviewed market/VRF provider integrations, valuation, bridge transport, staged operating tests and independent audit remain release gates. This website is still a simulation and never signs or submits transactions. Normal publishing remains local edit/verification, commit and push, then deploy the committed build to Ubuntu and verify the public result; root is coordinating publication for this update.

Dormant NFT details omit the claim button. Activation and transfer remain available; after activation, the claim button is enabled only when confirmed claimable funds exist and local state permits it.

The activation form offers only ZZZ / ETH (WETH accounting identity). Pool labels
are omitted from NFT detail views. Existing legacy demo records are preserved.
The contract candidate permits one contribution pool at a time, with future
governed switches; this UI is not an on-chain deployment.

NFT breakdowns show one LP rewards line (individual plus collective) and a
separate Royalties line; the card total remains LP plus royalties.
