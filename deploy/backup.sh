#!/bin/sh

BACKUP_DIR="/volume1/docker/clinicos/backups"
DATE=$(date +%Y%m%d_%H%M)
FILE="$BACKUP_DIR/clinicos_$DATE.sql.gz"
RETAIN_DAYS=30

mkdir -p "$BACKUP_DIR"

# Dump to a temp file inside the container, copy it out, then compress
sudo docker exec clinicos-postgres \
  pg_dump -U clinicos clinicos \
  --no-owner --no-acl --format=plain \
  --file=/tmp/clinicos_backup.sql

sudo docker cp clinicos-postgres:/tmp/clinicos_backup.sql /tmp/clinicos_backup.sql
gzip -c /tmp/clinicos_backup.sql > "$FILE"
rm -f /tmp/clinicos_backup.sql

echo "$(date): Backup written to $FILE ($(du -sh "$FILE" | cut -f1))"

# Delete backups older than RETAIN_DAYS (BusyBox-compatible)
find "$BACKUP_DIR" -name "clinicos_*.sql.gz" -mtime +"$RETAIN_DAYS" -exec rm {} \;
echo "$(date): Pruned backups older than $RETAIN_DAYS days"
