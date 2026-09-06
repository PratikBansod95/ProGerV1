-- ProGer seed data
-- Run after 001_initial.sql and after creating auth users in Supabase dashboard

-- Default checklist templates
INSERT INTO checklist_templates (task_type, label, sort_order) VALUES
  ('development', 'Test cases written', 1),
  ('development', 'QA passed', 2),
  ('development', 'Edge cases reviewed', 3),
  ('development', 'Code reviewed', 4),
  ('design', 'Stakeholder review complete', 1),
  ('design', 'Accessibility checked', 2),
  ('design', 'Responsive layouts verified', 3),
  ('general', 'Requirements understood', 1),
  ('general', 'Documentation updated', 2);

-- Example: after creating admin user in Supabase Auth with id matching below,
-- uncomment and replace UUIDs with your actual user IDs.

-- UPDATE users SET role = 'admin', name = 'Admin User' WHERE email = 'admin@example.com';

-- INSERT INTO projects (name, description, start_date, end_date, created_by)
-- VALUES (
--   'Platform Migration',
--   'Migrate legacy services to cloud infrastructure',
--   CURRENT_DATE,
--   CURRENT_DATE + INTERVAL '90 days',
--   (SELECT id FROM users WHERE email = 'admin@example.com')
-- );
