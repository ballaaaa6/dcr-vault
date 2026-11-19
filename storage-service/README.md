# Oracle image store

This small Node service stores private card images on the Oracle VM. Cloudflare Pages Functions authenticate the user's DCR session and issue one-use, 120-second capabilities in D1 for a single card side and operation. The VM consumes each capability by calling `/api/media/authorize`; it does not receive a long-lived application token or the user's DCR session cookie.

Files use opaque IDs under `/srv/dcr-vault-media/<owner-uuid>/<card-uuid>/<side>.<ext>`. The service accepts JPEG, PNG, and WebP files up to 10 MiB, verifies the file signature, and binds only to `127.0.0.1:8788`. Nginx/TLS is the public edge; never expose this Node listener directly.

## Current VM rollout

The OCI instance is Ubuntu 22.04 ARM64 with Node at `/usr/local/bin/node`. The service is installed and enabled as `dcr-vault-image-store.service`, running as the locked `dcr-image-store` account. Its code is root-owned at `/opt/dcr-vault-image-store`; `/srv/dcr-vault-media` is mode `0700` and owned by the service account. It listens only on `127.0.0.1:8788`. The existing PocketDock gateway on port 8787 is unrelated and was left untouched.

The Pages template points `ORCL_MEDIA_ORIGIN` to `https://217.142.238.24`. Nginx is active on IPv4 ports 80 and 443. Port 80 serves only ACME HTTP-01 challenge files and returns 404 for all other paths. Port 443 uses the Let's Encrypt IP certificate and proxies only `/v1/`; all other paths return 404. OCI ingress allows TCP 80/443 from `0.0.0.0/0`; the VM's persistent INPUT rules allow only those two new TCP ports before the existing reject rule. The original rules are backed up at `/etc/iptables/rules.v4.before-dcr-vault-https`. Keep the Node service loopback-only.

Certbot 5.10 from the official Snap publisher is installed, and its automatic renewal timer is enabled. The production certificate `dcr-vault-ip` covers `217.142.238.24` and is valid for 160 hours (until 2026-11-25). Its renewal configuration uses the `shortlived` profile, webroot HTTP-01, and `/usr/local/sbin/dcr-vault-reload-nginx` as the deploy hook. The temporary staging certificate was removed after production issuance.

## Data model and cleanup

D1 stores the opaque object key, MIME type, byte count, SHA-256 digest, and owner/card/side association. A card image is served through the same-origin Pages API, which checks the signed-in owner before requesting a one-use capability. Replacing a side atomically swaps the file. Deleting a side removes its file and D1 row. Do not put scans, keys, session cookies, or service credentials in Git.
