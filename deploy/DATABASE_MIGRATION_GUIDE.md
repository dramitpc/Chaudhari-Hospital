# ClinicOS — Database Migration: Replit → Synology NAS

This guide covers three things:

1. **Export** — dump the live production database from Replit
2. **Import** — restore it into your NAS PostgreSQL container
3. **Auto-backup** — schedule daily backups on the NAS with 30-day retention

After migration the NAS is the **primary database**. Replit becomes read-only/archived.

> **Note — `sudo` is required on Synology**
> The `admin` account cannot talk to Docker directly. Every `docker` and
> `docker compose` command in this guide must be prefixed with `sudo`.

---

## Part 1 — Get the Production DATABASE_URL

The Replit **development** shell connects to the development database (which has
only a small amount of test data). Your real patient data lives in the
**production** database, which has a different connection string.

1. In Replit, click the **Deployments** tab (rocket icon in the left sidebar)
2. Click your active deployment
3. Open **"Environment variables"** (or "Secrets")
4. Find `DATABASE_URL` and copy the full value — it looks like:
   ```
   postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

Keep this value ready for the next step.

---

## Part 2 — Export from the NAS (SSL-safe)

Do **not** run `pg_dump` from your computer — local PostgreSQL clients are often
compiled without SSL support and will fail to connect to Neon. Instead, run
`pg_dump` from inside the NAS postgres container, which always has full SSL
support.

### 2a. SSH into the NAS

```bash
ssh admin@<NAS-IP>
cd /volume1/docker/clinicos
```

### 2b. Make sure the database container is running

```bash
sudo docker compose -f deploy/docker-compose.yml up -d clinicos-postgres

sudo docker compose -f deploy/docker-compose.yml ps
# clinicos-postgres should show "(healthy)"
```

### 2c. Dump the production database from inside the container

```bash
sudo docker exec clinicos-postgres pg_dump \
  "postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file=/tmp/clinicos_prod_export.sql
```

Replace the connection string with your actual production `DATABASE_URL`.

Verify the dump is not empty:

```bash
sudo docker exec clinicos-postgres wc -l /tmp/clinicos_prod_export.sql
# Should be tens of thousands of lines
```

---

## Part 3 — Import into the NAS Database

The dump file is already inside the container at `/tmp/clinicos_prod_export.sql`
— no extra copy step needed.

### 3a. Reset the local database (remove seeded demo data)

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

> **Caution:** This wipes all rows and table definitions. Only run before the import.

### 3b. Restore

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -f /tmp/clinicos_prod_export.sql
```

`NOTICE` and `WARNING` lines are harmless. To see only real errors:

```bash
sudo docker exec clinicos-postgres psql -U clinicos clinicos \
  -f /tmp/clinicos_prod_export.sql 2>&1 | grep "^ERROR"
```

### 3c. Verify the import

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

Compare the numbers against what you see in the Replit deployed app.

### 3d. Start all services

```bash
sudo docker compose -f deploy/docker-compose.yml up -d
```

Open `http://<NAS-IP>:<HOST_PORT>` and log in with your existing credentials.

---

## Part 4 — Automated Daily Backups

Once the NAS is live, set up a cron job that dumps the database every night and
keeps 30 days of backups.

### 4a. Create the backup script

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

# Dump the local NAS database and compress
sudo docker exec clinicos-postgres \
  pg_dump -U clinicos clinicos \
  --no-owner --no-acl --format=plain \
  | gzip > "$FILE"

echo "$(date): Backup written to $FILE ($(du -sh "$FILE" | cut -f1))"

# Delete backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "clinicos_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "$(date): Pruned backups older than $RETAIN_DAYS days"
```

Make it executable and test it:

```bash
chmod +x /volume1/docker/clinicos/deploy/backup.sh
sudo bash /volume1/docker/clinicos/deploy/backup.sh
ls -lh /volume1/docker/clinicos/backups/
# Should show a .sql.gz file
```

### 4b. Schedule the cron job

```bash
sudo crontab -e
```

Add this line (runs at 2:00 AM every night):

```
0 2 * * * /volume1/docker/clinicos/deploy/backup.sh >> /volume1/docker/clinicos/backups/backup.log 2>&1
```

Save and confirm:

```bash
sudo crontab -l
```

### 4c. (Optional) Archive off-NAS with HyperBackup

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

# 3. Decompress the chosen backup, copy into container, then restore
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

| Step | Where it runs | Key point |
|------|--------------|-----------|
| Get production `DATABASE_URL` | Replit Deployments UI | Dev shell uses a different DB — always use the production URL |
| `pg_dump` | Inside NAS postgres container | Container has SSL compiled in; local pg_dump often does not |
| Reset + restore | NAS (via `sudo docker exec`) | Drop schema first, then `psql -f` the dump |
| Daily backup | NAS cron (`sudo crontab`) | Dumps local NAS DB nightly, 30-day retention |
| HyperBackup (optional) | DSM GUI | Off-NAS copy for disaster recovery |
