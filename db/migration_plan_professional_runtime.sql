-- Normalizza i piani esistenti nella nomenclatura corrente.
UPDATE users SET plan='professional' WHERE LOWER(TRIM(plan))='pro';
UPDATE users SET plan='base' WHERE plan IS NULL OR TRIM(plan)='' OR LOWER(TRIM(plan)) IN ('free','starter');
UPDATE users SET plan=LOWER(TRIM(plan)) WHERE LOWER(TRIM(plan)) IN ('base','professional','agency');
UPDATE users SET plan='base' WHERE LOWER(TRIM(plan)) NOT IN ('base','professional','agency');
