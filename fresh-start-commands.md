> **Retired procedure:** These historic reset commands must not be run against cooperative records. Read [SECURITY.md](SECURITY.md) for setup, migration and recovery. Both destructive reset SQL scripts now refuse execution.

# Fresh Start Commands

Use these commands after uploading the updated `backend` and `frontend` folders to `/opt/oshodi-coop`.

## Safe Fresh Start

This clears transactions, reports, approvals, announcements, chats, OTPs, password reset tokens and audit logs. It keeps staff/users, departments and chart of accounts so you can still log in.

```bash
scp /opt/oshodi-coop/backend/src/config/clear-operational-data.sql mssql@db.example.com:/tmp/clear-operational-data.sql
```

On the MSSQL server:

```bash
sqlcmd -S db.example.com -U sa -d OshodiCoopDB -i /tmp/clear-operational-data.sql
```

## Full Wipe

This removes everything, including staff/users and base setup tables. Use it only when you are ready to recreate the first admin.

```bash
scp /opt/oshodi-coop/backend/src/config/fresh-start-full-wipe.sql mssql@db.example.com:/tmp/fresh-start-full-wipe.sql
```

On the MSSQL server:

```bash
sqlcmd -S db.example.com -U sa -d OshodiCoopDB -i /tmp/fresh-start-full-wipe.sql
```

After a full wipe, run this on the app VM:

```bash
cd /opt/oshodi-coop/backend
npm install
npm run db:migrate
npm run db:seed
```

Then create your first admin through the backend `/api/auth/register-admin` endpoint before logging in.

The hosts shown above use reserved example domains. Replace them with your own privately managed hosts. Commands omit `-P` so `sqlcmd` prompts for the password; never place live passwords in scripts or shell history.
