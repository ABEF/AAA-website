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
earnings show individual plus equal-collective components at today's prices.
Previously claimed includes all actual LP and royalty payouts in the history.

Royalty multipliers on local NFT cards come from the revealed rarity: Commun ×1, Rare ×2, Legendary ×3. Dormant cards retain that multiplier in gray; activation enables participation without changing rarity. Unrevealed NFTs show Unrevealed, never an assumed multiplier. This display is separate from the ledger’s zero effective weight before activation.

Mint, transfer, exact approval, Entry activation/top-up and combined claims use
explicit confirmations. Approval and LP contribution are separate steps. The
fixture accepts 100–99,999 whole TEST-1, marked at $1 by a mock feed. At least
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
