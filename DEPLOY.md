# Deploy runbook — Mytanah (FYP2)

This repo is deployed to a single GCP VM. The VM is **not** a git clone — files
are pushed up over `gcloud compute scp`. When the user says "deploy", do the
steps below without asking for confirmation.

## Target

| Item            | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| GCP instance    | `kw-property-valuation`                                          |
| Zone            | `asia-southeast1-a`                                              |
| External IP     | `34.87.4.244`                                                    |
| Public URL      | `https://explore-mytanah.com/`                                   |
| VM user         | `kaiwen_pixalink_io`                                             |
| App dir on VM   | `/home/kaiwen_pixalink_io/fyp2/`                                 |
| systemd service | `fyp2.service` (runs uvicorn on `127.0.0.1:8000`)                |
| Public proxy    | `nginx` on ports 80/443 with Let's Encrypt TLS                   |
| Health endpoint | `GET https://explore-mytanah.com/health` -> 200 when up          |

Nginx owns public ports 80 and 443, terminates HTTPS for
`explore-mytanah.com` and `www.explore-mytanah.com`, and proxies to uvicorn on
`127.0.0.1:8000`. The VM has both `http-server` and `https-server` network tags
and the project has the default `default-allow-http` and `default-allow-https`
firewall rules.

## SSH — important quirk

**Use direct SSH, not IAP.** The conditional IAP tunnel grant currently fails
with `4033: 'not authorized'`. Direct SSH over the external IP works:

```bash
gcloud compute ssh kw-property-valuation --zone=asia-southeast1-a --command="…"
```

Do **not** pass `--tunnel-through-iap`. Do **not** request additional IAM
roles to "fix" IAP — the user has explicitly refused that. IAM is sufficient.

## SCP — important quirk

`gcloud compute scp` on Windows mangles backslash paths
(`C:\Users\...` becomes `C:UsersUser...`). Always use **forward slashes**:

```bash
gcloud compute scp \
  "C:/Users/User/Documents/APU/FYP2/path/to/file" \
  kw-property-valuation:/home/kaiwen_pixalink_io/fyp2/path/to/file \
  --zone=asia-southeast1-a
```

## Deploy procedure

1. **Check local git is clean and pushed** (so the deployed state matches the
   commit history):

   ```bash
   git status
   git log --oneline -5
   ```

   If the local branch is ahead of `origin/main`, push first.

2. **Diff against what's on the VM** to find which files actually need to go
   up. Compare commit timestamps to the VM file mtimes, or just diff the
   commits since the last known deploy:

   ```bash
   git log --name-status <last-deployed-sha>..HEAD
   ```

   If you don't know the last deployed SHA, SSH in and `ls -la` the suspected
   files. Frontend changes and backend changes are independent — only sync
   the dirs that actually changed.

3. **SCP the changed files** (parallel SCP calls are fine, one per file):

   - Use forward-slash paths (see above).
   - For deletions on the VM, do them over SSH:
     `rm path` or `rm -rf dir`.
   - Do **not** SCP the venv, `__pycache__`, `*.parquet` unless they actually
     changed, or `node_modules`.

4. **Restart the service only if backend changed.** Static frontend assets
   are served directly from disk by FastAPI's static mount, so frontend-only
   changes (jsx, css, images, video) are live the moment SCP finishes — no
   restart needed.

   When `backend/api.py`, `backend/requirements.txt`, `backend/save_models.py`,
   or anything in `backend/artifacts/` changes, restart:

   ```bash
   gcloud compute ssh kw-property-valuation --zone=asia-southeast1-a \
     --command="sudo systemctl restart fyp2 && sleep 8 && systemctl status fyp2 --no-pager | head -15"
   ```

   **If `requirements.txt` changed**, install into the venv *before* restarting:

   ```bash
   gcloud compute ssh kw-property-valuation --zone=asia-southeast1-a \
     --command="/home/kaiwen_pixalink_io/fyp2/backend/.venv/bin/pip install -r /home/kaiwen_pixalink_io/fyp2/backend/requirements.txt"
   ```

   The FT-Transformer model needs **CPU torch** (`torch==2.11.0+cpu`, pulled via
   the `--extra-index-url` line in `requirements.txt`). It's a ~190 MB download
   that imports lazily — torch only loads into the API process the first time
   someone selects the FT-Transformer tab, so the other models are unaffected.
   Watch VM RAM after the first FT request (single-slot model cache still holds,
   but the torch import itself adds ~200 MB resident).

   The `sleep 8` matters: the XGBoost-CUDA model takes a few seconds to load
   on cold start, so an immediate `curl` will fail with `local_health=000`
   even though the service is fine.

5. **Smoke-test the live URL:**

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 http://explore-mytanah.com/
   # expect: 301 (Nginx redirects HTTP to HTTPS)
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 https://explore-mytanah.com/health
   # expect: 200
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 https://explore-mytanah.com/
   # expect: 200
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 \
     https://explore-mytanah.com/dashboard
   # expect: 200
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 \
     https://explore-mytanah.com/dashboard/roi
   # expect: 200
   ```

   If you changed any specific frontend asset, also `curl -I` it to confirm
   the new size lands.

## What lives where on the VM

```
/home/kaiwen_pixalink_io/fyp2/
├── backend/
│   ├── api.py                    # FastAPI entrypoint (uvicorn loads api:app)
│   ├── requirements.txt
│   ├── save_models.py
│   ├── artifacts/                # trained model bundle (XGBoost-CUDA, R²≈0.881)
│   └── .venv/                    # Python venv — do NOT scp this
├── frontend/
│   ├── dist/                     # built dashboard SPA served at /dashboard/*
│   └── ui_kits/dashboard/        # public landing page and legacy fallback
└── processed data/
    ├── transactions.parquet      # cleaned dataset (~4.4 MB)
    └── scheme_mukim_index.csv    # Scheme/Area → Mukim index
```

## systemd unit (for reference)

`/etc/systemd/system/fyp2.service` on the VM:

```ini
[Unit]
Description=FYP2 Property API (FastAPI/uvicorn)
After=network-online.target

[Service]
Type=simple
User=kaiwen_pixalink_io
WorkingDirectory=/home/kaiwen_pixalink_io/fyp2/backend
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/kaiwen_pixalink_io/fyp2/backend/.venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

If the unit file itself ever changes, run `sudo systemctl daemon-reload`
before restarting the service.

## Troubleshooting

- **`4033: 'not authorized'` on SSH** — you used `--tunnel-through-iap`. Drop
  that flag and try direct SSH.
- **`local_health=000` right after restart** — model is still loading. Wait
  ~8 seconds and retry.
- **`scp` says "No such file or directory" with a mangled path** — you used
  Windows backslashes. Switch to forward slashes.
- **CRLF warnings on `git add`** — harmless Windows line-ending noise; ignore.
- **External port-8000 is firewall-blocked.** This is intentional. Nginx serves
  ports 80/443 and proxies to uvicorn on local-only `127.0.0.1:8000`.
