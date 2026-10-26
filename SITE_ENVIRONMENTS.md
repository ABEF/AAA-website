# Website environment boundaries

Reviewed 2026-10-27. The contract repository's [environment map](https://github.com/ABEF/AAA/blob/main/docs/SITE_ENVIRONMENTS.md)
owns the complete operating procedure and decisions.

| Target | URL | Build | Server current root |
| --- | --- | --- | --- |
| Existing simulation | https://www.popldemo.0xwave.com/ | `node build.mjs` (existing dist; preserve local overlays) | `/var/www/aaa-website/current` |
| Current-contract integration | https://www.poplint.0xwave.com/ | `node build-integration.mjs` (isolated dist-poplint; refuses existing output) | `/var/www/popl-integration/current` |

Keep popldemo live and unchanged. Poplint has independent releases, Nginx site,
TLS certificate, identity metadata and configuration. Use only the integration
installer for poplint; the old installer hardcodes the demo root.

`integration-config.js` exports a null reviewed deployment until exact schema3
contracts/runtime/API policies are available. Null or incompatible configuration
must show unconfigured/error and must never import the demo application or invent
balances. Public signing remains disabled; no public transaction or new contract
deployment follows from a static site publication. Never expose loopback Anvil,
operator credentials or a disposable wallet to the internet.

The manifest is schema3/accounting3/governance2/fee1/pricing2/routing2/review1/localV4.
HTTP schema2 is a separate version. Current inputs are ETH/fixedZZZ only; older
schema1/native2 manifests, fixtures and journals retain their actual identities.
Code may read confirmed public holdings and prepare unsigned reviews; real wallet,
API/feed/route, marketplace and operating qualification remains open.

Use a new integration build output for each release, record source revision,
verify `site-identity.json` and SHA256SUMS, and archive only public static files.
Never package tests, scripts, configuration secrets or the private SSH key.
Before and after rollout, compare demo symlink, index/app/checksum and enabled
configuration hashes. Roll back only the integration symlink/configuration.

Source-specific evidence belongs in the contract repository; the sole Todo stays
there. The user declined extra NFT sale-rights UI; economic rights are unchanged.

Current served integration revision: f23c5599185997da1f36c4f64fea021b3f99b27a,
verified HTTPS with configuration_status unconfigured/public_signing false.
The demo still serves9be6d1. Subsequent documentation commits do not change
either deployed revision; inspect site-identity.json and the server release
record before an update. After reload, use bounded read-only verification
retries if necessary; do not blindly reinstall or alter the demo.
