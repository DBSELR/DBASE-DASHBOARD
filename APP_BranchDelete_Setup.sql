/* ============================================================
   APP_Delete_Branch - remove one branch/dept row.

   A branch row is not an isolated thing. Employees carry the
   branch NAME, attendance rules key off (Branch, BranchDept),
   and every movement rule names two of these rows. Deleting the
   row without dealing with those leaves rules pointing at a
   branch/dept that no longer exists - invisible rows that still
   affect check-in.

   So this proc:
     - REFUSES while any active employee still sits on that
       branch/dept. Reassign them first; the data decides, not
       a warning dialog anyone can click through.
     - Deletes the movement rules that name the row on either
       side, because a movement to a branch that is gone is not
       a rule, it is a leak.
     - Deletes the attendance rule for that exact pair. The
       branch-wide fallback row (BranchDept = '') is only
       removed when NO other dept row of that branch survives -
       otherwise the siblings would silently lose their default.

   Result codes:  1 = deleted   -1 = no such row   -2 = staff still assigned

   Idempotent. Safe to run more than once.
   ============================================================ */

SET NOCOUNT ON;

/* ------------------------------------------------------------
   0. Am I in the right database?
   ------------------------------------------------------------ */
SELECT DB_NAME() AS ConnectedTo, @@SERVERNAME AS ServerName;
GO

IF OBJECT_ID('dbo.APP_Delete_Branch', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Delete_Branch;
GO

CREATE PROCEDURE [dbo].[APP_Delete_Branch]
    @LID INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Branch NVARCHAR(200), @Dept NVARCHAR(100);

    SELECT @Branch = LTRIM(RTRIM(ISNULL(Branch, ''))),
           @Dept   = LTRIM(RTRIM(ISNULL(BranchDept, '')))
      FROM tbl_Branch
     WHERE lid = @LID;

    IF @Branch IS NULL
    BEGIN
        SELECT -1 AS Result;          /* nothing with that id */
        RETURN;
    END

    /* ---------- the block ----------
       Active staff only. An ex-employee left on a closed branch
       would otherwise make the row undeletable forever. */
    IF EXISTS (SELECT 1
                 FROM Tbl_Employee
                WHERE LTRIM(RTRIM(ISNULL(Location1, ''))) = @Branch
                  AND LTRIM(RTRIM(ISNULL(BranchDept, ''))) = @Dept
                  AND ISNULL(isActive, 'Y') = 'Y')
    BEGIN
        SELECT -2 AS Result;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

            /* Movement rules naming this row on either side. */
            IF OBJECT_ID('dbo.tbl_BranchMovementRules', 'U') IS NOT NULL
                DELETE FROM dbo.tbl_BranchMovementRules
                 WHERE (LTRIM(RTRIM(FromBranch)) = @Branch
                        AND LTRIM(RTRIM(ISNULL(FromDept, ''))) = @Dept)
                    OR (LTRIM(RTRIM(ToBranch)) = @Branch
                        AND LTRIM(RTRIM(ISNULL(ToDept, ''))) = @Dept);

            DELETE FROM tbl_Branch WHERE lid = @LID;

            /* The attendance rule for this exact pair goes with it. */
            IF OBJECT_ID('dbo.AI_BranchAttendanceRules', 'U') IS NOT NULL
            BEGIN
                DELETE FROM dbo.AI_BranchAttendanceRules
                 WHERE LTRIM(RTRIM(ISNULL(Branch, ''))) = @Branch
                   AND LTRIM(RTRIM(ISNULL(BranchDept, ''))) = @Dept
                   AND @Dept <> '';     /* never the fallback by this path */

                /* The branch-wide fallback only dies with the LAST dept row
                   of that branch. Removing it while siblings remain would
                   strip the default out from under them. */
                IF NOT EXISTS (SELECT 1 FROM tbl_Branch
                                WHERE LTRIM(RTRIM(ISNULL(Branch, ''))) = @Branch)
                    DELETE FROM dbo.AI_BranchAttendanceRules
                     WHERE LTRIM(RTRIM(ISNULL(Branch, ''))) = @Branch;
            END

        COMMIT TRANSACTION;

        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Result;
    END CATCH
END
GO

/* ------------------------------------------------------------
   1. Which rows could be deleted right now, and which are held
      by staff. Read-only - deletes nothing.
   ------------------------------------------------------------ */
SELECT b.lid,
       b.Branch,
       ISNULL(b.BranchDept, '') AS BranchDept,
       (SELECT COUNT(*)
          FROM Tbl_Employee e
         WHERE LTRIM(RTRIM(ISNULL(e.Location1, ''))) = LTRIM(RTRIM(ISNULL(b.Branch, '')))
           AND LTRIM(RTRIM(ISNULL(e.BranchDept, ''))) = LTRIM(RTRIM(ISNULL(b.BranchDept, '')))
           AND ISNULL(e.isActive, 'Y') = 'Y') AS ActiveStaff
  FROM tbl_Branch b
 ORDER BY b.Branch, b.BranchDept;
GO
