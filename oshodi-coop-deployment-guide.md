# Oshodi Coop Deployment Guide

Target setup:

- App VM: `app.example.com`
- MSSQL server: `db.example.com`
- Backend: Node.js/Express on port `5000`
- Frontend: React/Vite static build served by Nginx
- Database: `OshodiCoopDB`

## 1. Prepare SQL Server at `db.example.com`

1. Make sure SQL Server accepts TCP/IP connections on port `1433`.
2. Open firewall port `1433` only to the app VM:

```powershell
New-NetFirewallRule -DisplayName "SQL Server from App VM" -Direction Inbound -Protocol TCP -LocalPort 1433 -RemoteAddress app.example.com -Action Allow
```

3. Create or confirm a SQL login for the application. You can use `sa`, but a dedicated login is safer:

```sql
CREATE LOGIN oshodi_app WITH PASSWORD = 'CHANGE_THIS_STRONG_PASSWORD';
```

4. Copy `backend/src/config/schema.sql` to the SQL server and run it:

```powershell
sqlcmd -S db.example.com -U sa -i schema.sql
```

5. Give the app login access to the new database:

```sql
USE OshodiCoopDB;
CREATE USER oshodi_app FOR LOGIN oshodi_app;
ALTER ROLE db_datareader ADD MEMBER oshodi_app;
ALTER ROLE db_datawriter ADD MEMBER oshodi_app;
ALTER ROLE db_ddladmin ADD MEMBER oshodi_app;
```

## 2. Prepare the app VM at `app.example.com`

These commands assume Ubuntu/Debian Linux.

```bash
sudo apt update
sudo apt install -y curl unzip nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

Open web ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 3. Copy the project to the app VM

From your workstation:

```bash
scp oshodi-coop-full.zip user@app.example.com:/tmp/
```

On the app VM:

```bash
sudo unzip /tmp/oshodi-coop-full.zip -d /opt/
sudo chown -R $USER:$USER /opt/oshodi-coop
cd /opt/oshodi-coop
```

The zip contains an `oshodi-coop` folder, so it should extract to `/opt/oshodi-coop`.

## 4. Configure the backend

```bash
cd /opt/oshodi-coop/backend
cp .env.example .env
nano .env
```

Use values like these:

```env
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

Fill the blank credentials and secrets privately in `backend/.env`; do not deploy with empty values. Generate independent random JWT and OTP secrets. `JWT_SECRET` must have at least 32 characters. Use the SQL Server certificate with `DB_ENCRYPT=true` and `DB_TRUST_CERT=false`.

Install and build:

```bash
npm install
npm run build
mkdir -p logs uploads
```

Seed initial data:

```bash
npm run db:seed
```

There are no built-in admin credentials. Set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PHONE` and `INITIAL_ADMIN_PASSWORD` privately in `backend/.env` before seeding an administrator. Use a unique strong password and remove it from the environment once setup is complete.

## 5. Start backend with PM2

```bash
cd /opt/oshodi-coop/backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`.

Check backend:

```bash
curl http://localhost:5000/health
curl http://app.example.com:5000/health
```

## 6. Build and publish the frontend

```bash
cd /opt/oshodi-coop/frontend
npm install
npm run build
sudo mkdir -p /var/www/oshodi-coop
sudo rsync -a dist/ /var/www/oshodi-coop/
sudo chown -R www-data:www-data /var/www/oshodi-coop
```

## 7. Configure Nginx

Create the site:

```bash
sudo nano /etc/nginx/sites-available/oshodi-coop
```

Paste:

```nginx
server {
    listen 80;
    server_name app.example.com;

    root /var/www/oshodi-coop;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/oshodi-coop /etc/nginx/sites-enabled/oshodi-coop
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Test deployment

From a browser:

```text
http://app.example.com
```

From the app VM:

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/reports
pm2 status
pm2 logs oshodi-coop-api
```

The `/api/reports` route should reject unauthenticated access, which confirms the API is reachable.

## 9. Important notes from the package

- The backend has real login endpoints: `/api/auth/login` and `/api/auth/verify-2fa`.
- The included frontend login page is currently demo-style and does not call those backend endpoints yet.
- Administrator credentials are supplied privately through `INITIAL_ADMIN_*` environment variables; no default login is provided.
- The package has a `db:migrate` script, but no `src/config/migrate.ts` file is included. Use `schema.sql` directly.
- Change all secrets and default passwords before real production use.

The hosts shown above use reserved example domains. Replace them with your own privately managed hosts. Commands omit `-P` so `sqlcmd` prompts for the password; never place live passwords in scripts or shell history.
