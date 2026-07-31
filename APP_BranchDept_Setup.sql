/* ============================================================
   BRANCH DEPT SETUP
   Run this whole script once in SSMS against the DBASE database.

   Assumes you have ALREADY run:
       ALTER TABLE tbl_Location ADD BranchDept nvarchar(20);
       EXEC sp_rename 'dbo.tbl_Location.location', 'Branch', 'COLUMN';
       EXEC sp_rename 'dbo.APP_Load_Location', 'APP_Load_Branch';
       EXEC sp_rename 'dbo.tbl_Location', 'tbl_Branch';

   so the table is now tbl_Branch (lid, Branch, BranchDept) and the load
   proc is called APP_Load_Branch.

   >>> IMPORTANT <<<
   sp_rename renames an object but does NOT touch any code that refers to
   it, so APP_Load_Branch still reads
   "select lid, Location from tbl_Location" - and both halves of that are
   now wrong. Every screen with the Branch dropdown is broken until
   step 1 runs. Run this script before testing anything.

   (sp_rename on a proc also leaves the old name baked into
   sys.sql_modules, which is why step 1 drops and recreates rather than
   ALTERing.)

   This script:
     1. APP_Load_Branch        - rewritten for the rename, now returns
                                 (lid, Branch, BranchDept)
     2. APP_Save_Branch        - insert / update a branch + its dept,
                                 with rename cascade. A branch may have
                                 SEVERAL depts: one row per (Branch,
                                 BranchDept) pair, and that pair is what is
                                 unique.
     3. APP_Load_BranchDept    - distinct BranchDept values, feeds the
                                 Branch Dept dropdown on Employee Profile
     4. Tbl_Employee.BranchDept - nvarchar(100) NULL, stores the NAME
     5. APP_Save_EmpBranchDept - writes the employee's branch dept

   The API routes were renamed to match: Sources/Load_Location ->
   Sources/Load_Branch and Sources/Save_Location -> Sources/Save_Branch.
   Nothing outside this app calls them, and the frontend was updated in the
   same pass, so there is no old route left to keep alive.
   ============================================================ */

SET NOCOUNT ON;
GO

/* ------------------------------------------------------------
   0. Optional - nvarchar(20) is tight for a department name
      ("Human Resources" is 15, "Quality Assurance" is 17).
      Uncomment to widen it. The rest of this script works either way.
   ------------------------------------------------------------ */
-- ALTER TABLE dbo.tbl_Branch ALTER COLUMN BranchDept NVARCHAR(100) NULL;
-- GO

