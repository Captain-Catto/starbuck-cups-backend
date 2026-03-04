# VPS + Nginx + Cloudflare Deployment

Target architecture:

- Frontend: `https://hasron.vn`
- Backend API: `https://api.hasron.vn`

## 1) DNS on Cloudflare

Create records:

- `A` record `@` -> frontend VPS IP (Proxy ON)
- `A` record `api` -> backend VPS IP (Proxy ON)

Set SSL/TLS mode to `Full (strict)`.

## 2) Backend environment

Quick start:

```bash
cp deploy/env/api.hasron.vn.env.example /opt/starbucks-shop/backend/.env
```

Then edit `/opt/starbucks-shop/backend/.env` with real secrets/DB values.

Minimum required values:

```env
NODE_ENV=production
PORT=8080
TRUST_PROXY=1
INCLUDE_LOCAL_ORIGINS=false
DB_SYNC_ON_START=false
SESSION_STORE_SYNC_ON_START=false

FRONTEND_URL=https://hasron.vn
ALLOWED_ORIGINS=https://hasron.vn,https://www.hasron.vn

COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=.hasron.vn
EXPOSE_REFRESH_TOKEN=false
AUTH_RATE_LIMIT_STORE=redis
REDIS_URL=redis://127.0.0.1:6379
ALLOW_IN_MEMORY_RATE_LIMIT=false
REQUEST_LOG_ENABLED=false
SOCKET_LOG_ENABLED=false
```

## 3) Nginx

Copy configs:

- `deploy/nginx/hasron.vn.conf` -> `/etc/nginx/sites-available/hasron.vn.conf`
- `deploy/nginx/api.hasron.vn.conf` -> `/etc/nginx/sites-available/api.hasron.vn.conf`

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/hasron.vn.conf /etc/nginx/sites-enabled/hasron.vn.conf
sudo ln -s /etc/nginx/sites-available/api.hasron.vn.conf /etc/nginx/sites-enabled/api.hasron.vn.conf
sudo nginx -t
sudo systemctl reload nginx
```

Update certificate paths in both files:

- `/etc/ssl/certs/cloudflare-origin.pem`
- `/etc/ssl/private/cloudflare-origin.key`

## 4) systemd for backend

Copy service file:

```bash
sudo cp deploy/systemd/starbucks-backend.service /etc/systemd/system/starbucks-backend.service
sudo systemctl daemon-reload
sudo systemctl enable starbucks-backend
sudo systemctl start starbucks-backend
sudo systemctl status starbucks-backend
```

## 5) Redis (required for auth rate limit)

Install and start Redis on backend host:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

## 6) Frontend deploy (React build)

Place build output at:

- `/var/www/starbucks-frontend/current/dist`

Then reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7) Verify

```bash
curl -I https://hasron.vn
curl -I https://api.hasron.vn/health
```
