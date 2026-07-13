# ClinicOS — Database Migration: Replit → Synology NAS

This guide covers three things:

1. **Export** — dump the live database from Replit
2. **Import** — restore it into your NAS PostgreSQL container
3. **Auto-backup** — schedule daily backups on the NAS with 30-day retention

After migration the NAS is the **primary database**. Replit becomes read-only/archived.

> **Note — `sudo` is required on Synology**
> The `admin` account cannot talk to Docker directly. Every `docker` and
> `docker compose` command in this guide must be prefixed with `sudo`.

---

## Part 1 — Export the Replit Database

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

Verify it worked:

```bash
wc -l /tmp/clinicos_export.sql
# Should print several thousand lines (not 0)
```

### 1c. Download the file to your computer

The `/tmp` directory is not visible in the Replit file browser. Copy it into
the project folder first:

```bash
cp /tmp/clinicos_export.sql ./clinicos_export.sql
```

Now it appears in the file tree — right-click it and choose **Download**.

---

## Part 2 — Import into the NAS

### 2a. Copy the dump file to the NAS

From your computer (Terminal / Command Prompt / WSL):

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
sudo docker compose -f deploy/docker-compose.yml up -d clinicos-postgres

sudo docker compose -f deploy/docker-compose.yml ps
# clinicos-postgres should show "(healthy)"
```

If you already ran `clinicos-init` (migrations + seed), the tables exist.
If not, run it now:

```bash
sudo docker compose -f deploy/docker-compose.yml \
  --profile init run --rm clinicos-init
```

### 2d. Reset the database (remove seeded demo data)

Drop the entire public schema and recreate it — one command, no quoting issues:

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

> **Caution:** This wipes all rows and table definitions. Only run before the import.

### 2e. Copy the dump into the container, then restore

Using `docker cp` avoids all pipe/permission issues:

```bash
# Copy the dump file into the container
sudo docker cp clinicos_export.sql clinicos-postgres:/tmp/clinicos_export.sql

# Restore — recreates all tables and loads data in one step
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -f /tmp/clinicos_export.sql
```

`NOTICE` and `WARNING` lines in the output are harmless. To see only real
errors:

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -f /tmp/clinicos_export.sql 2>&1 | grep "^ERROR"
```

### 2f. Verify the import

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos -c "
SELECT
  (SELECT COUNT(*) FROM patients)      AS patients,
  (SELECT COUNT(*) FROM users)         AS users,
  (SELECT COUNT(*) FROM appointments)  AS appointments,
  (SELECT COUNT(*) FROM consultations) AS consultations,
  (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
  (SELECT COUNT(*) FROM invoices)      AS invoices;
"
```

Compare the numbers against what you see in the Replit app.

### 2g. Start all services

```bash
sudo docker compose -f deploy/docker-compose.yml up -d
```

Open `http://<NAS-IP>:<HOST_PORT>` and log in with your existing credentials.

---

## Part 3 — Automated Daily Backups

### 3a. Create the backup script

```bash
mkdir -p /volume1/docker/clinicos/backups
nano /volume1/docker/clinicos/deploy/backup.sh
```

Paste this content:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/volume1/docker/clinicos/backups"
DATE=$(date +%Y%m%d_%H%M)
FILE="$BACKUP_DIR/clinicos_$DATE.sql.gz"
RETAIN_DAYS=30

# Dump and compress (sudo required on Synology)
sudo docker exec clinicos-postgres \
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
sudo bash /volume1/docker/clinicos/deploy/backup.sh
ls -lh /volume1/docker/clinicos/backups/
# Should show a .sql.gz file
```

### 3b. Schedule the cron job

Synology's cron runs as root (which already has Docker access — no `sudo` needed
inside the cron entry itself):

```bash
sudo crontab -e
```

Add this line (runs at 2:00 AM every night):

```
0 2 * * * /volume1/docker/clinicos/deploy/backup.sh >> /volume1/docker/clinicos/backups/backup.log 2>&1
```

Save and exit. Confirm it was saved:

```bash
sudo crontab -l
```

### 3c. (Optional) Archive backups off-NAS with HyperBackup

1. DSM › Package Center → install **HyperBackup**
2. Create a backup task targeting `/volume1/docker/clinicos/backups/`
3. Set destination: external drive, another NAS, or cloud (Backblaze / S3 / Google Drive)
4. Schedule after 2:30 AM so the nightly SQL dump is always included

---

## Restoring from a Backup

```bash
# 1. Stop the API so nothing writes during restore
sudo docker compose -f deploy/docker-compose.yml stop clinicos-api

# 2. Wipe current data
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Decompress, copy into container, restore
# (replace the filename with the backup you want)
zcat /volume1/docker/clinicos/backups/clinicos_20260713_020001.sql.gz \
  > /tmp/clinicos_restore.sql
sudo docker cp /tmp/clinicos_restore.sql clinicos-postgres:/tmp/clinicos_restore.sql
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -f /tmp/clinicos_restore.sql

# 4. Restart the API
sudo docker compose -f deploy/docker-compose.yml start clinicos-api
```

---

## Summary

| Step | Command prefix | What happens |
|------|---------------|-------------|
| Export on Replit | *(none — runs in Replit shell)* | Full plain-SQL dump of all tables |
| All NAS docker commands | `sudo docker …` | Required — admin user lacks Docker socket access |
| Import to NAS | `sudo docker cp` + `sudo docker exec psql -f` | Rebuilds tables and loads all data |
| Daily backup cron | `sudo crontab -e` (root runs the job) | Compressed snapshot, 30-day retention |
| HyperBackup (optional) | DSM GUI | Off-NAS copy for disaster recovery |
