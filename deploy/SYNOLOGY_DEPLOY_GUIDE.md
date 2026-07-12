# ClinicOS — Synology DS420+ Self-Hosting Guide

**Target:** Synology DS420+ · DSM 7.3.2 Update 3 · Intel Celeron J4125 (amd64)

---

## What you'll end up with

| Container | Role |
|---|---|
| `clinicos-postgres` | PostgreSQL 16 database with persistent volume |
| `clinicos-api` | Node.js 24 Express API (port 8080, internal only) |
| `clinicos-frontend` | nginx serving the React app + proxying `/api` |

Everything is orchestrated with Docker Compose. The app is accessible on **`http://<NAS-IP>:<HOST_PORT>`** (default port 80).

---

## Prerequisites

### On the NAS
1. **Enable SSH**  
   DSM › Control Panel › Terminal & SNMP › Enable SSH service  
   (You can disable it again after setup if you prefer.)

2. **Install Container Manager**  
   DSM › Package Center › search "Container Manager" › Install  
   (This installs Docker + Compose on the NAS.)

3. **Create a shared folder for the project** (optional but tidy)  
   DSM › Control Panel › Shared Folder › Create › name it `docker` or `clinicos`  
   Note the path (e.g. `/volume1/docker`).

### On your computer
- Git
- SSH client (`ssh`, already available on macOS/Linux/WSL)

---

## Step 1 — Copy the project to the NAS

SSH into the NAS and clone (or rsync) the project:

```bash
ssh admin@<NAS-IP>
cd /volume1/docker          # or wherever you want to keep it
git clone <YOUR-REPO-URL> clinicos
cd clinicos
```

If you don't have git on the NAS, transfer via `scp` / Synology Drive from your computer:

```bash
# From your computer:
scp -r /path/to/clinicos admin@<NAS-IP>:/volume1/docker/clinicos
```

---

## Step 2 — Create the environment file

```bash
cd /volume1/docker/clinicos/deploy

cp .env.example .env
nano .env          # or vi .env
```

Fill in two values — generate them with `openssl rand -base64 48`:

```
DB_PASSWORD=<strong-random-password>
SESSION_SECRET=<long-random-secret>
HOST_PORT=80        # change to 8080 or another port if 80 is taken
```

Save and close.

---

## Step 3 — Build the Docker images

This step compiles the TypeScript source and packages everything.  
It takes **5–15 minutes** on the first run (subsequent builds are faster due to Docker layer cache).

```bash
cd /volume1/docker/clinicos

docker compose -f deploy/docker-compose.yml build
```

Watch for any errors. Common issues:
- **Out of memory during build** — the DS420+ has 4 GB RAM which is enough, but make sure no other heavy process is running.
- **pnpm frozen-lockfile error** — add `--no-frozen-lockfile` to the `pnpm install` line in the Dockerfile temporarily.

---

## Step 4 — Start the database

Start only the database first so migrations can connect to it:

```bash
docker compose -f deploy/docker-compose.yml up -d clinicos-postgres
```

Wait ~10 seconds for it to become healthy:

```bash
docker compose -f deploy/docker-compose.yml ps
# clinicos-postgres should show "(healthy)"
```

---

## Step 5 — Run database migrations and seed

This creates all tables and inserts the initial users, drugs, and settings.  
**Run this once on first setup only.**

```bash
docker compose -f deploy/docker-compose.yml \
  --profile init \
  run --rm clinicos-init
```

You should see Drizzle push output followed by "Seed complete."

---

## Step 6 — Start all services

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Check everything is running:

```bash
docker compose -f deploy/docker-compose.yml ps
```

All three containers (`clinicos-postgres`, `clinicos-api`, `clinicos-frontend`) should show `running`.

Tail the API logs to confirm it connected to the database:

```bash
docker compose -f deploy/docker-compose.yml logs -f clinicos-api
```

---

## Step 7 — Access the app

Open a browser: **`http://<NAS-IP>:<HOST_PORT>`**

Default login credentials (change them after first login):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Doctor | `dr.smith` | `Doctor@123` |
| Staff | `staff.jane` | `Staff@123` |
| Radiographer | `rad.kumar` | `Radiology@123` |

---

## Optional — HTTPS via Synology Reverse Proxy

To get HTTPS without buying a certificate, use Synology's built-in Let's Encrypt support:

1. **Get a domain** — you can use a free Synology DDNS hostname:  
   DSM › Control Panel › External Access › DDNS › Add  
   Example: `myclinic.synology.me`

2. **Request a Let's Encrypt certificate:**  
   DSM › Control Panel › Security › Certificate › Add  
   Select "Get a certificate from Let's Encrypt"

3. **Create a reverse proxy rule:**  
   DSM › Control Panel › Login Portal › Advanced › Reverse Proxy › Create

   | Field | Value |
   |---|---|
   | Source Protocol | HTTPS |
   | Source Hostname | `myclinic.synology.me` |
   | Source Port | 443 |
   | Destination Protocol | HTTP |
   | Destination Hostname | `localhost` |
   | Destination Port | `<HOST_PORT from .env>` |

4. **Assign your certificate** to the reverse proxy source hostname.

The app is now available at `https://myclinic.synology.me`.

---

## Day-to-day operations

### Restart a service
```bash
docker compose -f deploy/docker-compose.yml restart clinicos-api
```

### View logs
```bash
docker compose -f deploy/docker-compose.yml logs -f clinicos-api
docker compose -f deploy/docker-compose.yml logs -f clinicos-frontend
```

### Stop everything
```bash
docker compose -f deploy/docker-compose.yml down
```

### Update to a new version
```bash
cd /volume1/docker/clinicos
git pull
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
```

### Backup the database
```bash
docker exec clinicos-postgres \
  pg_dump -U clinicos clinicos > clinicos_backup_$(date +%Y%m%d).sql
```

### Restore a backup
```bash
cat clinicos_backup_20260627.sql | \
  docker exec -i clinicos-postgres psql -U clinicos clinicos
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with pnpm version error | Make sure you pulled the latest code — the Dockerfiles now pin `pnpm@10.26.1` via `npm install -g` which avoids all lockfile version issues |
| Frontend loads but API calls fail (network error) | Check the API container is running and `nginx.conf` upstream name matches `clinicos-api` |
| `clinicos-init` exits with "connection refused" | The postgres container isn't healthy yet — wait 30 s and retry |
| Port 80 already in use | Set `HOST_PORT=8888` (or any free port) in `deploy/.env` and restart frontend |
| Out of disk space during build | Run `docker system prune -f` to clear old images and build cache |
