# ClinicOS — Moving Your Data from Replit to Your Synology NAS

## Before you begin — what is actually happening here?

Think of your ClinicOS database the way you think of a patient filing cabinet.
Right now that cabinet lives inside Replit's cloud servers — you've been renting
shelf space there. Your NAS is your own filing cabinet at home/clinic. This guide
moves every folder, every file, every sticky note from the rented cabinet into
your own, then locks it, puts a key on it, and sets up a cleaner who makes a
complete photocopy of everything every night.

There are three distinct phases:

| Phase | What you do | Time needed |
|-------|------------|-------------|
| **1 — Export** | Take a complete snapshot of the Replit database | ~5 minutes |
| **2 — Import** | Pour that snapshot into the NAS database | ~10 minutes |
| **3 — Auto-backup** | Teach the NAS to photograph itself every night | ~10 minutes |

After this, the NAS is your **permanent primary database**. Replit keeps its own
frozen copy but the two will no longer stay in sync — you run the clinic from the
NAS going forward.

---

## What you need before starting

- Your NAS set up and running (as per the main `SYNOLOGY_DEPLOY_GUIDE.md`)
- The `clinicos-postgres` container healthy on the NAS (Step 4 of that guide)
- Your Replit project open in a browser tab
- A computer with a Terminal (macOS/Linux) or Command Prompt / Windows Terminal (Windows)
- About 30 minutes of uninterrupted time — none of the steps are hard, but you
  don't want to get distracted halfway through a data migration

---

## Part 1 — Export: Take a Snapshot of the Replit Database

### What is a "database dump"?

A database dump is a plain-text file containing every piece of data in the
database written out as SQL statements — essentially a list of instructions that
could rebuild the entire database from scratch on any machine. It looks like:

```sql
INSERT INTO patients (id, full_name, date_of_birth ...) VALUES (...);
INSERT INTO consultations (...) VALUES (...);
...
```

If the database were a patient's folder, the dump is a complete photocopy of
every page in that folder, in the right order, so it can be reprinted anywhere.

### Step 1a — Open the Replit Shell (not the Console)

In your Replit project, look at the bottom panel. You will see tabs labelled
**Console** and **Shell**.

- **Console** shows your app's output — read-only, like a monitor
- **Shell** is a full Linux terminal — you can type commands here

Click the **Shell** tab.

### Step 1b — Run the export command

Copy and paste this command into the Shell, then press Enter:

```bash
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file=/tmp/clinicos_export.sql
```

