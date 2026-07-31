/* ============================================================
   tbl_BranchMovementRules - check-in time when a person moves
   from one branch/dept to another on duty.

   One row per ORDERED pair:
       (FromBranch, FromDept)  ->  (ToBranch, ToDept)

   Vizag/SDE -> Vizag/AU is a different rule from
   Vizag/AU -> Vizag/SDE. Direction matters, so both are stored
   separately and neither is derived from the other.

   THE BLANK RULE
   --------------
   A pair with NO row here means "actual in-time from profile":
   the employee's own InTime on their profile applies, unchanged.
   That is the default for every one of the 40-odd combinations,
   which is why the table starts empty and only ever holds the
   exceptions you actually set - like Eluru/DBS -> Vizag/AU 11:00.

   Clearing a time on screen DELETES the row rather than storing
   a blank, so "no row" and "use profile" can never drift apart
   and mean two different things.

   Idempotent. Safe to run more than once.
   ============================================================ */

SET NOCOUNT ON;

/* ------------------------------------------------------------
   0. Am I in the right database? Compare this against the
      Initial Catalog in the API's appsettings.json.
   ------------------------------------------------------------ */
SELECT DB_NAME() AS ConnectedTo, @@SERVERNAME AS ServerName;
GO

/* ------------------------------------------------------------
   0b. Migrate an earlier run.

       The table shipped first as AI_BranchMovementRules. If that
       one is here, RENAME it - do not let step 1 create a fresh
       empty tbl_* alongside it, which would leave every rule
       already saved sitting in a table nothing reads any more.

       The index and the constraints keep their old AI_ names
       through a table rename, so they are renamed too. Cosmetic,
       but a PK called PK_AI_* on a tbl_* table is the kind of
       thing that misleads whoever reads this schema next.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.AI_BranchMovementRules', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NULL
BEGIN
    EXEC sp_rename N'dbo.AI_BranchMovementRules', N'tbl_BranchMovementRules';

    IF EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.tbl_BranchMovementRules')
                  AND name = 'UX_AI_BranchMovementRules_Pair')
        EXEC sp_rename N'dbo.tbl_BranchMovementRules.UX_AI_BranchMovementRules_Pair',
                       N'UX_tbl_BranchMovementRules_Pair', N'INDEX';

    IF OBJECT_ID('dbo.PK_AI_BranchMovementRules') IS NOT NULL
        EXEC sp_rename N'dbo.PK_AI_BranchMovementRules', N'PK_tbl_BranchMovementRules', N'OBJECT';

    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_FromDept') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_FromDept', N'DF_tbl_BranchMovementRules_FromDept', N'OBJECT';
    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_ToDept') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_ToDept', N'DF_tbl_BranchMovementRules_ToDept', N'OBJECT';
    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_InTime') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_InTime', N'DF_tbl_BranchMovementRules_InTime', N'OBJECT';
    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_IsActive') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_IsActive', N'DF_tbl_BranchMovementRules_IsActive', N'OBJECT';
    IF OBJECT_ID('dbo.DF_AI_BranchMovementRules_CreatedOn') IS NOT NULL
        EXEC sp_rename N'dbo.DF_AI_BranchMovementRules_CreatedOn', N'DF_tbl_BranchMovementRules_CreatedOn', N'OBJECT';

    PRINT 'Renamed AI_BranchMovementRules -> tbl_BranchMovementRules (rules preserved).';
END
ELSE IF OBJECT_ID('dbo.AI_BranchMovementRules', 'U') IS NOT NULL
    PRINT 'WARNING: both AI_BranchMovementRules and tbl_BranchMovementRules exist. Left alone - move the rows across by hand, then drop the AI_ one.';
GO

/* ------------------------------------------------------------
   1. The table.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_BranchMovementRules
    (
        ID          INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_tbl_BranchMovementRules PRIMARY KEY,
        FromBranch  NVARCHAR(200) NOT NULL,
        FromDept    NVARCHAR(100) NOT NULL
            CONSTRAINT DF_tbl_BranchMovementRules_FromDept DEFAULT (''),
        ToBranch    NVARCHAR(200) NOT NULL,
        ToDept      NVARCHAR(100) NOT NULL
            CONSTRAINT DF_tbl_BranchMovementRules_ToDept   DEFAULT (''),

        /* 'HH:mm'. Held as text, not TIME, to match tbl_employee.InTime -
           the column this value stands in for. Mixing the two types would
           mean a conversion on every comparison later. */
        InTime      NVARCHAR(10)  NOT NULL
            CONSTRAINT DF_tbl_BranchMovementRules_InTime   DEFAULT (''),

        IsActive    BIT NOT NULL
            CONSTRAINT DF_tbl_BranchMovementRules_IsActive DEFAULT (1),
        CreatedBy   NVARCHAR(100) NULL,
        CreatedOn   DATETIME NOT NULL
            CONSTRAINT DF_tbl_BranchMovementRules_CreatedOn DEFAULT (GETDATE()),
        UpdatedOn   DATETIME NULL
    );
    PRINT 'Created table tbl_BranchMovementRules.';
