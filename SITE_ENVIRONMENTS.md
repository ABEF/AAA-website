# Website environment boundaries

Reviewed 2026-11-09. The contract repository's [environment map](https://github.com/ABEF/AAA/blob/main/docs/SITE_ENVIRONMENTS.md)
owns the complete operating procedure and decisions.

| Target | URL | Build | Server current root |
| --- | --- | --- | --- |
| Existing simulation | https://www.popldemo.0xwave.com/ | `node build.mjs` (existing dist; preserve local overlays) | `/var/www/aaa-website/current` |
| Current-contract integration | https://www.poplint.0xwave.com/ | `node build-integration.mjs` (isolated dist-poplint; refuses existing output) | `/var/www/popl-integration/current` |

Keep popldemo live and unchanged. Poplint has independent releases, Nginx site,
TLS certificate, identity metadata and configuration. Use only the integration
installer for poplint; the old installer hardcodes the demo root.

`integration-config.js` keeps `INTEGRATION_DEPLOYMENT = null`;
`deployment-config.js` keeps the demo's separate `DEPLOYMENT = null`. A future
fresh integration needs reviewed schema4/source9 contracts/runtime/API policies.
Null or incompatible configuration must show unconfigured/error and must never
import the demo application or invent
balances. Public signing remains disabled; no public transaction or new contract
deployment follows from a static site publication. Never expose loopback Anvil,
operator credentials or a disposable wallet to the internet.

The served artifact uses schema3/accounting3/governance2/fee1/pricing2/routing2/
review1/localV4. The new local source9 consumer uses schema4/accounting7/LP1/
custody5/direct Entry3/review2/royalty4/reporting5/canonicalV9, with 29 browser
runtime pins and independent confirmed-block getters. HTTP schema2 remains a
separate version. Historical source8/accounting6/V8 and schema1/native2 manifests,
fixtures and journals retain their actual identities; a hostname or version
label never upgrades them.

Source9 reads holdings, both physical LPs, exact earnings/checkpoint2 and terminal
principal, and prepares unsigned contribution and claim reviews. Original-currency
royalties and ZZZ LP rewards awaiting ETH conversion stay separate. Governed
minima and cosmetic thresholds are authenticated current values. Optional
transaction-policy2 and complete-entry claim planning do not enable signing,
automatic queues or retries. Independent `activation_policy_schema` is optional:
omission retains1/12M; explicit2 binds a matching backend schema2, reviewed
operator/confirmed-block cap and full20% headroom. Claim policy1 remains12M even
with a higher activation ceiling. Source9 remains unsigned even on local Anvil;
the existing shared signer bytes and its historical profiles are unchanged.

The original35 handler DTOs across nine public methods and Entry3 unit drafts
retain their synthetic RPC/dependency scope in the
[source9 review](https://github.com/ABEF/AAA/blob/main/reports/source9-website-20261109/REVIEW.md).
Separate [actual Entry3 evidence](https://github.com/ABEF/AAA/blob/main/reports/source9-actual-entry-20261109/REVIEW.md)
records confirmed ETH/ZZZ activation and unsigned HTTP/RPC composition on an
owned fork with separately seeded external depth and controlled USD feeds/VRF.
It does not qualify public market depth, independent feeds, extension signing or
production operation. Neither poplint's served current3 release nor popldemo
changed. Actual wallet/API/feed/route, marketplace, configuration, operating
acceptance and a separately authorized rollout remain open.

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

Certificate renewal uses the enabled certbot.timer and the source-controlled
deploy/popl-integration-renew-hook.sh installed executable at
/etc/letsencrypt/renewal-hooks/deploy/popl-integration-nginx. It tests/reloads
Nginx only when RENEWED_LINEAGE is exactly the popl-integration certificate;
demo renewal configuration is unchanged. Keep this hook when maintaining TLS.
