-- Run once only if class_sessions was created from the previous schema.sql.
ALTER TABLE class_sessions ADD COLUMN language TEXT NOT NULL DEFAULT 'zh';
