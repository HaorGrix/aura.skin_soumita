# Self-hosting: skintheorybd.shop

Since 2026-09-29 the whole shop runs on one Hetzner server, **hg-server-01**
(`2.29.49.52`, Ubuntu 24.04). There is no Vercel or Supabase cloud dependency.

```
browser ──https──> nginx (host, :443)
                    ├─ /                      static SPA  /var/www/skintheorybd/current
                    └─ /rest|auth|storage|functions/v1/  ──> 127.0.0.1:8000 (Supabase gateway)
                                                              └─ Docker: db, auth, rest, storage,
                                                                 imgproxy, functions, meta, studio
```

Only nginx listens publicly (22/80/443, Hetzner firewall `hg-server-01-fw`).
The API shares the site's origin, so the CSP needs only `'self'`.

## Files in this folder

| File | Lives on the server at |
|---|---|
| `nginx/skintheorybd.conf` | `/etc/nginx/sites-available/skintheorybd.conf` (plus Certbot's TLS lines) |
| `nginx/skintheorybd-headers.conf` | `/etc/nginx/snippets/skintheorybd-headers.conf` |
| `nginx/skintheorybd-api.conf` | `/etc/nginx/snippets/skintheorybd-api.conf` |
| `supabase/docker-compose.override.yml` | `/opt/supabase/docker-compose.override.yml` |
| `supabase/skintheorybd-backup.sh` | `/usr/local/sbin/skintheorybd-backup.sh` (cron `/etc/cron.d/skintheorybd-backup`, 03:30 UTC) |
| `supabase/RESTORE.md` | `/opt/supabase/RESTORE.md` |

## Backend

- Official Supabase self-hosting compose in `/opt/supabase` (Postgres 17).
  Secrets are in `/opt/supabase/.env` (root-only, never in git).
- `.env` sets `COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml`;
  without that the override (localhost-only gateway) is silently ignored.
- Services run: `db auth rest storage imgproxy meta functions studio api-gw`.
  Realtime and supavisor are not used and not started:
  `docker compose up -d db auth rest storage imgproxy meta functions studio api-gw`
- Sign-ups are disabled (`DISABLE_SIGNUP=true`). Staff are added by invite
  (edge function `invite-staff` in `volumes/functions/`).
- Email: Resend SMTP, sender `noreply@skintheorybd.shop`, **port 587**.
  Hetzner blocks outbound 25 and 465.
- Studio (database dashboard) is not public. Open an SSH tunnel and browse
  `http://localhost:8000`, login from `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`
  in `/opt/supabase/.env`:
  `ssh -L 8000:127.0.0.1:8000 root@2.29.49.52`

## Deploying the website

1. `.env.local` must contain `VITE_SUPABASE_URL=https://www.skintheorybd.shop`
   and the self-hosted `ANON_KEY` from `/opt/supabase/.env` as
   `VITE_SUPABASE_ANON_KEY`.
2. `npm run build`, upload `dist/` to a new
   `/var/www/skintheorybd/releases/<utc-stamp>-<sha>/`, then switch
   `/var/www/skintheorybd/current` to it atomically
   (`ln -sfn … current.new && mv -T current.new current`).
3. Roll back by pointing `current` at the previous release.

## Scripts that talk to the backend

`scripts/*.mjs` read `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local`; use the self-hosted `SERVICE_ROLE_KEY` from `/opt/supabase/.env`.
