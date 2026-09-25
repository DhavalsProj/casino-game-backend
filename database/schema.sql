IF DB_ID(N'CasinoGameDB') IS NULL
BEGIN
    CREATE DATABASE CasinoGameDB;
END;
GO

USE CasinoGameDB;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        id INT IDENTITY(1,1) NOT NULL,
        name VARCHAR(100) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        type VARCHAR(20) NOT NULL,
        agent_id VARCHAR(10) NULL,
        unique_id VARCHAR(10) NOT NULL,
        password VARCHAR(255) NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT (GETDATE()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated_at DEFAULT (GETDATE()),
        CONSTRAINT PK_users PRIMARY KEY (id),
        CONSTRAINT UQ_users_mobile UNIQUE (mobile),
        CONSTRAINT UQ_users_unique_id UNIQUE (unique_id),
        CONSTRAINT CK_users_type CHECK (type IN ('superadmin', 'agent', 'user'))
    );
END;
GO

IF COL_LENGTH(N'dbo.Users', N'agent_id') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD agent_id VARCHAR(10) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_agent_id' AND object_id = OBJECT_ID(N'dbo.Users'))
BEGIN
    CREATE INDEX IX_Users_agent_id ON dbo.Users(agent_id);
END;
GO

IF OBJECT_ID(N'dbo.SystemCredentials', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SystemCredentials
    (
        id INT IDENTITY(1,1) NOT NULL,
        CredentialName VARCHAR(50) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_system_credentials_is_active DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_system_credentials_created_at DEFAULT (GETDATE()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_system_credentials_updated_at DEFAULT (GETDATE()),
        CONSTRAINT PK_system_credentials PRIMARY KEY (id),
        CONSTRAINT UQ_system_credentials_name UNIQUE (CredentialName)
    );
END;
GO

IF OBJECT_ID(N'dbo.LoginAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LoginAudit
    (
        id BIGINT IDENTITY(1,1) NOT NULL,
        user_id INT NULL,
        unique_id VARCHAR(10) NULL,
        login_type VARCHAR(20) NOT NULL,
        login_status VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_login_audit_created_at DEFAULT (GETDATE()),
        CONSTRAINT PK_login_audit PRIMARY KEY (id),
        CONSTRAINT FK_LoginAudit_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id),
        CONSTRAINT CK_login_audit_login_type CHECK (login_type IN ('NORMAL', 'MASTER')),
        CONSTRAINT CK_login_audit_login_status CHECK (login_status IN ('SUCCESS', 'FAILED'))
    );
END;
GO

IF COL_LENGTH(N'dbo.LoginAudit', N'login_type') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'loginType') IS NOT NULL
BEGIN
    DECLARE @dropLoginAuditChecks NVARCHAR(MAX) = N'';

    SELECT @dropLoginAuditChecks +=
        N'ALTER TABLE dbo.LoginAudit DROP CONSTRAINT ' + QUOTENAME(name) + N';'
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.LoginAudit')
      AND (definition LIKE N'%loginType%' OR definition LIKE N'%loginStatus%');

    IF @dropLoginAuditChecks <> N''
    BEGIN
        EXEC sp_executesql @dropLoginAuditChecks;
    END;
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'user_id') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'userId') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.userId', N'user_id', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'unique_id') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'uniqueId') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.uniqueId', N'unique_id', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'login_type') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'loginType') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.loginType', N'login_type', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'login_status') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'loginStatus') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.loginStatus', N'login_status', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'ip_address') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'ipAddress') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.ipAddress', N'ip_address', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'user_agent') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'userAgent') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.userAgent', N'user_agent', N'COLUMN';
END;

IF COL_LENGTH(N'dbo.LoginAudit', N'created_at') IS NULL
   AND COL_LENGTH(N'dbo.LoginAudit', N'createdAt') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.LoginAudit.createdAt', N'created_at', N'COLUMN';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_login_audit_login_type' AND parent_object_id = OBJECT_ID(N'dbo.LoginAudit'))
BEGIN
    ALTER TABLE dbo.LoginAudit
    ADD CONSTRAINT CK_login_audit_login_type CHECK (login_type IN ('NORMAL', 'MASTER'));
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_login_audit_login_status' AND parent_object_id = OBJECT_ID(N'dbo.LoginAudit'))
BEGIN
    ALTER TABLE dbo.LoginAudit
    ADD CONSTRAINT CK_login_audit_login_status CHECK (login_status IN ('SUCCESS', 'FAILED'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LoginAudit_user_id' AND object_id = OBJECT_ID(N'dbo.LoginAudit'))
BEGIN
    CREATE INDEX IX_LoginAudit_user_id ON dbo.LoginAudit(user_id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LoginAudit_created_at' AND object_id = OBJECT_ID(N'dbo.LoginAudit'))
BEGIN
    CREATE INDEX IX_LoginAudit_created_at ON dbo.LoginAudit(created_at);
END;
GO

-- Add the master credential with a bcrypt hash generated by the application team.
-- Example: INSERT INTO dbo.SystemCredentials (CredentialName, PasswordHash)
-- VALUES ('superadmin', '<bcrypt-hash>');
