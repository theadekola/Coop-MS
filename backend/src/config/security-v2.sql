-- Apply to the existing application database using a separate migration identity.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.Staff','TokenVersion') IS NULL ALTER TABLE dbo.Staff ADD TokenVersion INT NOT NULL CONSTRAINT DF_Staff_TokenVersion DEFAULT 0;
IF COL_LENGTH('dbo.Staff','PendingTwoFactorSecret') IS NULL ALTER TABLE dbo.Staff ADD PendingTwoFactorSecret NVARCHAR(200) NULL, PendingTwoFactorExpires DATETIME2 NULL;
IF OBJECT_ID('dbo.AuthSessions') IS NULL CREATE TABLE dbo.AuthSessions (
  SessionID UNIQUEIDENTIFIER PRIMARY KEY,StaffID INT NOT NULL REFERENCES dbo.Staff(StaffID),RefreshHash CHAR(64) NOT NULL UNIQUE,
  TokenVersion INT NOT NULL,ExpiresAt DATETIME2 NOT NULL,RevokedAt DATETIME2 NULL,CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.AuthChallenges') IS NULL CREATE TABLE dbo.AuthChallenges (
  ChallengeID UNIQUEIDENTIFIER PRIMARY KEY,StaffID INT NOT NULL REFERENCES dbo.Staff(StaffID),TokenVersion INT NOT NULL,
  ExpiresAt DATETIME2 NOT NULL,Attempts INT NOT NULL DEFAULT 0,ConsumedAt DATETIME2 NULL);
IF OBJECT_ID('dbo.AuthUsedOtps') IS NULL CREATE TABLE dbo.AuthUsedOtps (
  ID BIGINT IDENTITY PRIMARY KEY,StaffID INT NOT NULL REFERENCES dbo.Staff(StaffID),CodeHash CHAR(64) NOT NULL,ExpiresAt DATETIME2 NOT NULL);
IF OBJECT_ID('dbo.BootstrapState') IS NULL BEGIN
  CREATE TABLE dbo.BootstrapState (ID INT PRIMARY KEY CHECK(ID=1),ConsumedAt DATETIME2 NULL);
  INSERT INTO dbo.BootstrapState VALUES (1,CASE WHEN EXISTS(SELECT 1 FROM dbo.Staff WHERE Role IN ('super_admin','admin')) THEN SYSUTCDATETIME() ELSE NULL END);
END;
IF OBJECT_ID('dbo.PrivateDocuments') IS NULL CREATE TABLE dbo.PrivateDocuments (
  DocumentID INT IDENTITY PRIMARY KEY,OwnerStaffID INT NOT NULL REFERENCES dbo.Staff(StaffID),RoomID INT NULL REFERENCES dbo.ChatRooms(RoomID),
  StorageName NVARCHAR(100) NOT NULL UNIQUE,OriginalName NVARCHAR(200) NOT NULL,ContentType NVARCHAR(100) NOT NULL,
  Size INT NOT NULL CHECK(Size BETWEEN 1 AND 10485760),CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),ExpiresAt DATETIME2 NOT NULL);
IF OBJECT_ID('dbo.DocumentGrants') IS NULL CREATE TABLE dbo.DocumentGrants (
  DocumentID INT NOT NULL REFERENCES dbo.PrivateDocuments(DocumentID),StaffID INT NOT NULL REFERENCES dbo.Staff(StaffID),GrantedByID INT NOT NULL REFERENCES dbo.Staff(StaffID),
  PRIMARY KEY(DocumentID,StaffID));
