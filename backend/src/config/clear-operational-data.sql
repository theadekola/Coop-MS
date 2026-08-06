/*
  Clears operational records so the system starts empty.
  Keeps Staff, Departments, AccountTypes and ChartOfAccounts so users can still log in
  and post real transactions after cleanup.
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

DBCC CHECKIDENT ('MessageReadReceipts', RESEED, 0);
DBCC CHECKIDENT ('ChatMessages', RESEED, 0);
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

PRINT 'Operational data cleared. Staff, departments, account types and chart of accounts were kept.';
