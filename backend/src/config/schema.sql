-- ============================================================
-- OSHODI ISOLO EXCEL COOPERATIVE - DATABASE SCHEMA
-- Database: OshodiCoopDB
-- ============================================================

USE master;
GO
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'OshodiCoopDB')
    CREATE DATABASE OshodiCoopDB;
GO
USE OshodiCoopDB;
GO

-- ============================================================
-- STAFF & AUTH
-- ============================================================
CREATE TABLE Departments (
    DeptID        INT IDENTITY(1,1) PRIMARY KEY,
    DeptName      NVARCHAR(100)  NOT NULL UNIQUE,
    DeptHead      INT            NULL,
    Description   NVARCHAR(500)  NULL,
    CreatedAt     DATETIME2      DEFAULT GETDATE(),
    UpdatedAt     DATETIME2      DEFAULT GETDATE()
);

CREATE TABLE Staff (
    StaffID           INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeID        NVARCHAR(20)   NOT NULL UNIQUE,
    FullName          NVARCHAR(200)  NOT NULL,
    Email             NVARCHAR(200)  NOT NULL UNIQUE,
    Phone             NVARCHAR(20)   NOT NULL,
    PasswordHash      NVARCHAR(500)  NOT NULL,
    PasswordResetKeyHash NVARCHAR(500) NULL,
    Role              NVARCHAR(50)   NOT NULL CHECK (Role IN ('super_admin','admin','accountant','auditor','cashier','loan_officer','manager','staff')),
    DeptID            INT            NULL REFERENCES Departments(DeptID),
    Status            NVARCHAR(20)   NOT NULL DEFAULT 'active' CHECK (Status IN ('active','inactive','on_leave','suspended')),
    PhotoPath         NVARCHAR(500)  NULL,
    JoinedDate        DATE           NOT NULL DEFAULT GETDATE(),
    LastLogin         DATETIME2      NULL,
    TwoFactorEnabled  BIT            NOT NULL DEFAULT 0,
    TwoFactorSecret   NVARCHAR(200)  NULL,
    RefreshToken      NVARCHAR(500)  NULL,
    CreatedAt         DATETIME2      DEFAULT GETDATE(),
    UpdatedAt         DATETIME2      DEFAULT GETDATE()
);

CREATE TABLE OTPTokens (
    TokenID     INT IDENTITY(1,1) PRIMARY KEY,
    StaffID     INT            NOT NULL REFERENCES Staff(StaffID),
    OTPCode     NVARCHAR(10)   NOT NULL,
    ExpiresAt   DATETIME2      NOT NULL,
    IsUsed      BIT            NOT NULL DEFAULT 0,
    CreatedAt   DATETIME2      DEFAULT GETDATE()
);

