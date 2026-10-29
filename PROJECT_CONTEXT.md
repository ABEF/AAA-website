# Website current project context

Reviewed 2026-10-29 (Europe/Paris). Read [AGENTS.md](AGENTS.md),
[environment procedures](SITE_ENVIRONMENTS.md) and the contract repository's
[sole Todo](https://github.com/ABEF/AAA/blob/main/TODO.md) before making changes.
This is durable repository context, not global personal memory.

## Two separate public sites

| Target | Purpose | Server release root |
| --- | --- | --- |
| https://www.popldemo.0xwave.com/ and existing apex | Existing simulated product demonstration | `/var/www/aaa-website/current` |
| https://www.poplint.0xwave.com/ and redirected apex | Current-contract read/unsigned-review integration | `/var/www/popl-integration/current` |

Website implementation f23c5599185997da1f36c4f64fea021b3f99b27a is published on main
and deployed only to poplint. Its independent certificate, Nginx site, build,
identity and checksums are verified. Demo release9be6d1, public content and its
existing enabled-site configuration hashes remain unchanged. The recorded desktop checks returned HTTPS 200 for both www sites and the
integration identity; these are historical serving observations, not a new uptime check; source/publication and
serving evidence live in the contract repo's
[current3 website report](https://github.com/ABEF/AAA/blob/main/reports/current3-website-20261026/DEPLOYMENT.md).

Poplint is deliberately **unconfigured**: integration-config.js is null, no
reviewed contracts/API are invented, balances stay unavailable and no demo
fallback runs. Public signing stays disabled; no public contract was deployed.
Build it only with build-integration.mjs into a new dist-poplint directory and
use install-integration-release.sh, never the demo installer/root/dist. A
deployable artifact requires an exact40-character source revision. See the
environment map for verification, bounded read-only retry and rollback.

Static artwork reference metadata now keeps fixed rarity weight1/2/3 separate
from activation eligibility. Generator/preview and2784reference descriptions were
published at cae44a1d; 696 dormant traits changed from 0 to 1/2/3. The 72 historical references,
all2784SVG image hashes, manifest, effective demo accounting, signer and null
public configurations are unchanged. Three focused metadata methods and syntax
checks pass. No asset regeneration/build/deployment/service/Anvil action.
See the contract [whole-project execution](https://github.com/ABEF/AAA/blob/main/reports/whole-project-execution-20261029/REVIEW.md).
This does not implement fresh4 integration or qualify marketplace/hosting.

## Current implementation and evidence

Contract source checkpoint: [4579eeb](https://github.com/ABEF/AAA/commit/4579eeb289d4647bd18b785881db9522639eb312).
Fresh accounting4/custody3/canonical V5 remains distinct from the served
accounting3 integration build and preserved local Anvil profiles. Keeper source
now has service-only in-range compound waits, existing-window reset coordination,
proved internal-harvest clocks and read-only LP diagnostics. Registration uses
complete actual bucket inventory; no public registration getter exists. These
source changes do not implement a website feature, update a deployment manifest,
enable public signing or authorize a site/service rollout. Follow the contract
[operator guide](https://github.com/ABEF/AAA/blob/main/docs/KEEPER_COORDINATION.md)
and sole Todo; actual fresh4 integration and live qualification remain open.

Explicit website schema3 checks accounting3/governance2/fee1/pricing2/routing2/
review1/localV4, twelve runtime/parent/module pins and fixed ZZZ admission. HTTP
schema2 remains distinct. Existing schema1/native2 deployments, journals and
the shared Anvil-only signer retain their meaning; no automatic profile upgrade.

One final affected selection has451JS passes including46new methods. Six fixtures
come from actual Python API/projection/preparation code with synthetic dependency,
RPC, price and venue state. Separate integration-shell checks have7passes and
three headless browser cases. These are separate scopes, not a new full regression
or actual extension/provider qualification. Preserve earlier failed fixture and
harness attempts and original source identities. The contract report retains
exact source pins, test outputs, serving checks and current limits.

Current product:1,000 ERC721 NFTs,600Commun/300Rare/100Legendary. Native ETH and
fixed ZZZ only for contribution; $100activation/$5growth, stronger pool minima.
Default loss budgets2/1/3%, governed maximum10%, gas separate and tighter caller/
venue bounds retained. Dual sources agree within3%; actual providers/routes remain
unqualified. Rarity weights1/2/3 affect actual received royalties only. Fixed
LP allocation80/10/5/5; NFT income is individual+equal collective+royalties,
excluding reserves and duplicate claims/conversions/imports. Current owner holds
unclaimed rights. Missing price/history stays unavailable, not guessed zero.

Artwork and balances update only after confirmed deployed LP; claim refresh does
not evolve artwork. Preserve approved texture, four mapped evolutions, per-NFT
pending state, rarity/color/card rules and ACTI/EV timing from AGENTS.md.

## Continuation and authorization

Historical initial current3 integration/fork checkpoint:
[8be0f89](https://github.com/ABEF/AAA/commit/8be0f89fd982253ddae7bef2ebfc36b497d836b1).
Website operating checkpoint77501ce is separate from served poplint artifact
f23c559 and demo9be6d1. Follow the contract WORK_HANDOFF.md next session; do not
rerun unchanged checks or change the demo merely to continue current integration.
Actual reviewed contracts/API/feeds/routes must be supplied before replacing
the unconfigured state; public signing remains disabled. No overnight monitor,
service restart or public transaction was requested.

The user declined extra sale-rights UI; the stable Todo task is Not planned,
not implemented. Underlying economic rights are unchanged. Intended production
minting is OpenSea (0.05ETH buyer gross, recipient net after platform fee), but
the actual mint integration remains unfinished. The website mint is a demo.

Actual current3 contracts/API/feeds/routes/VRF/authorities/OpenSea, permanent
artwork hosting, complete history, target gas/operating qualification and
independent audit/remediation remain open. Production NOT APPROVED.

Preserve local Anvil/NFTs/LP/balances/journals/port8902/dist overlay. No reset,
keeper restart, public signing or public financial transaction occurred. The
staging monitor remains paused. A deployment SSH key was explicitly authorized;
its private half and server credentials stay outside Git/public artifacts. Do
not probe credentials or add privileged access without authorization.

Main only. Website docs receipts after f23c559 do not deploy a new artifact;
public site-identity.json remains the authority for the served source revision.
Contract-side WORK_HANDOFF.md records external backup/evidence locations.
