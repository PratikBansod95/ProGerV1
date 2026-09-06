-- ProGer initial schema
-- Run in Supabase SQL editor or via Supabase CLI

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'pm', 'team_member', 'stakeholder');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE project_member_role AS ENUM ('pm', 'team_member', 'stakeholder');

-- Users profile (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'team_member',
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_project project_member_role NOT NULL,
  UNIQUE (project_id, user_id)
);

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id),
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  task_type TEXT NOT NULL DEFAULT 'development',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES checklist_templates(id),
  label TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE checklist_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_user_priority (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, task_id)
);

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_checklist_items_task_id ON checklist_items(task_id);
CREATE INDEX idx_activity_log_task_id ON activity_log(task_id);

-- Helper: get current user's app role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- Helper: is member of project
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

-- Helper: can manage project (admin or pm on project)
CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role_in_project = 'pm'
  ) OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'pm' AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id AND user_id = auth.uid()
      )
  );
$$;

-- Helper: can edit task
CREATE OR REPLACE FUNCTION public.can_edit_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.can_manage_project((SELECT project_id FROM tasks WHERE id = p_task_id))
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE id = p_task_id AND assignee_id = auth.uid()
    );
$$;

-- Trigger: bump last_activity_at on task status change
CREATE OR REPLACE FUNCTION public.bump_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_activity_on_update
  BEFORE UPDATE OF status, assignee_id, priority, due_date, title, description
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_task_activity();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'team_member')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_user_priority ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY users_update_admin ON users FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Projects policies
CREATE POLICY projects_select ON projects FOR SELECT TO authenticated
  USING (public.is_project_member(id) AND archived = FALSE);

CREATE POLICY projects_select_archived ON projects FOR SELECT TO authenticated
  USING (public.is_admin() AND archived = TRUE);

CREATE POLICY projects_insert ON projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'pm');

CREATE POLICY projects_update ON projects FOR UPDATE TO authenticated
  USING (public.can_manage_project(id));

CREATE POLICY projects_delete ON projects FOR DELETE TO authenticated
  USING (public.is_admin());

-- Project members policies
CREATE POLICY project_members_select ON project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY project_members_manage ON project_members FOR ALL TO authenticated
  USING (public.can_manage_project(project_id))
  WITH CHECK (public.can_manage_project(project_id));

-- Checklist templates (read all authenticated, write admin only)
CREATE POLICY checklist_templates_select ON checklist_templates FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY checklist_templates_manage ON checklist_templates FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tasks policies
CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_project(project_id)
    OR (
      public.current_user_role() = 'team_member'
      AND assignee_id = auth.uid()
      AND public.is_project_member(project_id)
    )
  );

CREATE POLICY tasks_update ON tasks FOR UPDATE TO authenticated
  USING (public.can_edit_task(id));

CREATE POLICY tasks_delete ON tasks FOR DELETE TO authenticated
  USING (public.can_manage_project(project_id));

-- Checklist items
CREATE POLICY checklist_items_select ON checklist_items FOR SELECT TO authenticated
  USING (
    public.is_project_member((SELECT project_id FROM tasks WHERE id = task_id))
  );

CREATE POLICY checklist_items_update ON checklist_items FOR UPDATE TO authenticated
  USING (public.can_edit_task(task_id));

CREATE POLICY checklist_items_insert ON checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_task(task_id));

-- Checklist overrides
CREATE POLICY checklist_overrides_select ON checklist_overrides FOR SELECT TO authenticated
  USING (
    public.is_project_member((SELECT project_id FROM tasks WHERE id = task_id))
    OR public.is_admin()
  );

CREATE POLICY checklist_overrides_insert ON checklist_overrides FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_task(task_id) AND user_id = auth.uid());

-- Comments
CREATE POLICY comments_select ON comments FOR SELECT TO authenticated
  USING (
    public.is_project_member((SELECT project_id FROM tasks WHERE id = task_id))
  );

CREATE POLICY comments_insert ON comments FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_task(task_id) AND user_id = auth.uid()
  );

-- Activity log
CREATE POLICY activity_log_select ON activity_log FOR SELECT TO authenticated
  USING (
    public.is_project_member((SELECT project_id FROM tasks WHERE id = task_id))
  );

CREATE POLICY activity_log_insert ON activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Task user priority
CREATE POLICY task_user_priority_select ON task_user_priority FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY task_user_priority_manage ON task_user_priority FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
