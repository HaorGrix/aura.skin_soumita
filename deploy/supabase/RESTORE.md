# skintheorybd.shop backend: restore from backup

Nightly backups (03:30 UTC, 14 days kept) are in /var/backups/skintheorybd:
  db-<stamp>.dump       full Postgres dump (pg_dump -Fc, all schemas incl. auth + storage)
  storage-<stamp>.tgz   uploaded files (/opt/supabase/volumes/storage)
Created by /usr/local/sbin/skintheorybd-backup.sh (cron: /etc/cron.d/skintheorybd-backup).

## Restore the database
  cd /opt/supabase
  docker compose stop auth rest storage functions
  docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists --no-owner \
    < /var/backups/skintheorybd/db-<stamp>.dump
  docker compose up -d auth rest storage functions

## Restore uploaded files
  docker compose stop storage
  tar -C /opt/supabase/volumes -xzf /var/backups/skintheorybd/storage-<stamp>.tgz
  docker compose up -d storage

## Check
  curl -s -H "apikey: $(sed -n "s/^ANON_KEY=//p" .env)" \
    "https://www.skintheorybd.shop/rest/v1/products_public?select=slug&limit=1"