**What each flag means (you don't need to memorise these, but it helps to know):**

- `"$DATABASE_URL"` — Replit stores the database address and password in a
  variable called `DATABASE_URL`. The `$` means "use the value of this variable".
  You are not typing your password; it is automatically pulled from Replit's
  secure storage.
- `--no-owner` — The Replit database has a user account called something like
  `replit_user`. Your NAS database has a user called `clinicos`. This flag strips
  out the ownership information so the dump doesn't try to create the Replit user
  on your NAS and fail.
- `--no-acl` — Similar idea: strips out permission rules that are Replit-specific.
- `--format=plain` — Saves as a plain `.sql` text file, which is the most
  portable format and can be opened in any text editor if you ever need to inspect it.
- `--file=/tmp/clinicos_export.sql` — Saves the output to the `/tmp` folder
  inside Replit (a temporary scratch area).

The command will run silently for a few seconds and return you to the prompt
with no output — that is normal and means it succeeded.

### Step 1c — Confirm the file is not empty

```bash
wc -l /tmp/clinicos_export.sql
```

`wc -l` counts the number of lines in the file. You should see a number in the
**thousands** (e.g. `14382 /tmp/clinicos_export.sql`). If you see `0`, the dump
failed — most likely the database was empty or the `$DATABASE_URL` variable
wasn't set. In that case, type `echo $DATABASE_URL` and check it prints a
long postgres:// address.

### Step 1d — Move the file to where Replit can show it

Replit's file browser (the left panel) shows your project folder, but `/tmp` is
a system folder that doesn't appear there. Move the file into your project first:

```bash
cp /tmp/clinicos_export.sql ./clinicos_export.sql
```

Now look at the left panel — `clinicos_export.sql` should appear in the file
list. **Right-click it** and choose **Download**. Save it somewhere easy to find
— your Desktop is fine.

> **Note:** This file contains all your patient data. Treat it like a physical
> patient register — don't email it unencrypted or leave it in a shared folder.
> Delete it from your Downloads once the import is done.

---

## Part 2 — Import: Restore the Snapshot onto the NAS

### The big picture of what's about to happen

When you first set up the NAS (the `clinicos-init` step), the system created
empty tables and inserted a handful of demo users and sample drugs as a
starting point. You need to erase that demo data before pouring in the real
Replit data — otherwise you'd end up with duplicated patients and conflicting IDs.

The sequence is: **wipe demo data → restore real data → verify counts match**.

### Step 2a — Copy the dump file from your computer to the NAS

Open a **Terminal** on your computer (not Replit). On Windows, use Windows
Terminal or PowerShell. On Mac, it's in Applications › Utilities › Terminal.

```bash
scp ~/Desktop/clinicos_export.sql admin@<NAS-IP>:/volume1/docker/clinicos/
```

Replace `<NAS-IP>` with the local IP address of your NAS (e.g. `192.168.1.100`).
You can find this in DSM › Control Panel › Network › Network Interface.

`scp` stands for "secure copy" — it transfers files over SSH, the same encrypted
channel you use to log into the NAS. It will ask for your admin password.

**What a successful transfer looks like:**
```
clinicos_export.sql          100%   4.2MB   8.5MB/s   00:00
```

### Step 2b — Log into the NAS

```bash
ssh admin@<NAS-IP>
```

Type your admin password when prompted. You will land at a prompt that looks like:

```
admin@DiskStation:~$
```

Navigate to the project folder:

```bash
cd /volume1/docker/clinicos
```

### Step 2c — Confirm the database container is running and healthy

```bash
docker compose -f deploy/docker-compose.yml ps
```

You are looking for a line containing `clinicos-postgres` with the status
`running (healthy)`. If it shows `starting` wait 15 seconds and run the command
again. If it's not running at all:

```bash
docker compose -f deploy/docker-compose.yml up -d clinicos-postgres
```

Wait 15 seconds, then check `ps` again.

**If you haven't run `clinicos-init` yet** (i.e. this is a fresh NAS setup where
you skipped the seed step because you knew you'd be migrating), run it now to
create the table structure — without the tables the import has nowhere to put the data:

```bash
docker compose -f deploy/docker-compose.yml \
  --profile init run --rm clinicos-init
```

### Step 2d — Erase the demo data

This is the "clear the whiteboard before writing the real data" step.

The command below connects to the database inside the `clinicos-postgres`
container and runs a small script that empties every table:

```bash
docker exec -i clinicos-postgres psql -U clinicos clinicos <<'SQL'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
SQL
```

Breaking this down so it isn't mysterious:
- `docker exec -i clinicos-postgres` — run a command inside the running postgres container
- `psql -U clinicos clinicos` — open the PostgreSQL client, connecting as user `clinicos` to database `clinicos`
- `DO $$ ... $$` — run a block of procedural code (like a mini-script inside the database)
- `TRUNCATE TABLE ... CASCADE` — empty a table and anything linked to it (CASCADE handles foreign key relationships — similar to deleting a patient and all their linked visits at once)

After running, it will print `DO` — that means it worked.

> ⚠️ **This permanently deletes all rows.** Only run it immediately before the
> import below. Do not run it on a live production database with real patient data
> you haven't backed up first.

### Step 2e — Restore your real data

```bash
cat clinicos_export.sql | \
  docker exec -i clinicos-postgres psql -U clinicos clinicos
```

`cat` reads the file line by line. The `|` ("pipe") sends that output directly
into `psql` running inside the container, which executes each line as a SQL
command — essentially replaying every INSERT that was ever made on Replit.

**What the output looks like** — you will see a wall of text scrolling past:

```
SET
SET
SET
SET
...
CREATE TABLE
ALTER TABLE
...
COPY 847
COPY 2103
COPY 12
...
```

- `SET` — configuration settings being applied (harmless)
- `CREATE TABLE` / `ALTER TABLE` — table structure being set up
- `COPY 847` — 847 rows inserted into one of your tables (patients, consultations, etc.)
- `NOTICE: relation "..." already exists, skipping` — some things already existed
  from `clinicos-init`; PostgreSQL is sensibly skipping them rather than failing

**What you should not see:** lines beginning with `ERROR:` (except for a handful
of harmless ones like `ERROR: role "rds_superuser" does not exist` — those are
Replit-specific roles that don't matter on your NAS). If you see `ERROR: relation
"patients" does not exist` that means `clinicos-init` was never run — go back
to Step 2c.

The command finishes when it returns you to the shell prompt. For a database with
a few hundred patients and visits, this takes about 10–30 seconds.

### Step 2f — Verify: count the rows

This is your sanity check. Run:

```bash
docker exec clinicos-postgres psql -U clinicos clinicos -c "
SELECT
  (SELECT COUNT(*) FROM patients)         AS patients,
  (SELECT COUNT(*) FROM users)            AS users,
  (SELECT COUNT(*) FROM appointments)     AS appointments,
  (SELECT COUNT(*) FROM consultations)    AS consultations,
  (SELECT COUNT(*) FROM prescriptions)    AS prescriptions,
  (SELECT COUNT(*) FROM billing_invoices) AS invoices;
"
```

You will get a small table of numbers, for example:

```
 patients | users | appointments | consultations | prescriptions | invoices
----------+-------+--------------+---------------+---------------+----------
      312 |     6 |          891 |           438 |           621 |      274
```

Now open the Replit version of ClinicOS in a browser tab, navigate to Patients,
and check the count shown there matches the `patients` number above. Do the same
spot-check for a few other pages. If all the numbers match, the migration is
complete.

### Step 2g — Start everything and log in

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Open a browser: **`http://<NAS-IP>:<HOST_PORT>`**

Log in using your existing username and password — the same ones you use on
Replit, because your user accounts were just migrated along with everything else.

Browse around. Check a patient record, open a recent consultation, look at a
prescription. Everything should be exactly as you left it on Replit.

---

## Part 3 — Automatic Nightly Backups

### Why bother? Isn't the data already on a RAID NAS?

RAID (Redundant Array of Independent Disks) protects against a **hard drive
dying** — it's a hardware redundancy measure. It does not protect against:

- Accidental mass-deletion (you or someone else deletes 200 patient records)
- Software bugs that corrupt data
- The NAS itself being stolen or damaged in a fire/flood
- Ransomware encrypting your files

A time-series backup answers a different question: *"What did my database look
like at 2 AM last Tuesday?"* — so you can roll back to any point in the last 30
days. This is the same principle as taking intraoperative fluoroscopy images
at multiple stages rather than just at the end.

### Step 3a — Create a backup folder

```bash
mkdir -p /volume1/docker/clinicos/backups
```

`mkdir -p` creates the folder and any missing parent folders. The backups will
accumulate here as compressed `.sql.gz` files.

### Step 3b — Create the backup script

```bash
nano /volume1/docker/clinicos/deploy/backup.sh
```

`nano` is a simple text editor that runs in the terminal. It will open a blank
file. Paste the following content exactly (Ctrl+Shift+V to paste in most terminals):

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/volume1/docker/clinicos/backups"
DATE=$(date +%Y%m%d_%H%M)
FILE="$BACKUP_DIR/clinicos_$DATE.sql.gz"
RETAIN_DAYS=30

# Load DB_PASSWORD and SESSION_SECRET from the project's .env file
source /volume1/docker/clinicos/deploy/.env

# Take the dump and compress it on the fly with gzip
docker exec clinicos-postgres \
  pg_dump -U clinicos clinicos \
  --no-owner --no-acl --format=plain \
  | gzip > "$FILE"

echo "$(date): Backup written to $FILE  ($(du -sh "$FILE" | cut -f1))"

# Delete any backup files older than RETAIN_DAYS days
find "$BACKUP_DIR" -name "clinicos_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "$(date): Pruned backups older than $RETAIN_DAYS days"
```

**Line-by-line explanation:**

| Line | What it does |
|------|-------------|
| `#!/bin/bash` | Tells the system this is a Bash script |
| `set -euo pipefail` | Stop immediately if any command fails (like a "fail-safe" mode — better than silently producing an empty backup file) |
| `DATE=$(date +%Y%m%d_%H%M)` | Captures the current date/time as a string like `20260713_0200` |
| `FILE=...` | Builds the filename, e.g. `clinicos_20260713_0200.sql.gz` |
| `source .env` | Loads your environment variables (including `DB_PASSWORD`) |
| `pg_dump ... \| gzip > "$FILE"` | Dumps the database and compresses it simultaneously — a 10 MB SQL file typically compresses to ~1 MB |
| `find ... -mtime +30 -delete` | Deletes backups older than 30 days, keeping disk usage bounded |

To **save and exit** nano: press **Ctrl+O** (write Out), then **Enter** to confirm
the filename, then **Ctrl+X** to exit.

Make the script executable (the OS won't run it otherwise, like needing to unlock
a drawer before you can open it):

```bash
chmod +x /volume1/docker/clinicos/deploy/backup.sh
```

### Step 3c — Test the script manually before scheduling it

Never schedule something you haven't tested. Run it once:

```bash
/volume1/docker/clinicos/deploy/backup.sh
```

Expected output:
```
Mon Jul 13 02:15:43 IST 2026: Backup written to /volume1/docker/clinicos/backups/clinicos_20260713_0215.sql.gz  (1.1M)
Mon Jul 13 02:15:43 IST 2026: Pruned backups older than 30 days
```

Confirm the file exists:

```bash
ls -lh /volume1/docker/clinicos/backups/
```

You should see a `.sql.gz` file with a non-zero size.

### Step 3d — Schedule it to run every night at 2:00 AM

"Cron" is Linux's built-in scheduler — think of it as a programmable alarm clock
that runs scripts at specified times. Each line in the "cron table" is one alarm.

Open the cron table for the root user (the NAS runs scheduled tasks as root):

```bash
sudo crontab -e
```

If it asks which editor to use, choose `nano` (usually option 1).

Move to the end of the file and add this line:

```
0 2 * * * /volume1/docker/clinicos/deploy/backup.sh >> /volume1/docker/clinicos/backups/backup.log 2>&1
```

**Reading the cron schedule** — the five numbers/stars before the script path are:

```
┌── minute (0–59)
│  ┌── hour (0–23)
│  │  ┌── day of month (1–31)
│  │  │  ┌── month (1–12)
│  │  │  │  ┌── day of week (0–7, both 0 and 7 = Sunday)
│  │  │  │  │
0  2  *  *  *   → "At minute 0 of hour 2, every day of every month"  = 2:00 AM daily
```

The `>> backup.log 2>&1` part appends all output (including errors) to a log
file — so if a backup ever fails at 2 AM while you're asleep, you can read
`backup.log` later to see what went wrong.

Save and exit (Ctrl+O, Enter, Ctrl+X).

Confirm the cron entry was saved:

```bash
sudo crontab -l
```

You should see your line in the output.

### Step 3e — (Strongly recommended) Off-NAS copy with HyperBackup

The nightly script protects against data corruption and accidental deletion, but
the backup files live on the same NAS. If the NAS itself is lost (theft, fire,
flooding in the server room), you lose both the live data and the backups.

**Synology HyperBackup** can send a copy of your backup folder to an external
USB drive or to cloud storage (Google Drive, Amazon S3, Backblaze B2):

1. In DSM, go to **Package Center** and install **HyperBackup**
2. Open HyperBackup › **+** (Add backup task)
3. Choose your destination:
   - **External drive**: plug a USB drive into the NAS, pick it as destination
   - **Cloud**: choose a provider — Backblaze B2 is inexpensive and reliable
4. When asked what to back up, select the folder:  
   `/volume1/docker/clinicos/backups`
5. Schedule it at **2:30 AM** — this runs 30 minutes after the SQL dump finishes,
   so the freshest dump is always included in the off-NAS copy
6. Enable **encryption** in HyperBackup — your backup files contain patient data;
   encrypting them means even if the destination is compromised, the data
   is unreadable without your key. **Write the encryption key down and store it
   somewhere safe** — if you lose it and the NAS fails, the backups are
   unrecoverable.

---

## Restoring from a Backup

If you ever need to roll back the database to a previous state (e.g. after
accidental bulk deletion, or testing a data fix gone wrong):

**Step R1 — Stop the API server so no new data is written during the restore:**
```bash
docker compose -f deploy/docker-compose.yml stop clinicos-api
```

**Step R2 — List your available backups and choose one:**
```bash
ls -lh /volume1/docker/clinicos/backups/clinicos_*.sql.gz
```
Pick the file dated just before the problem occurred.

**Step R3 — Wipe the current database:**
```bash
docker exec -i clinicos-postgres psql -U clinicos clinicos <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
SQL
```

**Step R4 — Restore the chosen backup** (`zcat` decompresses `.gz` on the fly):
```bash
zcat /volume1/docker/clinicos/backups/clinicos_20260713_020001.sql.gz | \
  docker exec -i clinicos-postgres psql -U clinicos clinicos
```

**Step R5 — Restart the API:**
```bash
docker compose -f deploy/docker-compose.yml start clinicos-api
```

**Step R6 — Verify row counts** (as in Step 2f above) to confirm the restore landed correctly.

---

## Troubleshooting

| Symptom | Most likely cause | Fix |
|---------|------------------|-----|
| `wc -l` shows 0 on the dump file | `DATABASE_URL` wasn't set | Type `echo $DATABASE_URL` in Replit Shell — if blank, the secret isn't configured. Contact support. |
| `scp` fails with "connection refused" | SSH not enabled on NAS or wrong IP | DSM › Control Panel › Terminal & SNMP › tick "Enable SSH". Double-check the IP with `ifconfig` on the NAS. |
| Restore shows many `ERROR: relation does not exist` | `clinicos-init` was never run | Run the `clinicos-init` step from the main guide, then repeat from Step 2d |
| Row counts after restore are lower than Replit | Dump was taken during active use; some rows written after dump | Re-export from Replit during low-activity hours and redo the import |
| Backup script produces empty `.gz` file | `clinicos-postgres` container was stopped | Check `docker compose ps`; start the container and re-run the script manually |
| Cannot edit crontab — "no permission" | Running without sudo | Always use `sudo crontab -e` on Synology |

---

## Summary of the whole process

```
Replit                          Your Computer              NAS
──────                          ─────────────              ───
pg_dump → clinicos_export.sql → Download → scp ─────────→ import into
                                                           clinicos-postgres
                                                                ↓
                                                     backup.sh runs @ 2 AM
                                                     creates .sql.gz files
                                                                ↓
                                                     HyperBackup copies to
                                                     cloud / external drive
```

Once the import is verified, the NAS is your clinic's system of record.
You can close the Replit tab — it will keep its frozen copy safe, but
you won't be using it anymore.
