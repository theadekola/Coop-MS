-- Retired: cooperative financial and audit records must not be wiped.
-- Use isolated disposable databases for development and approved reversals for corrections.
THROW 51001, 'This destructive reset script is retired. Follow SECURITY.md.', 1;
