#!/bin/sh
# This hook owns only the poplint certificate; other renewals are unchanged.
set -eu
[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/popl-integration ] || exit 0
/usr/sbin/nginx -t
systemctl reload nginx
