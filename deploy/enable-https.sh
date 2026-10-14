#!/bin/sh
set -eu
config=/etc/nginx/sites-available/aaa-website-popldemo
enabled=/etc/nginx/sites-enabled/aaa-website-popldemo
if [ -e "$config" ] || [ -L "$enabled" ]; then
  echo 'The popldemo configuration already exists; inspect before replacing.' >&2
  exit 1
fi

cat > "$config" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name popldemo.0xwave.com www.popldemo.0xwave.com;

    root /var/www/aaa-website/current;
    index index.html;
    server_tokens off;
    autoindex off;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    gzip on;
    gzip_types text/css application/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-cache";
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }
    location ~ /\. {
        deny all;
    }
    location = /SHA256SUMS {
        deny all;
    }
}
NGINX
ln -s "$config" "$enabled"
if ! nginx -t; then
  unlink "$enabled"
  echo 'Nginx validation failed; new hostname configuration was disabled.' >&2
  exit 1
fi
systemctl reload nginx

export DEBIAN_FRONTEND=noninteractive
apt-get install -y --no-install-recommends certbot python3-certbot-nginx
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow 443/tcp
fi

certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect --cert-name popldemo.0xwave.com \
  -d popldemo.0xwave.com -d www.popldemo.0xwave.com
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
systemctl is-enabled certbot.timer
systemctl list-timers certbot.timer --no-pager
certbot renew --cert-name popldemo.0xwave.com --dry-run --no-random-sleep-on-renew
openssl x509 -in /etc/letsencrypt/live/popldemo.0xwave.com/cert.pem \
  -noout -subject -issuer -dates -ext subjectAltName
printf 'HTTPS enabled for popldemo.0xwave.com and www.popldemo.0xwave.com.\n'
