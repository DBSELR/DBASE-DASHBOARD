/* ============================================================
   APP_Save_Location
   Insert / rename a branch in tbl_Location (lid, Location).

   Returns a single scalar in the first column:
        > 0  -> success (the lid of the inserted / updated row)
        -1   -> branch name was blank
        -2   -> duplicate branch name

   IMPORTANT: Tbl_Employee.Location1 stores the branch NAME as text,
   not the lid, so a rename has to cascade or every employee on that
   branch is silently orphaned (their Location dropdown comes up blank
   on the next edit). Same for AI_BranchAttendanceRules.Branch.
   ============================================================ */
IF OBJECT_ID('dbo.APP_Save_Location', 'P') IS NOT NULL
    DROP PROCEDURE dbo.APP_Save_Location;
GO

CREATE PROCEDURE [dbo].[APP_Save_Location]
    @LID      INT = 0,
    @Location VARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SET @LID      = ISNULL(@LID, 0);
    SET @Location = LTRIM(RTRIM(ISNULL(@Location, '')));

    IF @Location = ''
    BEGIN
        SELECT -1 AS Result;
        RETURN;
    END

    /* duplicate check - ignore the row currently being edited */
    IF EXISTS (SELECT 1
                 FROM tbl_Location
                WHERE LTRIM(RTRIM(Location)) = @Location
                  AND lid <> @LID)
    BEGIN
        SELECT -2 AS Result;
        RETURN;
    END

    /* ---------- INSERT ---------- */
    IF @LID = 0
    BEGIN
        INSERT INTO tbl_Location (Location) VALUES (@Location);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS Result;
        RETURN;
    END

    /* ---------- RENAME ---------- */
    DECLARE @OldName VARCHAR(200);
    SELECT @OldName = LTRIM(RTRIM(Location)) FROM tbl_Location WHERE lid = @LID;

    IF @OldName IS NULL
    BEGIN
        SELECT -1 AS Result;   /* lid does not exist */
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

            UPDATE tbl_Location
               SET Location = @Location
             WHERE lid = @LID;

            IF @OldName <> @Location
            BEGIN
                /* employees carry the branch name, not the id */
                UPDATE Tbl_Employee
                   SET Location1 = @Location
                 WHERE LTRIM(RTRIM(ISNULL(Location1, ''))) = @OldName;

                /* AI attendance branch rules key off the same text */
                IF OBJECT_ID('dbo.AI_BranchAttendanceRules', 'U') IS NOT NULL
                    UPDATE AI_BranchAttendanceRules
                       SET Branch = @Location
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
