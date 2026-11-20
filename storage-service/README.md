# Oracle image store

This small Node service stores private card images on the Oracle VM. Cloudflare Pages Functions authenticate the user's DCR session and issue one-use, 120-second capabilities in D1 for a single card side and operation. The VM consumes each capability by calling `/api/media/authorize`; it does not receive a long-lived application token or the user's DCR session cookie.

Files use opaque IDs under `/srv/dcr-vault-media/<owner-uuid>/<card-uuid>/<side>.<ext>`. The service accepts JPEG, PNG, and WebP files up to 10 MiB, verifies the file signature, and binds only to `127.0.0.1:8788`. Nginx/TLS is the public edge; never expose this Node listener directly.

## Current VM rollout

The OCI instance is Ubuntu 22.04 ARM64 with Node at `/usr/local/bin/node`. The service is installed and enabled as `dcr-vault-image-store.service`, running as the locked `dcr-image-store` account. Its code is root-owned at `/opt/dcr-vault-image-store`; `/srv/dcr-vault-media` is mode `0700` and owned by the service account. It listens only on `127.0.0.1:8788`. The existing PocketDock gateway on port 8787 is unrelated and was left untouched.

The production Oracle origin is `https://217-142-238-24.sslip.io`, which resolves to `217.142.238.24` through the external `sslip.io` DNS service. Nginx is active on IPv4 ports 80 and 443. Port 80 serves only ACME HTTP-01 challenge files and returns 404 for all other paths. Port 443 proxies `/v1/` and `/ocr/v1/`; all other paths return 404. Cloudflare Workers cannot make subrequests to IP-literal URLs, and the shared `dcr-vault.pages.dev` domain is not a DNS zone we control. `sslip.io` is therefore the current hostname dependency; move to a controlled domain if that service stops resolving the origin. OCI ingress allows TCP 80/443 from `0.0.0.0/0`; the VM's persistent INPUT rules allow only those two new TCP ports before the existing reject rule. The original rules are backed up at `/etc/iptables/rules.v4.before-dcr-vault-https`. Keep both application services loopback-only.

Certbot 5.10 from the official Snap publisher is installed, and its automatic renewal timer is enabled. The active production certificate `dcr-vault-origin` covers `217-142-238-24.sslip.io`; its renewal configuration uses webroot HTTP-01 and `/usr/local/sbin/dcr-vault-reload-nginx` as the deploy hook. The previous IP certificate `dcr-vault-ip` remains installed for rollback but is not used by the active Nginx configuration. The temporary staging certificate was removed after production issuance.

The OCR service was deployed on 2026-11-20 from repository commit `2dab7213513f1d063b12d92b3a183698a55e4c9a`. It is enabled as `dcr-vault-ocr.service`, runs as the locked `dcr-vault-ocr` account, and listens only on `127.0.0.1:8790`. Its pinned PaddlePaddle 3.2.0 and PaddleOCR 3.7.0 packages import successfully on this Ubuntu 22.04 ARM64 host. The private catalog was built from TCGdex commit `4218f64dcbf3de6e7b7548530f938fb0b9ebbe2a`; SQLite integrity passed for 42,599 cards and 50,394 localized records. Nginx now proxies `/ocr/v1/` to the OCR service while keeping the existing `/v1/` media proxy unchanged. The OCR health endpoint reports the catalog ready, and requests without the token are rejected. The matching random token is stored in root-only `/etc/dcr-vault-ocr.env` and the production Pages secret `ORCL_OCR_TOKEN`; never print or commit its value.

## Cloudflare Workers hostname

The current Pages deployment uses `ORCL_SERVICE_ORIGIN=https://217-142-238-24.sslip.io`, configured as a GitHub Actions repository variable. `sslip.io` derives the DNS answer from the IP embedded in the hostname, so this setup does not require a DNS record in an account we control. This third-party DNS dependency can be replaced later with a hostname under a domain we control. Keep the existing OCI ingress limited to ports 80 and 443.

The production hostname certificate was issued while the HTTP-01 challenge server was active:

