-- Operator-only SQLCMD template. Supply DatabaseName, BackupFile and
-- BackupCertificate from the approved server's backup configuration.
-- The certificate and its protected private key must already exist in master.
BACKUP DATABASE [$(DatabaseName)] TO DISK = N'$(BackupFile)'
WITH CHECKSUM, COMPRESSION,
 ENCRYPTION (ALGORITHM = AES_256, SERVER CERTIFICATE = [$(BackupCertificate)]);
RESTORE VERIFYONLY FROM DISK = N'$(BackupFile)' WITH CHECKSUM;
-- Schedule a separate restore into an isolated database and validate the
-- corresponding private files, balances, migration version and access controls.
