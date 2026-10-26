#!/bin/sh
# Poplint only. Never invoke the demo's install-release.sh for this environment.
set -eu
release=${1:?Usage: install-integration-release.sh <40-character Git commit>}
case "$release" in *[!0-9a-f]*|'') echo 'Invalid integration release commit.' >&2; exit 1;; esac
[ "${#release}" = 40 ] || { echo 'Expected a full Git commit hash.' >&2; exit 1; }
[ "$(id -u)" = 0 ] || { echo 'Run with root or sudo.' >&2; exit 1; }
root=/var/www/popl-integration
archive="/tmp/popl-integration-$release.tar.gz"
release_dir="$root/releases/$release"
test -f "$archive"
test ! -L "$root"
test ! -L "$root/releases"
test ! -L "$release_dir"
install -d -m 755 "$root/releases"
[ "$(readlink -f "$root")" = "$root" ] || { echo 'Integration root is not its expected physical directory.' >&2; exit 1; }
[ "$(readlink -f "$root/releases")" = "$root/releases" ] || { echo 'Integration releases escaped their physical root.' >&2; exit 1; }
if [ ! -d "$release_dir" ]; then
  incoming="$release_dir.incoming"
  [ ! -e "$incoming" ] || { echo 'Inspect the incomplete integration release before retrying.' >&2; exit 1; }
  install -d -m 755 "$incoming"
  # Reject traversal, links, duplicate members and unexpected environment before extraction.
  python3 - "$archive" "$release" <<'PY'
import json,sys,tarfile
from pathlib import PurePosixPath
archive,release=sys.argv[1:]
with tarfile.open(archive,'r:gz') as bundle:
    names=set();total=0
    for member in bundle.getmembers():
        path=PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or '\\' in member.name or member.name in names or not member.isfile():
            raise SystemExit('Unsafe integration archive member.')
        if len(path.parts)>10 or member.size>25000000:
            raise SystemExit('Integration archive member exceeds the reviewed limit.')
        total+=member.size
        if len(names)>=6000 or total>500000000:
            raise SystemExit('Integration archive exceeds its reviewed capacity.')
        names.add(member.name)
    if not {'index.html','integration-app.js','integration-config.js','site-identity.json','SHA256SUMS'}.issubset(names):
        raise SystemExit('Incomplete integration archive.')
    if any(n in names for n in ('app.js','domain.js','preview-store.js','deployment-config.js')):
        raise SystemExit('Demo application found in integration release.')
    identity=json.load(bundle.extractfile('site-identity.json'))
    if identity.get('environment')!='poplint-integration' or identity.get('source_revision')!=release or identity.get('public_signing') is not False:
        raise SystemExit('Integration identity differs from the reviewed release.')
    if identity.get('hosts')!=['poplint.0xwave.com','www.poplint.0xwave.com'] or identity.get('canonical_origin')!='https://www.poplint.0xwave.com':
        raise SystemExit('Integration hostname mismatch.')
PY
  tar -xzf "$archive" -C "$incoming" --no-same-owner --no-same-permissions
  (cd "$incoming" && sha256sum -c SHA256SUMS)
  test -s "$incoming/index.html"
  test -s "$incoming/integration-app.js"
  find "$incoming" -type d -exec chmod 755 {} +
  find "$incoming" -type f -exec chmod 644 {} +
  mv "$incoming" "$release_dir"
else
  (cd "$release_dir" && sha256sum -c SHA256SUMS)
fi
nginx -t
previous=$(readlink "$root/current" || true)
case "$previous" in ''|/var/www/popl-integration/releases/*) ;; *) echo 'Integration current target is outside its own release root.' >&2; exit 1;; esac
ln -s "$release_dir" "$root/.current-$release"
mv -Tf "$root/.current-$release" "$root/current"
if ! systemctl reload nginx; then
  if [ -n "$previous" ]; then
    ln -s "$previous" "$root/.rollback-$release"
    mv -Tf "$root/.rollback-$release" "$root/current"
    systemctl reload nginx
  fi
  echo 'Integration reload failed; inspect the retained release.' >&2
  exit 1
fi
printf '%s\n' "$release" > "$root/deployed-commit"
printf 'Published integration website commit %s\n' "$release"