~~~sh
ORACLE_HOSTNAME=217-142-238-24.sslip.io
sudo certbot certonly --webroot -w /var/www/letsencrypt --cert-name dcr-vault-origin -d "$ORACLE_HOSTNAME"
~~~

The installed `nginx-origin.conf` template uses the stable Certbot lineage `dcr-vault-origin`; `sudo nginx -t` passed before the active Nginx configuration was reloaded. The Certbot renewal hook reloads Nginx after certificate renewal.

The deployment workflow validates that `ORCL_SERVICE_ORIGIN` is an HTTPS DNS hostname rather than an IP literal, then assigns the same origin to `ORCL_MEDIA_ORIGIN` and `ORCL_OCR_ORIGIN`. The production deploy is skipped if the variable is missing or invalid. The hostname deployment completed successfully on 2026-11-20. Keep `ORCL_OCR_TOKEN` as a separate Pages secret.

## OCR-first identification service

The separate Python service in `ocr_service.py` runs the existing `dcr-tag-70x20/pipeline/image_to_label.py` workflow with OCR-first, image-recovery-disabled, and lookup-only options. It binds only to `127.0.0.1:8790`. Nginx proxies only `/ocr/v1/` to this listener; the service checks `X-DCR-OCR-Token` before reading an image. The original image and generated scan files are held in a temporary directory and removed after each request.

Install the repository under `/opt/dcr-vault-ocr`, then provision the private catalog and OCR runtime:

~~~sh
npm ci --prefix /opt/dcr-vault-ocr/dcr-tag-70x20/catalog
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-tha
python3 -m venv /opt/dcr-vault-ocr/.venv-ocr
/opt/dcr-vault-ocr/.venv-ocr/bin/python -m pip install -r /opt/dcr-vault-ocr/dcr-tag-70x20/pipeline/requirements-ocr.txt
/opt/dcr-vault-ocr/.venv-ocr/bin/python /opt/dcr-vault-ocr/dcr-tag-70x20/catalog/import_tcgdex_catalog.py
sudo useradd --system --home-dir /var/lib/dcr-vault-ocr --create-home --shell /usr/sbin/nologin dcr-vault-ocr
sudo install -o root -g root -m 0644 /opt/dcr-vault-ocr/storage-service/dcr-vault-ocr.service /etc/systemd/system/
sudo install -o root -g root -m 0600 /dev/null /etc/dcr-vault-ocr.env
sudoedit /etc/dcr-vault-ocr.env
~~~

Put `DCR_OCR_TOKEN=<64-character random hex secret>` in the environment file, then copy the same value into the Cloudflare Pages secret `ORCL_OCR_TOKEN`. Keep this value out of shell history and source control. `nginx-origin.conf` contains both the `/v1/` media proxy and `/ocr/v1/` OCR proxy; install it only after the `dcr-vault-origin` certificate exists, then run `systemctl daemon-reload`, `systemctl enable --now dcr-vault-ocr.service`, `nginx -t`, and `systemctl reload nginx`. The OCR unit is separate from `dcr-vault-image-store.service` and does not change its port, account, or media directory.

PaddlePaddle 3.2.0 and PaddleOCR 3.7.0 import on ARM64, but native inference can segfault on this architecture. Paddle remains the primary reader; if its subprocess crashes, times out, or returns invalid output, `image_to_label.py` invokes `pipeline/tesseract_reader.py`. The adapter emits the same OCR line schema, then the existing parser detects the printed script and runs the same catalog recovery and lookup. The service passes `--language auto`; the standalone CLI keeps its English default. `/v1/health` reports `tesseractFallbackReady` so a missing system binary is visible. Tesseract is an OCR fallback only; Gemma still runs only when OCR cannot resolve the card.

## Data model and cleanup

D1 stores the opaque object key, MIME type, byte count, SHA-256 digest, and owner/card/side association. A card image is served through the same-origin Pages API, which checks the signed-in owner before requesting a one-use capability. Replacing a side atomically swaps the file. Deleting a side removes its file and D1 row. Do not put scans, keys, session cookies, or service credentials in Git.