END
ELSE
    PRINT 'Table tbl_BranchMovementRules already present - skipped.';
GO

/* ------------------------------------------------------------
   2. One rule per ordered pair.

      Without this, two saves of the same movement would leave
      two rows and the screen would have no way to say which one
      check-in should honour.
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.tbl_BranchMovementRules')
                  AND name = 'UX_tbl_BranchMovementRules_Pair')
BEGIN
    /* Collapse anything already duplicated, newest wins, before the
       index refuses to be created. */
    ;WITH ranked AS (
        SELECT ID,
               ROW_NUMBER() OVER (
                   PARTITION BY LTRIM(RTRIM(FromBranch)), LTRIM(RTRIM(FromDept)),
                                LTRIM(RTRIM(ToBranch)),   LTRIM(RTRIM(ToDept))
                   ORDER BY ISNULL(UpdatedOn, CreatedOn) DESC, ID DESC) AS rn
          FROM dbo.tbl_BranchMovementRules
    )
    DELETE FROM dbo.tbl_BranchMovementRules
     WHERE ID IN (SELECT ID FROM ranked WHERE rn > 1);

    CREATE UNIQUE INDEX UX_tbl_BranchMovementRules_Pair
        ON dbo.tbl_BranchMovementRules (FromBranch, FromDept, ToBranch, ToDept);
    PRINT 'Created UX_tbl_BranchMovementRules_Pair.';
END
ELSE
    PRINT 'UX_tbl_BranchMovementRules_Pair already present - skipped.';
GO

