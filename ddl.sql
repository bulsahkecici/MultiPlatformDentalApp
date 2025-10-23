IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Email] NVARCHAR(256) NOT NULL UNIQUE,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [Roles] NVARCHAR(255) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- Seed an admin user (password: Admin#123) - hash to be generated externally
-- INSERT INTO dbo.Users (Email, PasswordHash, Roles) VALUES ('admin@example.com', 'bcrypt-hash-here', 'admin');
