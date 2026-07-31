/* ============================================================
   AI_BranchAttendanceRules - one row per (Branch, Branch Dept)

   Attendance rules used to be keyed on the branch name alone.
   Now that a branch spans several dept rows in tbl_Branch, a
   rule has to be keyed on the PAIR, so Vizag/AU can require
   Bluetooth while Vizag/SDE does not.

   Idempotent. Safe to run more than once.
   Run this BEFORE restarting the rebuilt API.

   IMPORTANT - the fallback rule
   -----------------------------
   A row whose BranchDept is '' is the BRANCH-WIDE FALLBACK: it
   applies to every dept in that branch that has no row of its
   own. Every existing row becomes one, which is why nobody's
   attendance changes the moment this script runs.
   ============================================================ */

SET NOCOUNT ON;

/* ------------------------------------------------------------
   0. Am I in the right database? Compare this against the
      Initial Catalog in the API's appsettings.json.
   ------------------------------------------------------------ */
SELECT DB_NAME() AS ConnectedTo, @@SERVERNAME AS ServerName;
GO

IF OBJECT_ID('dbo.AI_BranchAttendanceRules', 'U') IS NULL
BEGIN
    RAISERROR('AI_BranchAttendanceRules does not exist in this database. You are almost certainly connected to the wrong one - stop here.', 16, 1);
    RETURN;
END
GO

/* ------------------------------------------------------------
   1. BEFORE
   ------------------------------------------------------------ */
SELECT 'BEFORE' AS Stage, * FROM dbo.AI_BranchAttendanceRules ORDER BY Branch;
GO

/* ------------------------------------------------------------
   2. Add the column.
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
                  AND name = 'BranchDept')
BEGIN
    ALTER TABLE dbo.AI_BranchAttendanceRules
        ADD BranchDept NVARCHAR(100) NULL;
    PRINT 'Added column BranchDept.';
END
ELSE
    PRINT 'Column BranchDept already present - skipped.';
GO

/* ------------------------------------------------------------
   3. Backfill.

      NULL and '' must not both be allowed to mean "fallback",
      or the unique index below would let the same fallback rule
      be inserted twice. Normalise every existing row to ''.
   ------------------------------------------------------------ */
UPDATE dbo.AI_BranchAttendanceRules
   SET BranchDept = ''
 WHERE BranchDept IS NULL;

PRINT CONCAT('Normalised ', @@ROWCOUNT, ' row(s) to the branch-wide fallback.');
GO

