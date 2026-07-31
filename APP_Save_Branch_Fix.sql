/* ============================================================
   APP_Save_Branch - allow one branch to have SEVERAL depts.

   Run this on its own if "This branch already has that dept" is still
   coming back when the dept is different. That message means the API is
   current but the stored proc is not - the proc is what actually blocks
   the insert.

   Small and self-contained so there is no chance of a partial run.
   Safe to run repeatedly.
   ============================================================ */

/* ------------------------------------------------------------
   A. BEFORE - what is actually deployed right now?
      Check the database name too: running the setup script against the
      wrong database is the usual reason a "successful" run changes
      nothing.
   ------------------------------------------------------------ */
SELECT DB_NAME() AS ConnectedTo,
       CASE
           WHEN m.definition IS NULL
               THEN 'MISSING - proc does not exist here'
           WHEN m.definition LIKE '%ISNULL(BranchDept%'
               THEN 'NEW - pair check already present'
           ELSE 'OLD - branch-name-only check, this is the problem'
       END AS APP_Save_Branch_Status
  FROM (SELECT 1 AS x) z
  LEFT JOIN sys.sql_modules m
         ON m.object_id = OBJECT_ID('dbo.APP_Save_Branch');
GO

/* ------------------------------------------------------------
   B. Replace it.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Save_Branch', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_Branch;
GO

CREATE PROCEDURE [dbo].[APP_Save_Branch]
    @LID        INT = 0,
    @Branch     NVARCHAR(200),
    @BranchDept NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @LID        = ISNULL(@LID, 0);
    SET @Branch     = LTRIM(RTRIM(ISNULL(@Branch, '')));
    SET @BranchDept = LTRIM(RTRIM(ISNULL(@BranchDept, '')));

    IF @Branch = ''
    BEGIN
        SELECT -1 AS Result;
        RETURN;
    END

    /* Duplicate check. A branch appears on ONE ROW PER DEPT, so the branch
       name alone is not unique - what must be unique is the
       (Branch, BranchDept) pair. Ignore the row being edited. */
    IF EXISTS (SELECT 1
                 FROM tbl_Branch
                WHERE LTRIM(RTRIM(Branch)) = @Branch
                  AND LTRIM(RTRIM(ISNULL(BranchDept, ''))) = @BranchDept
                  AND lid <> @LID)
    BEGIN
        SELECT -2 AS Result;
        RETURN;
    END

    /* ---------- INSERT ---------- */
    IF @LID = 0
    BEGIN
        INSERT INTO tbl_Branch (Branch, BranchDept)
        VALUES (@Branch, NULLIF(@BranchDept, ''));

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS Result;
        RETURN;
    END

    /* ---------- UPDATE ---------- */
    DECLARE @OldName NVARCHAR(200);
    SELECT @OldName = LTRIM(RTRIM(Branch)) FROM tbl_Branch WHERE lid = @LID;

    IF @OldName IS NULL
    BEGIN
        SELECT -1 AS Result;   /* lid does not exist */
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

            UPDATE tbl_Branch
               SET Branch     = @Branch,
                   BranchDept = NULLIF(@BranchDept, '')
             WHERE lid = @LID;

            /* Only cascade a rename onto employees when NO other row still
               carries the old name. Now that one branch spans several dept
               rows, renaming a single row must not drag the employees of the
               sibling rows along with it. */
            IF @OldName <> @Branch
               AND NOT EXISTS (SELECT 1
                                 FROM tbl_Branch
                                WHERE LTRIM(RTRIM(Branch)) = @OldName
                                  AND lid <> @LID)
            BEGIN
                /* employees carry the branch name, not the id */
                UPDATE Tbl_Employee
                   SET Location1 = @Branch
                 WHERE LTRIM(RTRIM(ISNULL(Location1, ''))) = @OldName;

                /* AI attendance branch rules key off the same text */
                IF OBJECT_ID('dbo.AI_BranchAttendanceRules', 'U') IS NOT NULL
                    UPDATE AI_BranchAttendanceRules
                       SET Branch = @Branch
                     WHERE LTRIM(RTRIM(ISNULL(Branch, ''))) = @OldName;
            END

        COMMIT TRANSACTION;

        SELECT @LID AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Result;
    END CATCH
END
GO

/* ------------------------------------------------------------
   C. AFTER - should now say NEW.
   ------------------------------------------------------------ */
SELECT CASE
           WHEN definition LIKE '%ISNULL(BranchDept%'
               THEN 'NEW - pair check present, duplicate depts now allowed'
           ELSE 'STILL OLD - the CREATE above did not take'
       END AS APP_Save_Branch_Status
  FROM sys.sql_modules
 WHERE object_id = OBJECT_ID('dbo.APP_Save_Branch');
GO

/* ------------------------------------------------------------
   D. What is actually in the table - useful if the error persists.
      If you see the pair you are trying to add already listed here,
      the error is correct and the row really is a duplicate.
   ------------------------------------------------------------ */
SELECT lid, Branch, ISNULL(BranchDept, '(none)') AS BranchDept
  FROM tbl_Branch
 ORDER BY Branch, BranchDept;
GO
