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
