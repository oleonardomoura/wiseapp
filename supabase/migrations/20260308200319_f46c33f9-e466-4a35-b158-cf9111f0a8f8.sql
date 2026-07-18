
-- Conversation groups
CREATE TABLE public.conversation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'A1',
  emoji text DEFAULT '💬',
  max_members integer DEFAULT 30,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Group memberships
CREATE TABLE public.group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.conversation_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Group messages (chat)
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.conversation_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS conversation_groups
ALTER TABLE public.conversation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups viewable by authenticated" ON public.conversation_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers/admins can manage groups" ON public.conversation_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- RLS group_memberships
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memberships viewable by authenticated" ON public.group_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.group_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_memberships FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS group_messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by group members" ON public.group_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can send messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

-- Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Seed groups
INSERT INTO public.conversation_groups (name, description, level, emoji, created_by) VALUES
  ('Everyday English', 'Pratique conversação sobre o dia a dia em inglês', 'A2', '🗣️', '00000000-0000-0000-0000-000000000000'),
  ('Business Talk', 'Discussões sobre inglês para negócios e carreira', 'B2', '💼', '00000000-0000-0000-0000-000000000000'),
  ('Movie Club', 'Discuta filmes e séries em inglês', 'B1', '🎬', '00000000-0000-0000-0000-000000000000'),
  ('Travel English', 'Vocabulário e situações de viagem', 'A2', '✈️', '00000000-0000-0000-0000-000000000000'),
  ('Debate Club', 'Debates sobre temas atuais para nível avançado', 'C1', '🎤', '00000000-0000-0000-0000-000000000000');
