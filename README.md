# Coop-MS

**Enterprise Cooperative Management and Accounting System**

Coop-MS is a full-stack enterprise management and accounting software project designed to support the administration, financial record keeping, reporting and operational activities of cooperative societies.

The application combines a React-based web interface, a Node.js and Express backend, Microsoft SQL Server database infrastructure, and real-time communication capabilities.

The system is developed by Adekola Kazeem Ayannuga through The Adekola Labs.

Repository: [theadekola/Coop-MS](https://github.com/theadekola/Coop-MS)

Developer Portfolio: [theadekola.online](https://theadekola.online)

## Project Background

Coop-MS originates from practical experience modernising cooperative administration and financial record-management processes.

The project addresses operational challenges associated with manual records, spreadsheets, fragmented reporting, membership administration and disconnected financial workflows.

The software architecture supports the development of an integrated digital environment for cooperative administration.

## Application Status

This repository contains the Coop-MS application source code, database schema, frontend and backend components, and deployment documentation.

The current repository is packaged for manual deployment and requires further integration and security verification before it should be treated as a production-ready release.

The source repository should not be interpreted as an exact representation of any separately operated cooperative production installation.

## Core Functional Areas

- Staff and administrator management.
- Authentication and role-based access.
- Financial transactions and accounting records.
- Transaction approvals.
- Reports and financial summaries.
- Announcements.
- Internal communication and chat.
- File uploads and document handling.
- Audit-related records.
- Database administration.

Individual functions require end-to-end testing to establish their operational status.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5 |
| State management | Zustand |
| Data visualisation | Recharts |
| Document generation | jsPDF and XLSX |
| Backend | Node.js, Express 4, TypeScript |
| Database | Microsoft SQL Server |
| Authentication | JWT, bcryptjs, OTP |
| Real-time communication | Socket.IO |
| Web server | Nginx |
| Process management | PM2 |
| Deployment | Linux application server and private SQL Server |

## Security and Operational Requirements

Coop-MS handles information that may include staff details, cooperative records and financial transactions.

Production deployments require verified authentication, role-based authorisation, protected document storage, encrypted database connections, secure configuration management, audit logging, backups and tested recovery procedures.

The application should not be deployed with sensitive production data until the identified security and integration issues have been resolved and tested.

## Development and Maintenance

Coop-MS is maintained as a software engineering project demonstrating enterprise application development, relational database design, financial workflow modelling and infrastructure management.

Development priorities include strengthening security, completing frontend-to-backend integration, improving automated testing and validating operational reliability.

## Project Ownership

Developer: Adekola Kazeem Ayannuga

Development Brand: The Adekola Labs

Portfolio: [theadekola.online](https://theadekola.online)

Repository: [theadekola/Coop-MS](https://github.com/theadekola/Coop-MS)

> **Security rollout:** Read the [security policy](SECURITY.md) and [security rollout guide](docs/security-rollout.md), and apply the security migration and restricted runtime role before starting this revision. Public administrator registration and reusable reset keys are retired.

## Repository layout

Top-level files you will find in this project (not exhaustive):

```
README.md                              # This file
oshodi-coop-deployment-guide.md        # Detailed deployment steps and notes
fresh-start-commands.md                # SQL scripts + commands for wiping or clearing operational data
backend/                               # Backend application (Express)
frontend/                              # Frontend application (React + Vite)
backend/src/config/schema.sql          # Initial database schema
backend/src/config/security-v2.sql     # Security migration
SECURITY.md                           # Security policy
docs/security-rollout.md               # Required security deployment and recovery steps
```

See the `oshodi-coop-deployment-guide.md` file for a step-by-step deployment walkthrough.

## Quick start (developer / testing)

1. Clone the repository

```bash
git clone https://github.com/theadekola/Coop-MS.git
cd Coop-MS
```

2. Backend: install dependencies and run locally

```bash
cd backend
cp .env.example .env
# Edit .env to match your local SQL Server and secrets
npm install
npm run dev          # or npm run build && npm start for production-style run
```

3. Frontend: install and run development server

```bash
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173 (or the URL printed by Vite)
```

## Production deployment (summary)

This project is intended to run with the backend on a Linux "app VM" and the MSSQL server on a separate host.

High-level steps (detailed in `oshodi-coop-deployment-guide.md`):

1. Prepare and secure the SQL Server (enable TCP/IP, create a DB user, apply `backend/src/config/schema.sql` and the security migration with the migration operator)
2. Prepare the app VM (Node.js, nginx, pm2)
3. Copy the project to the app VM (example: /opt/oshodi-coop)
4. Configure backend `.env` with database and JWT secrets
5. Install backend dependencies, build (npm run build) and seed initial data (npm run db:seed)
6. Start backend with PM2 (pm2 start ecosystem.config.js --env production)
7. Build frontend (npm run build) and publish the `dist` to `/var/www/oshodi-coop`
8. Configure Nginx to serve the static frontend and proxy `/api` and `/socket.io` to the backend

Example Nginx server block and other step-by-step commands are included in `oshodi-coop-deployment-guide.md`.

## Environment variables (example)

Copy `.env.example` to `.env` and update these values for production:

```dotenv
# Copy to .env and configure privately. Never commit .env.
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://app.example.com

# Database: use your own host and a dedicated application account.
DB_SERVER=localhost
DB_PORT=1433
DB_USER=coop_app
DB_PASSWORD=
DB_NAME=OshodiCoopDB
DB_ENCRYPT=true
DB_TRUST_CERT=false

# Generate independent random secrets privately. Never use example/test secrets.
JWT_SECRET=
DATA_ENCRYPTION_KEY=
# Absolute directory outside the web document root; restrict its OS permissions.
PRIVATE_UPLOAD_DIR=
DOCUMENT_RETENTION_DAYS=90
# Used only by operator migration commands, not by the web service.
MIGRATION_DB_USER=
MIGRATION_DB_PASSWORD=

# Optional initial administrator; no built-in credentials are provided.
INITIAL_ADMIN_EMAIL=
INITIAL_ADMIN_NAME=
INITIAL_ADMIN_PHONE=
INITIAL_ADMIN_PASSWORD=

# Optional email delivery; configure your own provider and sender.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Configure the blank passwords and secrets privately in `backend/.env`; do not leave them empty. Generate independent random JWT and data-encryption keys. `JWT_SECRET` requires at least 32 characters and the API refuses to start without a valid configured key. Use your SQL Server certificate to keep `DB_ENCRYPT=true` and `DB_TRUST_CERT=false`.

For support links, copy `frontend/.env.example` to `frontend/.env` and set `VITE_SUPPORT_EMAIL` to your own support address before building. Support links stay inactive until configured. `VITE_*` values are public in the frontend bundle; never place credentials there.

## Database

- The intended database name is `OshodiCoopDB`.
- The initial schema is `backend/src/config/schema.sql`. Run `npm run db:migrate` for a new database, then `npm run db:security`, using separate migration credentials as described in the [security rollout guide](docs/security-rollout.md).
- The deployment guide includes `sqlcmd` examples for applying schema and running cleanup scripts.

## Seeding and initial admin

Run `npm run db:seed` for initial reference data. There are no built-in admin credentials. To seed an administrator, privately configure `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PHONE` and `INITIAL_ADMIN_PASSWORD` in `backend/.env` before running the seed script.

Public `/api/auth/register-admin` registration is retired. Initial setup uses the one-time seed process with migration credentials; additional administrators require an authenticated super administrator. See the [security rollout guide](docs/security-rollout.md).

## Important backend endpoints

- GET /health                  — health check
- POST /api/auth/login         — login
- POST /api/auth/verify-2fa    — verify 2FA/OTP
- POST /api/auth/register-admin — retired (returns HTTP 410)

The frontend login uses the backend password and authenticator endpoints. Verify the complete flow against the target deployment before production use.

## Operational scripts

- `fresh-start-commands.md` includes SQL and `sqlcmd` examples to clear operational data or perform a full wipe.
- Historical cleanup and full-wipe procedures are retired for populated databases. Preserve financial and audit records; use traceable reversals and the backup and recovery procedures in the [security rollout guide](docs/security-rollout.md).

## Security notes

- CHANGE ALL DEFAULT PASSWORDS AND SECRETS before exposing the system to users.
- Do not use `sa` in production — create a minimal DB user with the required roles.
- Use strong random JWT and data-encryption keys and store them securely.

## Troubleshooting

- If `/api/reports` returns an authentication error, verify the backend is reachable and the DB is seeded.
- Check PM2 status and logs: `pm2 status` and `pm2 logs <process-name>`.
- Verify Nginx configuration with `sudo nginx -t` and reload with `sudo systemctl reload nginx`.

## Contributing

If you plan to contribute, open an issue describing the change you want to make. Keep changes small and focused; update or add tests when possible.

## Licence

Coop-MS is distributed under the [MIT License](LICENSE).

The licence permits use, modification, distribution and commercial reuse subject to its terms.

Copyright © 2026 Adekola Ayannuga.

## Contact

For questions about deployment or operation, refer to the `oshodi-coop-deployment-guide.md` and `fresh-start-commands.md` files in this repo.