/* ------------------------------------------------------------
   3. Load.

      Returns ONLY the pairs that carry an override. The screen
      generates every combination itself from tbl_Branch, so
      sending 40 empty rows over the wire would be waste.

      Read positionally by the frontend, same as APP_Load_Branch:
         [0]=ID  [1]=FromBranch  [2]=FromDept
         [3]=ToBranch  [4]=ToDept  [5]=InTime
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Load_BranchMovement', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Load_BranchMovement;
GO

CREATE PROCEDURE [dbo].[APP_Load_BranchMovement]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ID,
           LTRIM(RTRIM(FromBranch))          AS FromBranch,
           LTRIM(RTRIM(ISNULL(FromDept,''))) AS FromDept,
           LTRIM(RTRIM(ToBranch))            AS ToBranch,
           LTRIM(RTRIM(ISNULL(ToDept,'')))   AS ToDept,
           LTRIM(RTRIM(ISNULL(InTime,'')))   AS InTime
      FROM dbo.tbl_BranchMovementRules
     WHERE IsActive = 1
       AND LTRIM(RTRIM(ISNULL(InTime,''))) <> ''
     ORDER BY FromBranch, FromDept, ToBranch, ToDept;
END
GO

/* ------------------------------------------------------------
   4. Save.

      @InTime = ''  ->  DELETE the row. Blank means "back to the
      employee's profile in-time", and the cleanest way to say
      that is for no row to exist.

      Result codes:  1 = saved   2 = cleared   -1 = bad input
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Save_BranchMovement', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_BranchMovement;
GO

CREATE PROCEDURE [dbo].[APP_Save_BranchMovement]
    @FromBranch NVARCHAR(200),
    @FromDept   NVARCHAR(100) = NULL,
    @ToBranch   NVARCHAR(200),
    @ToDept     NVARCHAR(100) = NULL,
    @InTime     NVARCHAR(10)  = NULL,
    @CreatedBy  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @FromBranch = LTRIM(RTRIM(ISNULL(@FromBranch, '')));
    SET @FromDept   = LTRIM(RTRIM(ISNULL(@FromDept,   '')));
    SET @ToBranch   = LTRIM(RTRIM(ISNULL(@ToBranch,   '')));
    SET @ToDept     = LTRIM(RTRIM(ISNULL(@ToDept,     '')));
    SET @InTime     = LTRIM(RTRIM(ISNULL(@InTime,     '')));

    IF @FromBranch = '' OR @ToBranch = ''
    BEGIN
        SELECT -1 AS Result;
        RETURN;
    END

    /* A pair pointing at itself is not a movement. Silently ignoring it
       would look like a save that did nothing, so say so. */
    IF @FromBranch = @ToBranch AND @FromDept = @ToDept
    BEGIN
        SELECT -1 AS Result;
        RETURN;
    END

    IF @InTime = ''
    BEGIN
        DELETE FROM dbo.tbl_BranchMovementRules
         WHERE LTRIM(RTRIM(FromBranch))          = @FromBranch
           AND LTRIM(RTRIM(ISNULL(FromDept,''))) = @FromDept
           AND LTRIM(RTRIM(ToBranch))            = @ToBranch
           AND LTRIM(RTRIM(ISNULL(ToDept,'')))   = @ToDept;

        SELECT 2 AS Result;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.tbl_BranchMovementRules
                WHERE LTRIM(RTRIM(FromBranch))          = @FromBranch
                  AND LTRIM(RTRIM(ISNULL(FromDept,''))) = @FromDept
                  AND LTRIM(RTRIM(ToBranch))            = @ToBranch
                  AND LTRIM(RTRIM(ISNULL(ToDept,'')))   = @ToDept)
        UPDATE dbo.tbl_BranchMovementRules
           SET InTime    = @InTime,
               IsActive  = 1,
               UpdatedOn = GETDATE()
         WHERE LTRIM(RTRIM(FromBranch))          = @FromBranch
           AND LTRIM(RTRIM(ISNULL(FromDept,''))) = @FromDept
           AND LTRIM(RTRIM(ToBranch))            = @ToBranch
           AND LTRIM(RTRIM(ISNULL(ToDept,'')))   = @ToDept;
    ELSE
        INSERT INTO dbo.tbl_BranchMovementRules
              (FromBranch, FromDept, ToBranch, ToDept, InTime, CreatedBy)
        VALUES (@FromBranch, @FromDept, @ToBranch, @ToDept, @InTime, @CreatedBy);

    SELECT 1 AS Result;
END
GO

/* ------------------------------------------------------------
   5. What is stored right now. Empty on a first run - that is
      correct, every movement is on profile in-time until you
      set one.
   ------------------------------------------------------------ */
SELECT ID,
       FromBranch + ' / ' + CASE WHEN FromDept = '' THEN '(all depts)' ELSE FromDept END AS MovingFrom,
       ToBranch   + ' / ' + CASE WHEN ToDept   = '' THEN '(all depts)' ELSE ToDept   END AS MovingTo,
       InTime, IsActive
  FROM dbo.tbl_BranchMovementRules
 ORDER BY FromBranch, FromDept, ToBranch, ToDept;
GO

/* ------------------------------------------------------------
   6. How many combinations the screen will show, so you can
      check it against what you see.
   ------------------------------------------------------------ */
DECLARE @pairs INT =
    (SELECT COUNT(*) FROM (SELECT DISTINCT LTRIM(RTRIM(Branch)) AS B,
                                  LTRIM(RTRIM(ISNULL(BranchDept,''))) AS D
                             FROM tbl_Branch
                            WHERE Branch IS NOT NULL
                              AND LTRIM(RTRIM(Branch)) <> '') x);

PRINT CONCAT('Branch/dept rows: ', @pairs,
             '  ->  movement combinations on screen: ', @pairs * (@pairs - 1));
GO
