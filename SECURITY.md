# Application security and rollout

Every expense requires approval by a different active super administrator,
administrator or manager. A submitter cannot approve their own expense, even
if they hold an administrative role. Pending and rejected entries do not affect
posted balances. Posted records cannot be updated or deleted; corrections use
an independently approved compensating reversal linked to the original entry.
Transfers are rejected until a balanced transfer workflow is implemented.
The existing cashbook is not a complete double-entry general ledger.

Chat authentication and active room membership are enforced on the server for
joins, message creation, receipts and typing. Delivery rechecks recipient
membership and session validity rather than trusting previously joined socket
rooms. Presence tracks multiple connections. One server instance is supported;
do not run multiple workers until a shared event limiter and session adapter
have been introduced and tested.

Documents are stored outside the web root with random names. Downloads require
an active authenticated session and ownership, an explicit grant, or membership
of the document's associated room. Administrative status alone does not grant
access to every document. Uploads accept PDF, PNG and JPEG signatures, MIME types
and matching extensions, with a 10 MB limit. Downloads use attachments and
private/no-store caching. Signature validation is not malware scanning: add an
operator-managed scanner before accepting documents from untrusted parties.
Legacy `/uploads` URLs are deliberately unavailable. Review each legacy file's
owner and permissions before importing it through the protected endpoint.

Access tokens expire after 15 minutes. Server-side sessions support revocation;
refresh cookies are HttpOnly, SameSite=Strict, secure in production, expire after
seven days and rotate on use. Refresh requests must originate from the configured
application origin. Password/role/status changes invalidate existing sessions.
Current roles and active status are read from the database, not trusted from JWT
claims. Existing tokens issued before this migration are rejected. Public
administrator registration and reusable password-reset keys are retired.

Authenticator setup requires a current password and code confirmation. Login
requires a password-verified, five-minute challenge; each challenge allows five
attempts. Reused codes are rejected for five minutes. Authenticator secrets and
saved settings use AES-256-GCM with a separate deployment key. Keep that key in
the secret manager and back it up independently from the database.

## Required deployment steps

1. Take and verify an encrypted backup of the database and private files. Stop
   writers and record the deployed commit and migration version.
2. As a separate migration operator, run `npm run db:security` in `backend` with
   `MIGRATION_DB_USER`, `MIGRATION_DB_PASSWORD`, and the database connection
   configuration. For a new installation, run `db:migrate` once first. Never run
   the old full-wipe scripts against a populated cooperative database.
3. Run the protected-data migration described below. Then apply
   `backend/src/config/runtime-permissions.sql`. Remove old `db_owner`,
   `db_datawriter`, schema-control and server-role memberships from the runtime
   identity, and add only that dedicated identity to `coop_runtime`. Review
   inherited grants: the role script alone cannot remove grants from other roles.
4. For initial installation only, run `npm run db:seed` as the migration operator
   with the four `INITIAL_ADMIN_*` values. The persistent bootstrap flag and a
   transaction prevent a second bootstrap. Remove bootstrap credentials from the
   deployment environment after use. Additional administrators require an active
   super administrator using the authenticated staff workflow.
5. Configure `.env` privately. `JWT_SECRET` must contain at least 32 random
   characters; `DATA_ENCRYPTION_KEY` must contain 32 independently generated
   random bytes in hexadecimal. Configure an absolute `PRIVATE_UPLOAD_DIR`
   outside public/dist/uploads directories. Grant filesystem access only to the
   dedicated service identity and backup operator. On Windows configure NTFS
   ACLs explicitly; POSIX file modes do not configure Windows ACLs.
6. Production requires HTTPS, SQL TLS with certificate verification, and an
   application database identity with no schema or ledger-modification privileges.
   Startup rejects missing migration objects and excessive database permissions.
   The service must not receive migration credentials.
7. Serve the frontend and API on the same origin. Apply the proxy headers in
   `deploy/security-headers.conf`, remove any legacy upload aliases, and forward
   WebSocket upgrades. CSP permits Google Fonts and inline styles required by
   the current React layout, while restricting scripts to the application origin.
   The HTML meta policy supplements, but does not replace, the response header's
   frame-ancestors protection. Inspect browser CSP violations in staging.
8. Run the SQL integration suite and browser acceptance checks against staging
   before enabling production traffic. Do not treat a TypeScript build or a
   mocked socket test as verification of the production database or file ACLs.

## Existing protected data

`npm run db:encrypt` encrypts existing plaintext settings and authenticator
secrets without disabling two-factor authentication. Run it with the migration
identity and the final encryption key before restarting existing accounts.
Keep the encryption key stable across subsequent deployments. Legacy reusable
reset hashes, refresh tokens and plaintext OTP records are retired by this
command. It is idempotent and does not output secret values. Existing integration
credentials in retired settings must also be revoked at their providers; removing
the UI does not revoke an external credential.

## Backup, recovery and retention

The web application does not create or restore SQL backups. Schedule encrypted
SQL Server backups using a separate backup identity and matching encrypted
private-storage snapshots. Use checksums, verify backup integrity, retain the
backup certificate and encryption keys separately, and restore to an isolated
database regularly. Record backup timestamps, checksums, restore duration and
the last recovered transaction to measure the operator's chosen RPO/RTO.
`deploy/backup.sql` is an operator template; it must be configured and executed
against the intended server. `RESTORE VERIFYONLY` does not replace a restore drill.

On failure, stop writers, preserve the failed database and audit evidence, restore
the database and matching files into a separate instance, validate balances and
access controls, and only then switch traffic. Rolling back to the former server
code would restore known vulnerabilities and cannot use the new session format.

Document downloads expire after `DOCUMENT_RETENTION_DAYS` (default 90). Set this
to the cooperative's approved retention policy before enabling uploads. Expiry
denies access but does not silently delete files or financial records. An operator
must review expired files, legal holds and backup retention before physical
purging. Audit records are append-only: archive them through a controlled,
reviewed DBA process with integrity verification, not through a web delete button.
Private authenticated API responses are never cached by the service worker; the old API cache is removed on startup and logout.

Expire used authentication challenges and session metadata through the same
operator maintenance process; their expiration is enforced even before cleanup.

## Validation

`npm test` in `backend` builds and exercises input validation, encrypted-data
integrity, HTTP access denial, upload validation, CSP headers and socket access
controls including revocation and multiple sessions. `npm run test:sql` requires
`TEST_DB_NAME` ending in `_Test` plus `TEST_DB_SERVER`, `TEST_DB_USER` and
`TEST_DB_PASSWORD`. It refuses to modify an existing database. It creates a
restricted runtime identity, applies the security migration twice and exercises
independent/concurrent approvals, immutable entries, reversals, audit preservation,
SQL permissions, chat ACLs and session revocation. CI runs this against a disposable
SQL Server service; no deployment credentials are used.

`npm run test:browser` in `frontend` tests the built application in Chromium under CSP, its password-to-authenticator flow and retirement of the private API cache. These browser tests stub API responses; the separate SQL suite checks database behaviour.

Browser acceptance: password and authenticator login; wrong/reused/expired code;
revoked session; self-profile role changes rejected; outsider chat and file access
denied; real file upload/download; expense remains pending until another reviewer
approves; repeated approval rejected; posted balances and approved reversal;
frontend renders without blocked scripts under the proxy CSP. Browser security,
backup restoration, filesystem ACLs and live database permission checks remain
deployment acceptance requirements.