IF COL_LENGTH('dbo.ChatMessages','DocumentID') IS NULL ALTER TABLE dbo.ChatMessages ADD DocumentID INT NULL REFERENCES dbo.PrivateDocuments(DocumentID);
IF COL_LENGTH('dbo.Transactions','ReversalOfTxnID') IS NULL ALTER TABLE dbo.Transactions ADD ReversalOfTxnID INT NULL REFERENCES dbo.Transactions(TxnID);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Transactions_Reversal') EXEC(N'CREATE UNIQUE INDEX UX_Transactions_Reversal ON dbo.Transactions(ReversalOfTxnID) WHERE ReversalOfTxnID IS NOT NULL AND Status<>''voided'';');
IF OBJECT_ID('dbo.SystemSettings') IS NULL CREATE TABLE dbo.SystemSettings (
  SettingID INT IDENTITY PRIMARY KEY,Scope NVARCHAR(100) NOT NULL UNIQUE,SettingsJson NVARCHAR(MAX) NOT NULL,UpdatedByID INT NULL REFERENCES dbo.Staff(StaffID),UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
COMMIT;
GO
CREATE OR ALTER PROCEDURE dbo.SubmitTransaction
 @ActorID INT,@AccountID INT,@Description NVARCHAR(500),@TxnType NVARCHAR(20),@Amount DECIMAL(18,2),@PaymentMethod NVARCHAR(50),@ChequeNumber NVARCHAR(100)=NULL,@Notes NVARCHAR(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Staff WHERE StaffID=@ActorID AND Status='active' AND Role IN ('super_admin','admin','accountant','cashier')) THROW 51003,'Not authorised',1;
  IF @Amount<=0 OR @TxnType NOT IN ('income','expense') OR LEN(TRIM(@Description))=0 THROW 51001,'Invalid transaction',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.ChartOfAccounts WITH(UPDLOCK,HOLDLOCK) WHERE AccountID=@AccountID AND IsActive=1) THROW 51001,'Inactive account',1;
  DECLARE @Balance DECIMAL(18,2)=(SELECT ISNULL(SUM(DebitAmount-CreditAmount),0) FROM dbo.Transactions WHERE AccountID=@AccountID AND Status='posted');
  DECLARE @Ref NVARCHAR(50)=CONCAT(CASE WHEN @TxnType='expense' THEN 'EXP/' ELSE 'INC/' END,CONVERT(NVARCHAR(36),NEWID()));
  DECLARE @Status NVARCHAR(20)=CASE WHEN @TxnType='expense' THEN 'pending' ELSE 'posted' END;
  IF @Status='posted' SET @Balance=@Balance+@Amount;
  INSERT INTO dbo.Transactions(Reference,Description,AccountID,TxnType,DebitAmount,CreditAmount,Balance,PaymentMethod,ChequeNumber,PostedByID,Notes,Status)
   VALUES(@Ref,@Description,@AccountID,@TxnType,CASE WHEN @TxnType='income' THEN @Amount ELSE 0 END,CASE WHEN @TxnType='expense' THEN @Amount ELSE 0 END,@Balance,@PaymentMethod,@ChequeNumber,@ActorID,@Notes,@Status);
  DECLARE @ID INT=SCOPE_IDENTITY();
  IF @Status='pending' INSERT INTO dbo.Approvals(ItemType,ItemID,ItemDescription,SubmittedByID) VALUES('transaction',@ID,@Description,@ActorID);
  INSERT INTO dbo.AuditLogs(StaffID,ActionType,Module,Description,NewValue) VALUES(@ActorID,'CREATE','Accounts',CONCAT('Transaction ',@ID,' ',@Status),CONCAT(@Ref,' amount=',@Amount));
  COMMIT;
  SELECT @ID AS TxnID,@Ref AS Reference,@Status AS Status,@Balance AS Balance;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.RequestReversal @ActorID INT,@TxnID INT,@Reason NVARCHAR(500)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Staff WHERE StaffID=@ActorID AND Status='active' AND Role IN ('super_admin','admin','accountant')) THROW 51003,'Not authorised',1;
  IF LEN(TRIM(@Reason))=0 THROW 51001,'Reason required',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Transactions WITH(UPDLOCK,HOLDLOCK) WHERE TxnID=@TxnID AND Status='posted' AND ReversalOfTxnID IS NULL)
    OR EXISTS(SELECT 1 FROM dbo.Transactions WITH(UPDLOCK,HOLDLOCK) WHERE ReversalOfTxnID=@TxnID AND Status<>'voided') THROW 51001,'Cannot reverse transaction',1;
  DECLARE @Ref NVARCHAR(50)=CONCAT('REV/',CONVERT(NVARCHAR(36),NEWID()));
  INSERT INTO dbo.Transactions(Reference,Description,AccountID,TxnType,DebitAmount,CreditAmount,Balance,PaymentMethod,PostedByID,Notes,Status,ReversalOfTxnID)
    SELECT @Ref,CONCAT('Reversal: ',LEFT(@Reason,480)),AccountID,CASE WHEN TxnType='income' THEN 'expense' ELSE 'income' END,CreditAmount,DebitAmount,Balance,PaymentMethod,@ActorID,@Reason,'pending',TxnID
    FROM dbo.Transactions WHERE TxnID=@TxnID;
  DECLARE @ID INT=SCOPE_IDENTITY();
  INSERT INTO dbo.Approvals(ItemType,ItemID,ItemDescription,SubmittedByID) VALUES('transaction',@ID,CONCAT('Reversal of ',@TxnID,': ',LEFT(@Reason,450)),@ActorID);
  INSERT INTO dbo.AuditLogs(StaffID,ActionType,Module,Description,NewValue) VALUES(@ActorID,'CREATE','Accounts',CONCAT('Reversal requested for ',@TxnID),CONCAT('Reversal transaction ',@ID,': ',@Reason));
  COMMIT; SELECT @ID AS TxnID,@Ref AS Reference,'pending' AS Status;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ReviewApproval @ActorID INT,@ApprovalID INT,@Decision NVARCHAR(20),@Comments NVARCHAR(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Staff WHERE StaffID=@ActorID AND Status='active' AND Role IN ('super_admin','admin','manager')) THROW 51003,'Not authorised',1;
  IF @Decision NOT IN ('approved','rejected') THROW 51001,'Invalid decision',1;
  DECLARE @Submitter INT,@ItemID INT,@Type NVARCHAR(50),@Status NVARCHAR(20);
  SELECT @Submitter=SubmittedByID,@ItemID=ItemID,@Type=ItemType,@Status=Status FROM dbo.Approvals WITH(UPDLOCK,HOLDLOCK) WHERE ApprovalID=@ApprovalID;
  IF @Status IS NULL OR @Status<>'pending' THROW 51001,'Approval is not pending',1;
  IF @Submitter=@ActorID THROW 51003,'Independent approval required',1;
  IF @Type='transaction'
  BEGIN
    DECLARE @AccountID INT=(SELECT AccountID FROM dbo.Transactions WHERE TxnID=@ItemID AND Status='pending');
    IF @AccountID IS NULL THROW 51001,'Transaction is not pending',1;
    IF NOT EXISTS(SELECT 1 FROM dbo.ChartOfAccounts WITH(UPDLOCK,HOLDLOCK) WHERE AccountID=@AccountID AND IsActive=1) THROW 51001,'Inactive account',1;
    DECLARE @Balance DECIMAL(18,2)=(SELECT ISNULL(SUM(DebitAmount-CreditAmount),0) FROM dbo.Transactions WHERE AccountID=@AccountID AND Status='posted');
    UPDATE dbo.Transactions SET Status=CASE WHEN @Decision='approved' THEN 'posted' ELSE 'voided' END,ApprovedByID=@ActorID,
      Balance=CASE WHEN @Decision='approved' THEN @Balance+DebitAmount-CreditAmount ELSE Balance END,UpdatedAt=SYSUTCDATETIME()
      WHERE TxnID=@ItemID AND Status='pending' AND PostedByID<>@ActorID;
    IF @@ROWCOUNT<>1 THROW 51003,'Independent approval required',1;
  END;
  UPDATE dbo.Approvals SET Status=@Decision,Comments=@Comments,ReviewedByID=@ActorID,ReviewedAt=SYSUTCDATETIME() WHERE ApprovalID=@ApprovalID;
  INSERT INTO dbo.AuditLogs(StaffID,ActionType,Module,Description,NewValue) VALUES(@ActorID,'UPDATE','Management',CONCAT('Approval ',@ApprovalID,' ',@Decision),CONCAT(@Type,' ',@ItemID,': ',@Comments));
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO
CREATE OR ALTER TRIGGER dbo.Transactions_ImmutablePosted ON dbo.Transactions AFTER UPDATE,DELETE AS
BEGIN
 IF EXISTS(SELECT 1 FROM deleted WHERE Status='posted') THROW 51001,'Posted records are immutable. Request a traceable reversal.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.AuditLogs_AppendOnly ON dbo.AuditLogs AFTER UPDATE,DELETE AS
BEGIN
 THROW 51001,'Audit records are append-only. Archive with the operator retention procedure.',1;
END;
GO