/* Now that no NULLs remain, make that permanent. */
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
              AND name = 'BranchDept'
              AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.AI_BranchAttendanceRules
        ALTER COLUMN BranchDept NVARCHAR(100) NOT NULL;

    /* Belt and braces: a future INSERT that omits the column
       lands on the fallback instead of erroring. */
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints
                    WHERE parent_object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
                      AND name = 'DF_AI_BranchAttendanceRules_BranchDept')
        ALTER TABLE dbo.AI_BranchAttendanceRules
            ADD CONSTRAINT DF_AI_BranchAttendanceRules_BranchDept
            DEFAULT ('') FOR BranchDept;

    PRINT 'BranchDept is now NOT NULL DEFAULT ''''.';
END
GO

/* ------------------------------------------------------------
   4. Drop any uniqueness keyed on Branch ALONE.

      That is exactly what has to go: it is what would reject
      Vizag/SDE once Vizag/AU exists. Only indexes/constraints
      whose ONLY key column is Branch are touched; the primary
      key on ID is left alone.
   ------------------------------------------------------------ */
DECLARE @ix SYSNAME, @sql NVARCHAR(MAX);

DECLARE ix_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT i.name
      FROM sys.indexes i
     WHERE i.object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
       AND i.is_unique = 1
       AND i.is_primary_key = 0
       AND (SELECT COUNT(*) FROM sys.index_columns ic
             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
               AND ic.is_included_column = 0) = 1
       AND EXISTS (SELECT 1
                     FROM sys.index_columns ic
                     JOIN sys.columns c
                       ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                      AND ic.is_included_column = 0
                      AND c.name = 'Branch');

OPEN ix_cur;
FETCH NEXT FROM ix_cur INTO @ix;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.key_constraints
                WHERE parent_object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
                  AND name = @ix)
        SET @sql = N'ALTER TABLE dbo.AI_BranchAttendanceRules DROP CONSTRAINT ' + QUOTENAME(@ix) + N';';
    ELSE
        SET @sql = N'DROP INDEX ' + QUOTENAME(@ix) + N' ON dbo.AI_BranchAttendanceRules;';

    PRINT 'Dropping branch-only uniqueness: ' + @ix;
    EXEC sp_executesql @sql;

    FETCH NEXT FROM ix_cur INTO @ix;
END
CLOSE ix_cur;
DEALLOCATE ix_cur;
GO

/* ------------------------------------------------------------
   5. Collapse duplicates before adding the new key.

      If two rows already share a branch (and now both carry the
      '' fallback dept), the unique index would fail. Keep the
      most recently updated one and deactivate the rest rather
      than deleting anything.
   ------------------------------------------------------------ */
IF EXISTS (SELECT 1
             FROM dbo.AI_BranchAttendanceRules
            GROUP BY LTRIM(RTRIM(Branch)), LTRIM(RTRIM(BranchDept))
           HAVING COUNT(*) > 1)
BEGIN
    PRINT 'Duplicate (Branch, BranchDept) rows found - keeping the newest of each:';

    SELECT Branch, BranchDept, COUNT(*) AS Copies
      FROM dbo.AI_BranchAttendanceRules
     GROUP BY LTRIM(RTRIM(Branch)), LTRIM(RTRIM(BranchDept)), Branch, BranchDept
    HAVING COUNT(*) > 1;

    ;WITH ranked AS (
        SELECT ID,
               ROW_NUMBER() OVER (
                   PARTITION BY LTRIM(RTRIM(Branch)), LTRIM(RTRIM(BranchDept))
                   ORDER BY ISNULL(UpdatedOn, '1900-01-01') DESC, ID DESC) AS rn
          FROM dbo.AI_BranchAttendanceRules
    )
    DELETE FROM dbo.AI_BranchAttendanceRules
     WHERE ID IN (SELECT ID FROM ranked WHERE rn > 1);

    PRINT CONCAT('Removed ', @@ROWCOUNT, ' duplicate row(s).');
END
ELSE
    PRINT 'No duplicate pairs - nothing to collapse.';
GO

/* ------------------------------------------------------------
   6. The new key: the PAIR is unique, the branch alone is not.
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.AI_BranchAttendanceRules')
                  AND name = 'UX_AI_BranchAttendanceRules_Branch_Dept')
BEGIN
    CREATE UNIQUE INDEX UX_AI_BranchAttendanceRules_Branch_Dept
        ON dbo.AI_BranchAttendanceRules (Branch, BranchDept);
    PRINT 'Created UX_AI_BranchAttendanceRules_Branch_Dept.';
END
ELSE
    PRINT 'UX_AI_BranchAttendanceRules_Branch_Dept already present - skipped.';
GO

/* ------------------------------------------------------------
   7. AFTER - every existing rule is now a branch-wide fallback,
      so behaviour is unchanged until you add a dept row.
   ------------------------------------------------------------ */
SELECT 'AFTER' AS Stage,
       ID, Branch,
       CASE WHEN LTRIM(RTRIM(BranchDept)) = ''
            THEN '(all depts - fallback)'
            ELSE BranchDept END AS BranchDept,
       BT_Required, GPS_Required, IsActive
  FROM dbo.AI_BranchAttendanceRules
 ORDER BY Branch, BranchDept;
GO

/* ------------------------------------------------------------
   8. Sanity check: is any employee left with no rule at all?

      Expected: ZERO rows. If a branch shows up here it had no
      rule before this script either - the migration did not
      cause it.
   ------------------------------------------------------------ */
SELECT DISTINCT
       LTRIM(RTRIM(ISNULL(e.Location1, ''))) AS Branch,
       LTRIM(RTRIM(ISNULL(e.BranchDept, ''))) AS BranchDept
  FROM dbo.Tbl_Employee e
 WHERE LTRIM(RTRIM(ISNULL(e.Location1, ''))) <> ''
   AND NOT EXISTS (
        SELECT 1
          FROM dbo.AI_BranchAttendanceRules r
         WHERE LTRIM(RTRIM(r.Branch)) = LTRIM(RTRIM(e.Location1))
           AND r.IsActive = 1
           AND (LTRIM(RTRIM(r.BranchDept)) = LTRIM(RTRIM(ISNULL(e.BranchDept, '')))
                OR LTRIM(RTRIM(r.BranchDept)) = ''))
 ORDER BY 1, 2;
GO
