/*
  Full fresh start.
  This removes all records, including staff users and base setup tables.
  Run schema.sql and seed.ts again after this, then create your first admin with /admin/register.
*/

USE OshodiCoopDB;
GO

SET NOCOUNT ON;

DELETE FROM MessageReadReceipts;
DELETE FROM ChatMessages;
DELETE FROM ChatRoomMembers;
DELETE FROM ChatRooms;

DELETE FROM ScheduledReports;
DELETE FROM Reports;
DELETE FROM Announcements;
DELETE FROM Approvals;
DELETE FROM TradingEntries;
DELETE FROM Transactions;
DELETE FROM OTPTokens;
DELETE FROM PasswordResets;
DELETE FROM AuditLogs;

UPDATE ChartOfAccounts SET ParentID = NULL;
DELETE FROM ChartOfAccounts;
DELETE FROM AccountTypes;
DELETE FROM Staff;
DELETE FROM Departments;

DBCC CHECKIDENT ('MessageReadReceipts', RESEED, 0);
DBCC CHECKIDENT ('ChatMessages', RESEED, 0);
DBCC CHECKIDENT ('ChatRoomMembers', RESEED, 0);
DBCC CHECKIDENT ('ChatRooms', RESEED, 0);
DBCC CHECKIDENT ('ScheduledReports', RESEED, 0);
DBCC CHECKIDENT ('Reports', RESEED, 0);
DBCC CHECKIDENT ('Announcements', RESEED, 0);
DBCC CHECKIDENT ('Approvals', RESEED, 0);
DBCC CHECKIDENT ('TradingEntries', RESEED, 0);
DBCC CHECKIDENT ('Transactions', RESEED, 0);
DBCC CHECKIDENT ('OTPTokens', RESEED, 0);
DBCC CHECKIDENT ('PasswordResets', RESEED, 0);
DBCC CHECKIDENT ('AuditLogs', RESEED, 0);
DBCC CHECKIDENT ('ChartOfAccounts', RESEED, 0);
DBCC CHECKIDENT ('AccountTypes', RESEED, 0);
DBCC CHECKIDENT ('Staff', RESEED, 0);
DBCC CHECKIDENT ('Departments', RESEED, 0);

PRINT 'Full wipe complete. Run schema/seed and create a new admin before login.';
