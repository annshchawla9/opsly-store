-- Create enum types
CREATE TYPE public.task_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
CREATE TYPE public.recurrence_type AS ENUM ('daily_opening', 'daily_closing', 'weekly');
CREATE TYPE public.app_role AS ENUM ('store_manager', 'area_manager', 'hq_admin');

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  closing_time TIME DEFAULT '22:00:00',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create profiles table for store managers
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'store_manager',
  UNIQUE(user_id, role)
);

-- Create messages table for HQ communications
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  requires_ack BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type recurrence_type,
  requires_proof BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create task attachments table
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Create sales targets table
CREATE TABLE public.sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  store_daily_target_amount NUMERIC NOT NULL,
  UNIQUE(store_id, date)
);

-- Create sales actuals table
CREATE TABLE public.sales_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(store_id, date)
);

-- Create salesperson targets table
CREATE TABLE public.salesperson_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  salesperson_name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  UNIQUE(store_id, date, salesperson_name)
);

-- Create salesperson actuals table
CREATE TABLE public.salesperson_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  salesperson_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(store_id, date, salesperson_name)
);

-- Create focus goals table
CREATE TABLE public.focus_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  target_qty INTEGER NOT NULL,
  achieved_qty INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesperson_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesperson_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_goals ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's store_id
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Stores: users can read their own store
CREATE POLICY "Users can view their own store"
  ON public.stores FOR SELECT
  USING (id = public.get_user_store_id());

-- Profiles: users can manage their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- User roles: users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Messages: users can view/update messages for their store
CREATE POLICY "Users can view their store messages"
  ON public.messages FOR SELECT
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can update their store messages"
  ON public.messages FOR UPDATE
  USING (store_id = public.get_user_store_id());

-- Tasks: users can view/update tasks for their store
CREATE POLICY "Users can view their store tasks"
  ON public.tasks FOR SELECT
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can update their store tasks"
  ON public.tasks FOR UPDATE
  USING (store_id = public.get_user_store_id());

-- Task attachments: users can manage attachments for their store's tasks
CREATE POLICY "Users can view task attachments"
  ON public.task_attachments FOR SELECT
  USING (
    task_id IN (SELECT id FROM public.tasks WHERE store_id = public.get_user_store_id())
  );

CREATE POLICY "Users can insert task attachments"
  ON public.task_attachments FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM public.tasks WHERE store_id = public.get_user_store_id())
  );

-- Sales targets: users can view their store targets
CREATE POLICY "Users can view their store targets"
  ON public.sales_targets FOR SELECT
  USING (store_id = public.get_user_store_id());

-- Sales actuals: users can view their store actuals
CREATE POLICY "Users can view their store actuals"
  ON public.sales_actuals FOR SELECT
  USING (store_id = public.get_user_store_id());

-- Salesperson targets: users can view their store salesperson targets
CREATE POLICY "Users can view salesperson targets"
  ON public.salesperson_targets FOR SELECT
  USING (store_id = public.get_user_store_id());

-- Salesperson actuals: users can view their store salesperson actuals
CREATE POLICY "Users can view salesperson actuals"
  ON public.salesperson_actuals FOR SELECT
  USING (store_id = public.get_user_store_id());

-- Focus goals: users can view/update their store focus goals
CREATE POLICY "Users can view focus goals"
  ON public.focus_goals FOR SELECT
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can update focus goals"
  ON public.focus_goals FOR UPDATE
  USING (store_id = public.get_user_store_id());

-- Create storage bucket for task proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('task-proofs', 'task-proofs', true);

-- Storage policies for task proofs
CREATE POLICY "Authenticated users can upload task proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view task proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-proofs');

-- Trigger to update profiles.updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;