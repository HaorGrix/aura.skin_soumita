#!/bin/sh
# Nightly backup of the self-hosted Supabase for skintheorybd.shop:
# full database dump (custom format, all schemas incl. auth + storage metadata)
# and the uploaded files. Keeps 14 days. Restore steps: /opt/supabase/RESTORE.md
set -eu
DEST=/var/backups/skintheorybd
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$DEST" && chmod 700 "$DEST"
docker exec supabase-db pg_dump -U supabase_admin -d postgres -Fc > "$DEST/db-$STAMP.dump"
tar -C /opt/supabase/volumes -czf "$DEST/storage-$STAMP.tgz" storage
test -s "$DEST/db-$STAMP.dump"
find "$DEST" -type f -mtime +14 -delete
echo "$STAMP ok $(du -sh "$DEST/db-$STAMP.dump" | cut -f1) db, $(du -sh "$DEST/storage-$STAMP.tgz" | cut -f1) files" >> "$DEST/backup.log"
