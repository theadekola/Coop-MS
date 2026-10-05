# Coop-MS (Oshodi Coop Management System)

Complete Management System software for cooperative societies — backend API, web frontend, and SQL schema. This repository contains the application source, deployment instructions and operational scripts used to install and run the Oshodi Coop system in a small self-hosted environment.

Status: packaged for manual deployment. Change all default secrets and passwords before production use.

## Key features

- User and staff management (admin seeding included)
- Transactions, reports, approvals and announcements
- Two-factor auth (OTP) endpoints supported by the backend
- File uploads (uploads directory)
- PM2-based process management for production Node.js backend

## Stack

- Language: JavaScript/TypeScript (Node.js) for backend, React + Vite for frontend
- Backend: Node.js + Express
- Database: Microsoft SQL Server (MSSQL)
- Frontend: React (Vite) static build served by Nginx

## Repository layout

Top-level files you will find in this project (not exhaustive):

```
README.md                              # This file
oshodi-coop-deployment-guide.md        # Detailed deployment steps and notes
fresh-start-commands.md                # SQL scripts + commands for wiping or clearing operational data
backend/                               # Backend application (Express)
frontend/                              # Frontend application (React + Vite)
schema/ or backend/src/config/schema.sql? # Database schema SQL used to create the DB
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

1. Prepare and secure the SQL Server (enable TCP/IP, create a DB user, run schema.sql)
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

```
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://app.example.com

DB_SERVER=db.example.com
DB_PORT=1433
DB_USER=oshodi_app
DB_PASSWORD=
DB_NAME=OshodiCoopDB
DB_ENCRYPT=true
DB_TRUST_CERT=false

JWT_SECRET=
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

OTP_SECRET=
OTP_EXPIRY_MINUTES=10

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Configure the blank passwords and secrets privately in `backend/.env`; do not leave them empty. Generate independent random JWT and OTP secrets. `JWT_SECRET` requires at least 32 characters and the API refuses to start without a valid configured key. Use your SQL Server certificate to keep `DB_ENCRYPT=true` and `DB_TRUST_CERT=false`.

For support links, copy `frontend/.env.example` to `frontend/.env` and set `VITE_SUPPORT_EMAIL` to your own support address before building. Support links stay inactive until configured. `VITE_*` values are public in the frontend bundle; never place credentials there.

## Database

- The intended database name is `OshodiCoopDB`.
- Apply the schema SQL (e.g. `schema.sql` from `backend/src/config/` or `schema/`) on the SQL Server instance before running the app.
- The deployment guide includes `sqlcmd` examples for applying schema and running cleanup scripts.

## Seeding and initial admin

Run `npm run db:seed` for initial reference data. There are no built-in admin credentials. To seed an administrator, privately configure `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PHONE` and `INITIAL_ADMIN_PASSWORD` in `backend/.env` before running the seed script.

After a full wipe you must recreate the first admin via the backend `/api/auth/register-admin` endpoint.

## Important backend endpoints

- GET /health                  — health check
- POST /api/auth/login         — login
- POST /api/auth/verify-2fa    — verify 2FA/OTP
- POST /api/auth/register-admin — create first admin (used after a full wipe)

Note: the frontend login page included in the package is currently demo-style and may not call the backend endpoints automatically; use API endpoints directly for testing.

## Operational scripts

- `fresh-start-commands.md` includes SQL and `sqlcmd` examples to clear operational data or perform a full wipe.
- Use the "Safe Fresh Start" to clear transactions, reports, approvals, announcements, chats, OTPs and audit logs while preserving users and configuration.
- Use the "Full Wipe" only when you want to remove everything and recreate the first admin.

## Security notes

- CHANGE ALL DEFAULT PASSWORDS AND SECRETS before exposing the system to users.
- Do not use `sa` in production — create a minimal DB user with the required roles.
- Use strong random values for JWT and OTP secrets and store them securely.

## Troubleshooting

- If `/api/reports` returns an authentication error, verify the backend is reachable and the DB is seeded.
- Check PM2 status and logs: `pm2 status` and `pm2 logs <process-name>`.
- Verify Nginx configuration with `sudo nginx -t` and reload with `sudo systemctl reload nginx`.

## Contributing

If you plan to contribute, open an issue describing the change you want to make. Keep changes small and focused; update or add tests when possible.

## License

Specify a license for the project (e.g. MIT) in a LICENSE file.

## Contact

For questions about deployment or operation, refer to the `oshodi-coop-deployment-guide.md` and `fresh-start-commands.md` files in this repo.