CREATE TABLE PasswordResets (
    ResetID     INT IDENTITY(1,1) PRIMARY KEY,
    StaffID     INT            NOT NULL REFERENCES Staff(StaffID),
    Token       NVARCHAR(200)  NOT NULL UNIQUE,
    ExpiresAt   DATETIME2      NOT NULL,
    IsUsed      BIT            NOT NULL DEFAULT 0,
    CreatedAt   DATETIME2      DEFAULT GETDATE()
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
CREATE TABLE AccountTypes (
    TypeID      INT IDENTITY(1,1) PRIMARY KEY,
    TypeName    NVARCHAR(50)   NOT NULL UNIQUE,
    NormalBal   NVARCHAR(10)   NOT NULL CHECK (NormalBal IN ('debit','credit'))
);

CREATE TABLE ChartOfAccounts (
    AccountID   INT IDENTITY(1,1) PRIMARY KEY,
    AccountCode NVARCHAR(20)   NOT NULL UNIQUE,
    AccountName NVARCHAR(200)  NOT NULL,
    TypeID      INT            NOT NULL REFERENCES AccountTypes(TypeID),
    ParentID    INT            NULL REFERENCES ChartOfAccounts(AccountID),
    IsActive    BIT            NOT NULL DEFAULT 1,
    Description NVARCHAR(500)  NULL,
    CreatedAt   DATETIME2      DEFAULT GETDATE(),
    UpdatedAt   DATETIME2      DEFAULT GETDATE()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE Transactions (
    TxnID           INT IDENTITY(1,1) PRIMARY KEY,
    Reference       NVARCHAR(50)   NOT NULL UNIQUE,
    TxnDate         DATE           NOT NULL DEFAULT GETDATE(),
    Description     NVARCHAR(500)  NOT NULL,
    AccountID       INT            NOT NULL REFERENCES ChartOfAccounts(AccountID),
    TxnType         NVARCHAR(20)   NOT NULL CHECK (TxnType IN ('income','expense','transfer')),
    DebitAmount     DECIMAL(18,2)  NULL DEFAULT 0,
    CreditAmount    DECIMAL(18,2)  NULL DEFAULT 0,
    Balance         DECIMAL(18,2)  NOT NULL,
    PaymentMethod   NVARCHAR(50)   NOT NULL,
    ChequeNumber    NVARCHAR(100)  NULL,
    PostedByID      INT            NOT NULL REFERENCES Staff(StaffID),
    ApprovedByID    INT            NULL REFERENCES Staff(StaffID),
    Status          NVARCHAR(20)   NOT NULL DEFAULT 'posted' CHECK (Status IN ('draft','pending','posted','voided')),
    Notes           NVARCHAR(1000) NULL,
    CreatedAt       DATETIME2      DEFAULT GETDATE(),
    UpdatedAt       DATETIME2      DEFAULT GETDATE()
);

-- ============================================================
-- TRADING ACCOUNT
-- ============================================================
CREATE TABLE TradingEntries (
    EntryID         INT IDENTITY(1,1) PRIMARY KEY,
    FinancialYear   INT            NOT NULL,
    EntryType       NVARCHAR(50)   NOT NULL,
    Description     NVARCHAR(500)  NOT NULL,
    Amount          DECIMAL(18,2)  NOT NULL,
    EntryDate       DATE           NOT NULL,
    PostedByID      INT            NOT NULL REFERENCES Staff(StaffID),
    CreatedAt       DATETIME2      DEFAULT GETDATE()
);

-- ============================================================
-- APPROVALS
-- ============================================================
CREATE TABLE Approvals (
    ApprovalID      INT IDENTITY(1,1) PRIMARY KEY,
    ItemType        NVARCHAR(50)   NOT NULL,
    ItemID          INT            NOT NULL,
    ItemDescription NVARCHAR(500)  NOT NULL,
    SubmittedByID   INT            NOT NULL REFERENCES Staff(StaffID),
    ReviewedByID    INT            NULL REFERENCES Staff(StaffID),
    Status          NVARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','approved','rejected')),
    Comments        NVARCHAR(1000) NULL,
    SubmittedAt     DATETIME2      DEFAULT GETDATE(),
    ReviewedAt      DATETIME2      NULL
);

-- ============================================================
-- CHAT
-- ============================================================
CREATE TABLE ChatRooms (
    RoomID      INT IDENTITY(1,1) PRIMARY KEY,
    RoomName    NVARCHAR(200)  NOT NULL,
    RoomType    NVARCHAR(20)   NOT NULL CHECK (RoomType IN ('direct','group','channel')),
    CreatedByID INT            NOT NULL REFERENCES Staff(StaffID),
    CreatedAt   DATETIME2      DEFAULT GETDATE()
);

CREATE TABLE ChatRoomMembers (
    MemberID    INT IDENTITY(1,1) PRIMARY KEY,
    RoomID      INT            NOT NULL REFERENCES ChatRooms(RoomID),
    StaffID     INT            NOT NULL REFERENCES Staff(StaffID),
    JoinedAt    DATETIME2      DEFAULT GETDATE(),
    UNIQUE (RoomID, StaffID)
);

CREATE TABLE ChatMessages (
    MessageID   INT IDENTITY(1,1) PRIMARY KEY,
    RoomID      INT            NOT NULL REFERENCES ChatRooms(RoomID),
    SenderID    INT            NOT NULL REFERENCES Staff(StaffID),
    Content     NVARCHAR(MAX)  NULL,
    MessageType NVARCHAR(20)   NOT NULL DEFAULT 'text' CHECK (MessageType IN ('text','file','image')),
    FilePath    NVARCHAR(500)  NULL,
    FileName    NVARCHAR(200)  NULL,
    FileSize    INT            NULL,
    IsDeleted   BIT            NOT NULL DEFAULT 0,
    SentAt      DATETIME2      DEFAULT GETDATE()
);

CREATE TABLE MessageReadReceipts (
    ReceiptID   INT IDENTITY(1,1) PRIMARY KEY,
    MessageID   INT            NOT NULL REFERENCES ChatMessages(MessageID),
    StaffID     INT            NOT NULL REFERENCES Staff(StaffID),
    ReadAt      DATETIME2      DEFAULT GETDATE(),
    UNIQUE (MessageID, StaffID)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE Reports (
    ReportID        INT IDENTITY(1,1) PRIMARY KEY,
    ReportName      NVARCHAR(200)  NOT NULL,
    ReportType      NVARCHAR(100)  NOT NULL,
    Category        NVARCHAR(50)   NOT NULL,
    DateFrom        DATE           NOT NULL,
    DateTo          DATE           NOT NULL,
    FilePath        NVARCHAR(500)  NULL,
    Format          NVARCHAR(10)   NOT NULL CHECK (Format IN ('PDF','Excel')),
    GeneratedByID   INT            NOT NULL REFERENCES Staff(StaffID),
    GeneratedAt     DATETIME2      DEFAULT GETDATE(),
    Status          NVARCHAR(20)   NOT NULL DEFAULT 'generated',
    DownloadCount   INT            NOT NULL DEFAULT 0
);

CREATE TABLE ScheduledReports (
    ScheduleID      INT IDENTITY(1,1) PRIMARY KEY,
    ReportName      NVARCHAR(200)  NOT NULL,
    ReportType      NVARCHAR(100)  NOT NULL,
    Frequency       NVARCHAR(50)   NOT NULL,
    CronExpression  NVARCHAR(100)  NOT NULL,
    IsActive        BIT            NOT NULL DEFAULT 1,
    LastRun         DATETIME2      NULL,
    NextRun         DATETIME2      NULL,
    CreatedByID     INT            NOT NULL REFERENCES Staff(StaffID),
    CreatedAt       DATETIME2      DEFAULT GETDATE()
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE Announcements (
    AnnouncementID  INT IDENTITY(1,1) PRIMARY KEY,
    Title           NVARCHAR(300)  NOT NULL,
    Content         NVARCHAR(MAX)  NOT NULL,
    Category        NVARCHAR(50)   NOT NULL,
    PublishedByID   INT            NOT NULL REFERENCES Staff(StaffID),
    IsActive        BIT            NOT NULL DEFAULT 1,
    PublishedAt     DATETIME2      DEFAULT GETDATE(),
    ExpiresAt       DATETIME2      NULL
);

-- ============================================================
-- AUDIT TRAIL
-- ============================================================
CREATE TABLE AuditLogs (
    LogID           INT IDENTITY(1,1) PRIMARY KEY,
    StaffID         INT            NOT NULL REFERENCES Staff(StaffID),
    ActionType      NVARCHAR(20)   NOT NULL CHECK (ActionType IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT')),
    Module          NVARCHAR(100)  NOT NULL,
    Description     NVARCHAR(1000) NOT NULL,
    OldValue        NVARCHAR(MAX)  NULL,
    NewValue        NVARCHAR(MAX)  NULL,
    IPAddress       NVARCHAR(50)   NULL,
    UserAgent       NVARCHAR(500)  NULL,
    CreatedAt       DATETIME2      DEFAULT GETDATE()
);
GO

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IX_Staff_Email ON Staff(Email);
CREATE INDEX IX_Staff_Role ON Staff(Role);
CREATE INDEX IX_Staff_Status ON Staff(Status);
CREATE INDEX IX_Transactions_Date ON Transactions(TxnDate);
CREATE INDEX IX_Transactions_Type ON Transactions(TxnType);
CREATE INDEX IX_Transactions_AccountID ON Transactions(AccountID);
CREATE INDEX IX_AuditLogs_StaffID ON AuditLogs(StaffID);
CREATE INDEX IX_AuditLogs_CreatedAt ON AuditLogs(CreatedAt);
CREATE INDEX IX_ChatMessages_RoomID ON ChatMessages(RoomID);
CREATE INDEX IX_ChatMessages_SentAt ON ChatMessages(SentAt);
GO
