# Choose the release target explicitly

| Site | Installer | Root | Archive prefix |
| --- | --- | --- | --- |
| Existing popldemo simulation | install-release.sh | /var/www/aaa-website | aaa-website- |
| Current-contract poplint | install-integration-release.sh | /var/www/popl-integration | popl-integration- |

Never use the demo installer or enable-https.sh to publish poplint. The separate
popl-integration.nginx.conf owns only poplint/www, its own certificate, logs,
security policy and root. Both sites use main; separate build artifacts and
server roots provide isolation.

For a poplint release, obtain the exact reviewed40-character Git commit, choose
a fresh dist-poplint output, and pass both --output and --revision to
build-integration.mjs. Without --revision the output is a local preview, not
deployable. The script refuses an existing output and never deletes demo dist.

Verify SHA256SUMS and site-identity.json. Package only the generated public
files, using canonical relative file-only tar entries (no ./ prefixes,
directory entries, symlinks or absolute paths). Include SHA256SUMS itself.
Archive name: /tmp/popl-integration-FULL_COMMIT.tar.gz. The installer checks
member count/size, environment, hosts, revision, public-signing false and all
checksums before atomically switching its own current symlink.

Record demo symlink/content/configuration hashes before and after. Test Nginx,
verify both integration aliases/TLS/identity and expected unavailable API state.
For delayed post-reload observations, retry only bounded reads, not installation.
Rollback switches only integration current to a prior verified release; never
erase journals, certificates or unrelated virtual hosts.

Keep deployment keys/credentials outside repositories and public archives.
No contract deployment, public signing or real-fund action is implied. See
[full environment procedures](../SITE_ENVIRONMENTS.md) and linked contract manual.

Certificate renewal uses the enabled certbot.timer and the source-controlled
deploy/popl-integration-renew-hook.sh installed executable at
/etc/letsencrypt/renewal-hooks/deploy/popl-integration-nginx. It tests/reloads
Nginx only when RENEWED_LINEAGE is exactly the popl-integration certificate;
demo renewal configuration is unchanged. Keep this hook when maintaining TLS.
