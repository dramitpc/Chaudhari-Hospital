# ClinicOS — Database Migration: Replit → Synology NAS

This guide covers three things:

1. **Export** — dump the live database from Replit
2. **Import** — restore it into your NAS PostgreSQL container
3. **Auto-backup** — schedule daily backups on the NAS with 30-day retention

After migration the NAS is the **primary database**. Replit becomes read-only/archived.

---

## Part 1 — Export the Replit Database

Do this while the NAS containers are already running (postgres healthy).

### 1a. Open the Replit Shell

In your Replit project, open the **Shell** tab (not the Console — the full terminal).

### 1b. Dump the database to a file

```bash
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file=/tmp/clinicos_export.sql
```

- `--no-owner` — strips `ALTER OWNER` statements that would fail on a different user
- `--no-acl` — strips `GRANT`/`REVOKE` statements
- `--format=plain` — plain SQL, readable and portable

Verify it worked:

```bash
wc -l /tmp/clinicos_export.sql
# Should print several thousand lines (not 0)
```

### 1c. Download the file to your computer

In the Replit file browser, the `/tmp` directory is not visible. Use this command to copy it into the project directory first:

```bash
cp /tmp/clinicos_export.sql ./clinicos_export.sql
```

Now it appears in the file tree — right-click it and choose **Download**.

Move it to your desktop or a known folder on your computer.

---

## Part 2 — Import into the NAS

### 2a. Copy the dump file to the NAS

From your computer (Terminal / Command Prompt):

```bash
scp ~/Desktop/clinicos_export.sql admin@<NAS-IP>:/volume1/docker/clinicos/
```

Replace `<NAS-IP>` with your NAS's local IP (e.g. `192.168.1.100`).

### 2b. SSH into the NAS

```bash
ssh admin@<NAS-IP>
cd /volume1/docker/clinicos
```

### 2c. Make sure the database container is running

```bash
docker compose -f deploy/docker-compose.yml up -d clinicos-postgres
docker compose -f deploy/docker-compose.yml ps
# clinicos-postgres should show "(healthy)"
```

If you ran the `clinicos-init` step already (seed + migrations), the tables already exist.
If not, run that first:

```bash
docker compose -f deploy/docker-compose.yml \
  --profile init run --rm clinicos-init
```

### 2d. Reset the database (drop all seeded data)

The seed script inserts default users and demo data. The safest way to clear
everything is to drop the public schema and recreate it — this is a single
command with no quoting pitfalls:

```bash
docker exec clinicos-postgres psql -U clinicos clinicos \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

> **Caution:** This wipes all rows and table definitions. Only run it before the import.

### 2e. Restore the dump

The `pg_dump` output contains `CREATE TABLE` statements, so restoring it
rebuilds and populates every table in one step:

```bash
cat clinicos_export.sql | \
  docker exec -i clinicos-postgres psql -U clinicos clinicos
```

This prints many lines of SQL output. Ignore `NOTICE` messages — they are normal.
Watch for `ERROR` lines. A small number of errors on `CREATE EXTENSION` or `SET` are harmless.

### 2f. Verify the import

```bash
docker exec clinicos-postgres psql -U clinicos clinicos -c "
SELECT
  (SELECT COUNT(*) FROM patients)      AS patients,
  (SELECT COUNT(*) FROM users)         AS users,
  (SELECT COUNT(*) FROM appointments)  AS appointments,
  (SELECT COUNT(*) FROM consultations) AS consultations,
  (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
  (SELECT COUNT(*) FROM billing_invoices) AS invoices;
"
```

Compare the numbers against what you see in the Replit app.

### 2g. Start all services

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Open `http://<NAS-IP>:<HOST_PORT>` and log in with your existing credentials.

---

## Part 3 — Automated Daily Backups

Once the NAS is live, set up a cron job that dumps the database every night and
keeps 30 days of backups.

### 3a. Create the backup script

```bash
mkdir -p /volume1/docker/clinicos/backups
nano /volume1/docker/clinicos/deploy/backup.sh
```

Paste this content (replace `<your-db-password>` with the value in `deploy/.env`):

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/volume1/docker/clinicos/backups"
DATE=$(date +%Y%m%d_%H%M)
FILE="$BACKUP_DIR/clinicos_$DATE.sql.gz"
RETAIN_DAYS=30

# Load password from .env
source /volume1/docker/clinicos/deploy/.env

# Dump and compress
docker exec clinicos-postgres \
  pg_dump -U clinicos clinicos \
  --no-owner --no-acl --format=plain \
  | gzip > "$FILE"

echo "$(date): Backup written to $FILE ($(du -sh "$FILE" | cut -f1))"

# Delete backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "clinicos_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "$(date): Pruned backups older than $RETAIN_DAYS days"
```

Make it executable:

```bash
chmod +x /volume1/docker/clinicos/deploy/backup.sh
```

Test it manually:

```bash
/volume1/docker/clinicos/deploy/backup.sh
ls -lh /volume1/docker/clinicos/backups/
# Should show a .sql.gz file
```

### 3b. Schedule the cron job

Synology's cron runs as root. Open the cron table:

```bash
sudo crontab -e
```

Add this line at the bottom (runs at 2:00 AM every night):

```
0 2 * * * /volume1/docker/clinicos/deploy/backup.sh >> /volume1/docker/clinicos/backups/backup.log 2>&1
```

Save and exit. Verify it was saved:

```bash
sudo crontab -l
```

### 3c. (Optional) Archive backups to Synology Drive / HyperBackup

For an additional off-NAS copy, configure **Synology HyperBackup**:

1. DSM › Package Center → install **HyperBackup**
2. Create a new backup task pointing to the folder `/volume1/docker/clinicos/backups/`
3. Set destination to an external drive, another NAS, or cloud (Backblaze / S3 / Google Drive)
4. Schedule it to run after 2:30 AM so the nightly SQL dump is always included

---

## Restoring from a Backup

If you ever need to roll back:

```bash
# 1. Stop the API so nothing writes while you restore
docker compose -f deploy/docker-compose.yml stop clinicos-api

# 2. Wipe current data
docker exec clinicos-postgres psql -U clinicos clinicos \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Restore the chosen backup
zcat /volume1/docker/clinicos/backups/clinicos_20260713_020001.sql.gz | \
  docker exec -i clinicos-postgres psql -U clinicos clinicos

# 4. Restart the API
docker compose -f deploy/docker-compose.yml start clinicos-api
```

---

## Summary

| Step | What happens |
|------|-------------|
| `pg_dump` on Replit | Full plain-SQL export of all tables and data |
| `psql` restore on NAS | Imports all rows; replaces seeded demo data |
| `backup.sh` cron @ 2 AM | Compressed daily snapshot, 30-day retention |
| HyperBackup (optional) | Off-NAS copy for disaster recovery |
