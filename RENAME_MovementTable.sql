/* ============================================================
   Rename  AI_BranchMovementRules  ->  tbl_BranchMovementRules

   RUN THE WHOLE FILE. Open it in SSMS and press F5 with NOTHING
   selected. Do not highlight a few lines and run those - an
   IF/BEGIN block cut short is what produces
       Msg 102 ... Incorrect syntax near 'tbl_BranchMovementRules'
   The statement is fine; the batch was just missing its END.

   Safe to run more than once, and safe to run if you never
   created the old table at all - it prints what it did and
   changes nothing it should not.
   ============================================================ */

SET NOCOUNT ON;

SELECT DB_NAME() AS ConnectedTo, @@SERVERNAME AS ServerName;
GO


/* ---------- 1. the table itself ---------- */
IF OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NOT NULL
    PRINT '1. tbl_BranchMovementRules already exists - no rename needed.';
ELSE IF OBJECT_ID('dbo.AI_BranchMovementRules', 'U') IS NULL
    PRINT '1. Neither table exists yet. Nothing to rename - run APP_BranchMovement_Setup.sql to create it.';
ELSE
BEGIN
    EXEC sp_rename N'dbo.AI_BranchMovementRules', N'tbl_BranchMovementRules';
    PRINT '1. Renamed AI_BranchMovementRules -> tbl_BranchMovementRules. Rows kept.';
END
GO


/* ---------- 2. the index and constraints ----------
   A table rename leaves these carrying their old AI_ names.
   Purely cosmetic, but a PK called PK_AI_* sitting on a tbl_*
   table misleads the next person to read this schema.
   Separate batch, because it has to run after the rename above
   has actually taken effect.                                   */
IF OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.tbl_BranchMovementRules')
                  AND name = 'UX_AI_BranchMovementRules_Pair')
        EXEC sp_rename N'dbo.tbl_BranchMovementRules.UX_AI_BranchMovementRules_Pair',
                       N'UX_tbl_BranchMovementRules_Pair', N'INDEX';

    IF OBJECT_ID('dbo.PK_AI_BranchMovementRules') IS NOT NULL
        EXEC sp_rename N'dbo.PK_AI_BranchMovementRules',
                       N'PK_tbl_BranchMovementRules', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_FromDept') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_FromDept',
                       N'DF_tbl_BranchMovementRules_FromDept', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_ToDept') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_ToDept',
                       N'DF_tbl_BranchMovementRules_ToDept', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_InTime') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_InTime',
                       N'DF_tbl_BranchMovementRules_InTime', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_IsActive') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_IsActive',
                       N'DF_tbl_BranchMovementRules_IsActive', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_CreatedOn') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_CreatedOn',
                       N'DF_tbl_BranchMovementRules_CreatedOn', N'OBJECT';

    PRINT '2. Index and constraint names brought in line.';
END
ELSE
    PRINT '2. Skipped - no tbl_BranchMovementRules to work on.';
GO


/* ---------- 3. show me the result ---------- */
SELECT name AS TableName, create_date
  FROM sys.tables
 WHERE name IN ('AI_BranchMovementRules', 'tbl_BranchMovementRules');

IF OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NOT NULL
    SELECT * FROM dbo.tbl_BranchMovementRules;
GO