/* ------------------------------------------------------------
   1. Load branches - FIXES THE BREAKAGE FROM sp_rename
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Load_Branch', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Load_Branch;
GO
/* in case the rename had not been run yet on this database */
IF OBJECT_ID('dbo.APP_Load_Location', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Load_Location;
GO

CREATE PROCEDURE [dbo].[APP_Load_Branch]
AS
BEGIN
    SET NOCOUNT ON;
    /* Column order matters - the frontend reads this result positionally:
       [0]=lid  [1]=Branch  [2]=BranchDept */
    SELECT lid,
           Branch,
           ISNULL(BranchDept, '') AS BranchDept
      FROM tbl_Branch
     ORDER BY lid;
END
GO

/* ------------------------------------------------------------
   2. Save branch (insert / update name + dept)

      Returns a single scalar in the first column:
          > 0  -> success (the lid of the inserted / updated row)
          -1   -> branch name was blank, or the lid does not exist
          -2   -> duplicate branch name

      Tbl_Employee.Location1 stores the branch NAME as text, not the lid,
      so a rename has to cascade or every employee on that branch is
      silently orphaned. Same for AI_BranchAttendanceRules.Branch.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Save_Branch', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_Branch;
GO
/* the earlier draft of this proc, if it was ever deployed */
IF OBJECT_ID('dbo.APP_Save_Location', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_Location;
GO

CREATE PROCEDURE [dbo].[APP_Save_Branch]
    @LID        INT = 0,
    @Branch     NVARCHAR(200),
    @BranchDept NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @LID        = ISNULL(@LID, 0);
    SET @Branch   = LTRIM(RTRIM(ISNULL(@Branch, '')));
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
   3. Distinct branch depts - feeds the Branch Dept dropdown on the
      Employee Profile screen.

      Returned as (rownum, BranchDept) so the shape matches every other
      lookup the frontend consumes: [0] = id, [1] = name.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Load_BranchDept', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Load_BranchDept;
GO

CREATE PROCEDURE [dbo].[APP_Load_BranchDept]
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH d AS (
        SELECT DISTINCT LTRIM(RTRIM(BranchDept)) AS BranchDept
          FROM tbl_Branch
         WHERE BranchDept IS NOT NULL
           AND LTRIM(RTRIM(BranchDept)) <> ''
    )
    SELECT CAST(ROW_NUMBER() OVER (ORDER BY BranchDept) AS INT) AS BDID,
           BranchDept
      FROM d
     ORDER BY BranchDept;
END
GO

/* ------------------------------------------------------------
   4. Employee column (appended at the end of Tbl_Employee)
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1
                 FROM sys.columns
                WHERE object_id = OBJECT_ID('dbo.Tbl_Employee')
                  AND name = 'BranchDept')
BEGIN
    ALTER TABLE dbo.Tbl_Employee ADD BranchDept NVARCHAR(100) NULL;
    PRINT 'Added Tbl_Employee.BranchDept';
END
ELSE
    PRINT 'Tbl_Employee.BranchDept already exists - left alone';
GO

/* ------------------------------------------------------------
   5. Employee branch-dept write.
      Called by EmployeeController.EmployeeRegistration right after
      APP_Save_Empdetails, on the same connection.

      WHY a separate proc instead of a 41st parameter on
      APP_Save_Empdetails: that proc is called from several places and
      adding a parameter there makes SQL throw "Procedure or function
      has too many arguments specified" for every caller that has not
      been updated in lockstep.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.APP_Save_EmpBranchDept', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_EmpBranchDept;
GO

CREATE PROCEDURE [dbo].[APP_Save_EmpBranchDept]
    @Ecode      VARCHAR(50),
    @BranchDept NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @Ecode      = LTRIM(RTRIM(ISNULL(@Ecode, '')));
    SET @BranchDept = LTRIM(RTRIM(ISNULL(@BranchDept, '')));

    IF @Ecode = ''
        RETURN;

    UPDATE Tbl_Employee
       SET BranchDept = NULLIF(@BranchDept, '')
     WHERE EmpCode = @Ecode;
END
GO

/* ------------------------------------------------------------
   6. AFTER RUNNING THIS - two things to check.

   (a) Anything else still using the old table or column name.
       The renames do NOT update procs/views/functions, so run:

           SELECT OBJECT_NAME(object_id) AS ObjName, definition
             FROM sys.sql_modules
            WHERE definition LIKE '%tbl_Location%'
               OR definition LIKE '%tbl_Branch%';

       Anything in that list that still says tbl_Location, or selects a
       column called Location from this table, needs the same treatment
       the two procs above just got. Those objects are broken RIGHT NOW -
       SQL Server does not validate them until they run.
       (The C# code never queries this table directly - only stored
       procs do - so this list is the whole surface.)

   (b) How the employee read-back works:

           EXEC sp_helptext 'APP_Get_Employee';

       If it says   SELECT * FROM Tbl_Employee ...
           -> nothing to do, BranchDept comes back automatically.

       If it lists columns explicitly
           -> add  , BranchDept  at the END of that SELECT list. The end
              matters: the frontend reads the result positionally.

       The Employee Profile screen degrades safely either way - if the
       column is not in the result the dropdown just comes up blank and
       the user re-picks it. Saving always works regardless.
   ------------------------------------------------------------ */
