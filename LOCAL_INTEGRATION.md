# Local contract mode

The existing website can use real, disposable local contract state while retaining
its design. Start the contract repository's `scripts/local-stack.py` with this
checkout as `--website`, following the [local stack guide](https://github.com/ABEF/AAA/blob/main/docs/LOCAL_TEST_STACK.md).
Open `http://127.0.0.1:8890/app/#my-nfts` (substitute the launcher's port).
Normal `npm run dev` and public static hosting still run the labeled simulation.

Choose the Holder or Buyer wallet. These are local unlocked accounts on the
launcher's own Anvil child; no browser extension, private key or public funds
are used. My NFTs and Collection show confirmed ownership/current LP and real
processed earnings. Artwork maps actual revealed traits to the existing library.
Mint ordinals are readable labels; full uint256 strings identify transactions.
ETH royalties retain raw currency units when a USD price is unavailable. LP
earnings show individual plus equal-collective components at today's prices.
Previously claimed includes all actual LP and royalty payouts in the history.

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
clear projections; demo balances are never used as fallback. Inline artwork
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
