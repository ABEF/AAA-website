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

# Main website interaction state

The default website remains an explicitly labeled simulation. Its `app.js`,
`wallet.js`, `ui-state.js` and `preview-store.js` now include the interaction
improvements learned from local integration. They are not test-harness changes.
No deployed PoPL contracts, production signer or public backend is configured.

## Independent actions and refresh

Each NFT has its own pending action. Mint has a separate resource. Claim-all
reserves its complete NFT set; a conflict rejects the batch without partially
starting it. Other NFTs stay usable. Only activation/top-up changes the target
NFT's artwork updating badge. Results use the latest saved example state,
not a collection captured before awaiting a response.

Web Locks serialize the short read/validate/write of the existing v7 demo log
across same-origin tabs. Nonblocking resource locks reject overlapping actions
on the same NFT in another tab. An unrelated NFT can proceed independently.
A 10-second lock-wait bound fails without a write. Storage events and returning
to a tab refresh its saved state; they never resubmit an action. Reset changes
an epoch, invalidating old work even if the log was empty. The 1,000-event bound,
corrupt storage, failed persistence and missing Web Locks produce explicit errors,
not silently lost events or false success. Legacy LP-only claim events still replay.
The latest unchanged storage string/reset epoch reuses one immutable snapshot,
avoiding repeated event replay. Every read still checks persistence; errors are
not concealed by the cache. New events/reset invalidate it. Unsent previews expire
after 15 seconds using wall and monotonic clocks; pagehide cancels them, while
ordinary switching between tabs does not. Back/forward restoration cannot resume
an old intent. This is demo persistence, never a production transaction ledger.

Wallet choice persists in tab session storage. Browser restoration asks only
`eth_accounts` and `eth_chainId`, and requires one matching provider identity.
It never prompts for accounts, signs or sends on reload. Disconnect clears the
selection; account/network changes invalidate pending unsent previews, even if
the wallet changes back. Late connection results cannot reconnect after disconnect.
Tab storage unavailable means connection can work without reload persistence.

Forms report validation/progress/errors inline and retain entered values on
unrelated updates. Completed previews update the affected detail view. Dormant
cards/details hide fee and claim sections but show the fixed rarity multiplier,
gray on the card. Active cards have separate Claim and Grow attached LP buttons.
Previously claimed includes lifetime LP plus royalties. Loaded artwork stays
stable; changed saved artwork crossfades, respecting reduced-motion preference.

## Position presentation

The royalty multiplier is a fixed trait directly below the pattern, using the
same typography and gray styling before activation. Cards show LP attached and active cards show one Rewards
to claim total; the detail view groups claimable components, attached liquidity,
fee history and lifetime LP-plus-royalty claims. Gross simulated trading-fee
history remains labeled before allocation. The local adapter preserves exact
raw currency totals and unavailable history/prices; it does not assume tokens
are ETH. Dormant cards omit financial summaries and reward controls.
No transaction, operator permission, service command or economic rule changed.

## Operator procedure

No contract call, permission or economics change is required. Build with
`npm run build`; use the normal static release process when public deployment
is authorized. Reload to load the new JS. HTTPS (or localhost) and Web Locks are
required for mutations. If the browser cannot coordinate tabs, use a current
supported browser; do not bypass the lock checks. On storage failure, preserve
any example history needed before Reset demo. Reset affects only the same-origin
simulation, not a wallet or blockchain. A rollback may reintroduce the old
lost-update bug; use this verified version or a reviewed fix. Never migrate the
demo event log into a live transaction database.

The local Anvil `/app/` adapter retains its independent receipt/recovery guards
and serial server. Its running server is not restarted by this website change.
Default-only state modules load conditionally, preserving its existing static
allowlist. The original artwork, token rules and simulation balances are unchanged.

## Production boundary

UI resource locks are not authorization, blockchain nonce locks, distributed
user isolation, or a load guarantee. Live integration still needs per-wallet
signing, independently pinned chain/contract/account context, fresh quote and
simulation after approval, transaction-hash persistence, receipt/replacement/reorg
reconciliation after refresh, and no automatic financial resubmission. Distinct
users must not share one browser/demo log or a global server mutation lock.
Qualify shared-pool quote changes and multiple devices against the real service.
Track those remaining requirements in the contract repository's central Todo.

## Resilience verification - 2026-10-19

The affected UI-state, local-client/view and domain/wallet scope passes 90 tests,
including immutable-cache invalidation, storage errors, parallel intents, duplicate
confirmation and expiry/context rejection. Build remains 5,588 files. Main-site
reload retains the current wallet/positions; Grow attached LP details render
without console errors. Existing user example holdings were preserved.

The local adapter also validates a finite 1-60 second preparation lifetime,
counts preparation time, checks wall and monotonic deadlines, and rechecks chain,
account, revision and confirmed state before execution. Extra input cannot replace
the selected operation/wallet. It preserves the existing unresolved-operation
recovery rather than creating retries. Reload the page for this JS update; the
running local service and its serial signing lock remain unchanged. Public wallet
integration and multi-device production qualification are still open.

The activation form offers only ZZZ / ETH (WETH accounting identity). Pool labels
are omitted from NFT detail views. Existing legacy demo records are preserved.
The contract candidate permits one contribution pool at a time, with future
governed switches; this UI is not an on-chain deployment.

NFT breakdowns show one LP rewards line (individual plus collective) and a
separate Royalties line; the card total remains LP plus royalties.

In My NFTs, each card image opens the same position and rewards breakdown as
its detail link. The image's accessible label names this action. Artwork-only
enlargement remains available from the image inside the preview breakdown.

Known-operation refresh is scoped by session, wallet and NFT. Claims refresh rewards only; contribution markers affect only the target NFT. Failed/unknown reads remain unavailable. All transaction authorization still requires a fresh snapshot; displayed last-confirmed balances do not authorize spending. Artwork preload is bounded to 128 fixed library URLs.
# Demo funding and confirmed tier feedback (2026-10-20)

The one-time `claim-testing-20261020` event is a simulated receipt, not a balance
reset. It is appended after existing actions under the global preview event lock;
duplicate writes/replays cannot credit it twice. LP owner credits follow attached
capital, collective credits equal active membership, royalties active rarity
weights. Claims preserve lifetime totals. New activation after the event cannot
claim past income. This feature is never loaded as local-chain funding.

Activation/top-up celebration uses the before/after confirmed evolution and LP,
only after success. The local path also retains session/account identity and
waits for the post-receipt read. Missing state, rejected transactions, approval,
wrapping and claims cannot trigger it. The one-shot sound ends at 1.18 seconds;
visual motion ends at 1.35 seconds and respects reduced-motion preferences.
Image-load failure suppresses celebration, audio failure is nonfatal. These are
presentation changes with no new contract or backend operator procedure.
