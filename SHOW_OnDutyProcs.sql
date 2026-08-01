/* ============================================================
   Show me what I need to wire the On-duty Type column.

   Run the whole file (F5, nothing selected) and send back the
   results. Read-only - changes nothing.

   I need the two proc bodies because ALTERing a procedure means
   rewriting it whole; guessing at the body of a proc I have not
   seen is how you lose a working save path.
   ============================================================ */

SET NOCOUNT ON;

/* 1. The table behind the on-duty rows, and its columns. */
SELECT c.name AS ColumnName,
       t.name AS DataType,
       c.max_length,
       c.is_nullable
  FROM sys.columns c
  JOIN sys.types   t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.tbl_OnDuties')
 ORDER BY c.column_id;

/* If the query above returned nothing, the table is named
   something else. This finds it: */
SELECT name FROM sys.tables
 WHERE name LIKE '%Dut%' OR name LIKE '%OnDut%'
 ORDER BY name;
GO

/* 2. The two procedure bodies, in full. */
SELECT m.definition
  FROM sys.sql_modules m
 WHERE m.object_id = OBJECT_ID('dbo.App_Save_On_Duties');

SELECT m.definition
  FROM sys.sql_modules m
 WHERE m.object_id = OBJECT_ID('dbo.App_Get_Duties');
GO
