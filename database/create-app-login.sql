USE master;
GO

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'casino_app')
BEGIN
    ALTER LOGIN casino_app
    WITH PASSWORD = N'Superadmin@123!!';
END;
ELSE
BEGIN
    CREATE LOGIN casino_app
    WITH PASSWORD = N'Superadmin@123!!', CHECK_POLICY = ON;
END
GO

USE [CasinoGameDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'casino_app')
BEGIN
    CREATE USER casino_app FOR LOGIN casino_app;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    INNER JOIN sys.database_principals role_principal
        ON role_principal.principal_id = rm.role_principal_id
    INNER JOIN sys.database_principals user_principal
        ON user_principal.principal_id = rm.member_principal_id
    WHERE role_principal.name = N'db_datareader'
      AND user_principal.name = N'casino_app'
)
BEGIN
    ALTER ROLE db_datareader ADD MEMBER casino_app;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    INNER JOIN sys.database_principals role_principal
        ON role_principal.principal_id = rm.role_principal_id
    INNER JOIN sys.database_principals user_principal
        ON user_principal.principal_id = rm.member_principal_id
    WHERE role_principal.name = N'db_datawriter'
      AND user_principal.name = N'casino_app'
)
BEGIN
    ALTER ROLE db_datawriter ADD MEMBER casino_app;
END;
GO