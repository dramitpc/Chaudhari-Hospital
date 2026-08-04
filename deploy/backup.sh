#!/bin/sh
set -e

BACKUP_DIR=/volume1/docker/clinicos/backups
RETAIN_DAYS=30

mkdir -p $BACKUP_DIR

TS=$(date +%Y%m%d_%H%M)
FILE=$BACKUP_DIR/clinicos_$TS.sql.gz

echo "Dumping database..."
docker exec clinicos-postgres pg_dump -U clinicos clinicos --no-owner --no-acl --format=plain --file=/tmp/clinicos_backup.sql

echo "Copying dump..."
docker cp clinicos-postgres:/tmp/clinicos_backup.sql /tmp/clinicos_backup.sql
docker exec clinicos-postgres rm /tmp/clinicos_backup.sql

echo "Compressing to $FILE..."
gzip -c /tmp/clinicos_backup.sql > $FILE

echo "Done: $FILE"
du -sh $FILE

echo "Pruning backups older than $RETAIN_DAYS days..."
find $BACKUP_DIR -name "clinicos_*.sql.gz" -mtime +$RETAIN_DAYS -exec rm {} \;
echo "Pruning complete."
