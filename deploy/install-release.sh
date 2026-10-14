#!/bin/sh
set -eu
release=${1:?Usage: install-release.sh <40-character Git commit>}
case "$release" in
  *[!0-9a-f]*|'') echo 'Invalid release commit.' >&2; exit 1 ;;
esac
[ "${#release}" = 40 ] || { echo 'Expected a full Git commit hash.' >&2; exit 1; }
[ "$(id -u)" = 0 ] || { echo 'Run with root or sudo.' >&2; exit 1; }

root=/var/www/aaa-website
archive="/tmp/aaa-website-$release.tar.gz"
release_dir="$root/releases/$release"
test -f "$archive"
if [ ! -d "$release_dir" ]; then
  incoming="$release_dir.incoming"
  [ ! -e "$incoming" ] || { echo 'An incomplete release needs inspection.' >&2; exit 1; }
  install -d -m 755 "$incoming"
  tar -xzf "$archive" -C "$incoming"
  (cd "$incoming" && sha256sum -c SHA256SUMS)
  test -s "$incoming/index.html"
  test -s "$incoming/app.js"
  find "$incoming" -type d -exec chmod 755 {} +
  find "$incoming" -type f -exec chmod 644 {} +
  mv "$incoming" "$release_dir"
else
  (cd "$release_dir" && sha256sum -c SHA256SUMS)
fi

nginx -t
previous=$(readlink "$root/current" || true)
ln -s "$release_dir" "$root/.current-$release"
mv -Tf "$root/.current-$release" "$root/current"
if ! systemctl reload nginx; then
  if [ -n "$previous" ]; then
    ln -s "$previous" "$root/.rollback-$release"
    mv -Tf "$root/.rollback-$release" "$root/current"
    systemctl reload nginx
  fi
  echo 'Reload failed; the previous release was restored.' >&2
  exit 1
fi
printf '%s\n' "$release" > "$root/deployed-commit"
systemctl is-active nginx
printf 'Published website commit %s\n' "$release"
