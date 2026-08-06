USE OshodiCoopDB;
GO

IF COL_LENGTH('Transactions', 'ChequeNumber') IS NULL
BEGIN
  ALTER TABLE Transactions ADD ChequeNumber NVARCHAR(100) NULL;
  PRINT 'ChequeNumber column added to Transactions.';
END
ELSE
BEGIN
  PRINT 'ChequeNumber column already exists.';
END
GO
