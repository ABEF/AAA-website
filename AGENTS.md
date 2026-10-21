## Real local API rehearsal and wallet totals - 2026-10-22

The reviewed API coordinator now has actual local-chain evidence: mint, native
activation, exact USDC approval, $5 growth and a combined ETH claim. A deliberately
interrupted post-claim API read recovered the same confirmed hash with one send.
Wallet-wide LP and funded ETH totals use bounded 16-NFT chunks at one confirmed
block and complete inventory; missing/partial/mismatched data never becomes zero
or a partial total. Historical earnings remain per NFT; collection-wide aggregation
and portfolio-wide historical earnings are still separate open work.

Read [runbook](https://github.com/ABEF/AAA/blob/main/docs/LOCAL_API_REHEARSAL.md) and
[scoped evidence](https://github.com/ABEF/AAA/blob/main/reports/api-chain-rehearsal/VERIFICATION.md). APIs, core contracts,
receipts and transfers are real on isolated Anvil; venue math, token markets,
feeds and VRF are explicit local substitutes. The signing test uses an EIP-1193
RPC shim, not actual MetaMask/Rabby acceptance. Shared BrowserWallet/BrowserClient
remain byte-identical and local-only; public DEPLOYMENT remains null.

Separate fixture: port8902, external api-chain-rehearsal/runs; read running.json
before process control. Prior8900 processes were already absent; its saved files
were untouched. Monitor remains paused; the deferred load campaign was not run.
No production Solidity change or public transaction. Main only; preserve unrelated
drafts and keep the sole Todo, feature evidence, operator guidance and memories aligned.
Publication is recorded separately; inspect Git and the publication receipt.

## Local API wallet coordinator - 2026-10-21

Publication: website code `d786286` and contract evidence `59739ea` are on main;
the static server serves `d786286`. All 5,598 server checksums and 50 scoped public,
host/redirect/privacy checks passed. Public DEPLOYMENT remains null. See
[publication evidence](https://github.com/ABEF/AAA/blob/main/reports/deployment-local-wallet/PUBLICATION.md).

The user explicitly chose **Keep the signer restricted to local Anvil** after
automatic approval review rejected the broader signer proposal. That proposal
was not executed. Shared BrowserWallet/BrowserClient remain byte-identical;
never generalize public signing from this work or treat it as release approval.

The reviewed API profile now has a local-only coordinator for mint, exact approval,
activation/growth and ETH claims. It requires environment rehearsal, chain 31337,
HTTP literal-loopback page and RPC. Nonlocal profiles remain unsigned. Approval
continues to a fresh complete LP review, never an automatic send or second approval.
Recovery retains the original journal/hash. Confirmed receipts with a lagging API
are labeled confirmed, with balances catching up. LP/artwork require the matching
Entry event and a confirmed active NFT position; claims do not mark artwork pending.

Read [operator procedure](https://github.com/ABEF/AAA/blob/main/docs/DEPLOYMENT_WEBSITE.md#local-api-wallet-rehearsal)
and [scoped evidence](https://github.com/ABEF/AAA/blob/main/reports/deployment-local-wallet/VERIFICATION.md): 84 affected
cases (57 API/session plus 27 coordinator) and nine headless browser scenarios.
The wallet/RPC are mocked; no actual extension or chain transaction was performed.
All 13 prior shared signer/backend bindings remain unchanged. Existing Anvil/8900,
wallet state, paused monitoring and the deferred load campaign remain untouched.
Public DEPLOYMENT is null. Production integration/qualification and independent
audit remain open. Use main; preserve unrelated drafts; maintain the one Todo,
features, operator guidance and both memories. Check Git/publication receipts.

## Reviewed website API profile - 2026-10-21

Publication: website code `757a8de` and contract docs `1dc05d3` are pushed on
main; the static server serves `757a8de`. All 5,597 server checksums and 41 public
assets, four host/redirect and four private-path checks passed. The public
configuration is null and financial actions remain simulated. See
[publication receipt](https://github.com/ABEF/AAA/blob/main/reports/deployment-adapter/PUBLICATION.md).

The separate website now has a build-configured, default-disabled read and unsigned-
review profile for the existing APIs. Ordinary authorized accounts, eight-card
holdings pages, confirmed LP/ETH rewards, matching-block earnings and typed
mint/approval/Entry/claim reviews are implemented. Token-unit quotes target $100
activation (minimal raw-unit round-up) and at least $5 growth, with a 99% marginal
LP floor and separate gas. No signing or broadcast method exists in this profile.

Read [operator setup](DEPLOYMENT_API.md) and
[scoped evidence](https://github.com/ABEF/AAA/blob/main/reports/deployment-adapter/VERIFICATION.md): 57 focused cases,
eleven actual Python API response fixtures and eight headless browser scenarios.
Dependencies/wallets are mocked; this is not live provider/extension acceptance.
All thirteen earlier chain-reader bindings still match; unchanged signer/contract
suites and the deferred load campaign were not rerun. Build: 5,597 static files.

Automatic approval review rejected expanding the shared signer beyond local mode;
that proposal was not executed. Preserve its chain-31337 restriction and pending
journals. Public signing/qualified deployment config, routes, feeds, hosting,
full collection aggregation and independent release approval remain open. The
shipped DEPLOYMENT is null, so the public website stays simulated. Existing
Anvil/8900/session/NFT state and paused monitoring were not changed. Use main,
keep the single Todo/evidence/operator procedures aligned, preserve unrelated
drafts, and check Git/publication receipts rather than inferring publication.

## Publication checkpoint - 2026-10-20

The verified wallet implementation is published on main: contract/backend
df8a98a and website f060d66. The static Ubuntu site now serves website f060d66;
full server checksums and scoped public HTTPS/redirect/privacy checks passed.
See [publication evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/PUBLICATION.md).
The public site remains simulated; this is not a public contract/API deployment
or release approval. Local port 8900, Anvil and saved wallet/NFT state were not
reset. Thirteen source bindings still match the prior focused test evidence;
unchanged suites and the deferred load campaign were not rerun.

Actual MetaMask acceptance of the latest confirmation fix, production pins,
routes, feeds, services and independent audit remain open. Keep the single Todo
ledger and operator procedures authoritative. Preserve older unrelated local
drafts; they were not included in this publication. Monitoring remains paused.

## Independent chain confirmation - 2026-10-20

Shared wallet flows now read balances, simulation and confirmation through the
reviewed deployment RPC instead of extension-formatted transaction responses.
Wallet permissions/signing stay in the selected extension. Node and wallet chain/
genesis checks, exact approvals/calldata/fees and saved-hash recovery remain.
Legacy missing chainId resolves only through replay-protected EIP-155 v; typed
missing IDs fail closed. Approval never changes LP or artwork; Entry receipt plus
confirmed on-chain position remains required for activation/growth presentation.

[Evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/CHAIN_READER.md): 232 distinct website and 43 backend cases;
read-only recovery of the actual successful nonce-36 mint, exact-node CSP/CORS,
syntax/build and preservation of all 13 NFTs/LP/session after web-only restart.
Anvil 10988 was not reset. No signing/public transaction/server deployment or
paused-monitor change. Actual extension acceptance and production pins/routes/
RPC/fee qualification remain open; public signing is not enabled. Use main,
preserve unrelated drafts and check Git for publication. Keep Todo, feature
reference, operator guidance and both repo memories aligned.

## Canonical dynamic-fee receipt recovery - 2026-10-20

The user's mint 0xa7f91e…ac3891 succeeded at block 351. Anvil's derived fee fields
reported 1,000,000,014 wei/gas although signed cap and actual balance charge were
1,000,000,007. Shared signing and independent observation now derive EIP-1559
execution price from signed caps and canonical block base fee; original gas/unit/
paid-cost limits remain. Raw reported fee is retained separately. Deterministic
verification failures surface immediately with their specific reason.
[Evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/DYNAMIC_FEE_RECEIPTS.md): 142 signer/client and
40 observer tests, actual read-only mint receipt/balance replay, syntax/build pass.
Only local web worker restarted; session, 12 NFTs/LP and Anvil preserved. No new
holder/operator transaction or public deployment. Actual extension recovery retest
and production fee/profile qualification remain open.

## Mint loading presentation - 2026-10-20

Mint button loading now follows the actual activity instead of a generic busy
flag. Initial/refresh reads, connection, mint preparation, wallet confirmation,
receipt waiting and confirmed-state reconciliation have separate labels. Claims,
approvals and LP actions cannot label the button as a mint in progress. Existing
readiness/pending guards remain. See [evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/MINT_LOADING.md):
44 affected UI/lifecycle/contribution cases, syntax/build and served-source checks
pass. No signer, contract, backend, transaction, service or public deployment change.

## Numeric wallet nonce compatibility - 2026-10-20

The user supplied the exact failure: eth_getTransactionCount returned a number.
The shared website signer now accepts only exactly representable nonnegative JS
integers at its RPC response boundary, converting directly to BigInt. Hex responses
remain supported; prepared transactions/journals remain canonical hex. This has
no local-chain/address exception and keeps exact nonce, gas and receipt guards.
139 affected signer/client cases pass after reproducing the original failure.
See [evidence](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/NUMERIC_NONCE.md). Actual MetaMask retest is
pending; public signing/Robinhood manifest qualification remains open. No backend,
contract, chain reset, public transaction, deployment or monitor change.

## Wallet lifecycle review - 2026-10-20

The browser connection/signing flow now separates provider discovery, account
selection, deployment verification, submission, receipt and balance refresh.
EIP-6963 providers take precedence over the legacy slot. Cancelled account choices
cannot poison later connections; network addition is followed by a verified switch;
account events and late provider restoration revalidate without transaction prompts.
The review identifies the extension/full sender and distinguishes unsent failures,
rejections, pending recovery and confirmed receipts. Existing exact approval,
calldata/gas, journal and confirmed-artwork safeguards remain.

[Scoped lifecycle review](https://github.com/ABEF/AAA/blob/main/reports/browser-wallet/LIFECYCLE_REVIEW.md): 203 affected
website cases, syntax/build and served-source checks pass. The saved mint preflight
passes through direct local RPC without sending. Actual MetaMask acceptance and
its reported pre-prompt failure remain unresolved; Chrome inspection hit an app
approval timeout. No transaction, chain/service reset, backend/contract change,
public deployment or load campaign. Release remains NOT APPROVED.

## Review-dialog diagnostics follow-up - 2026-10-20

The transaction dialog now shows the escaped underlying failure instead of only
Review required. At observed local block 333 no new Wallet A mint was mined;
next nonce remained 0x23. Direct node balance/nonce/gas/estimate reads returned
canonical quantities. Actual browser-provider error is still needed; no confirmed
root cause or successful mint is claimed. Syntax and build pass; unchanged
signer/client tests were not rerun. No transaction/service/contract change.

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
