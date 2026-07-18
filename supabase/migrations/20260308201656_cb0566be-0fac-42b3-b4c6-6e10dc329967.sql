
ALTER TABLE public.conversation_groups
  ADD COLUMN day_of_week text NOT NULL DEFAULT 'Quarta-feira',
  ADD COLUMN time_slot text NOT NULL DEFAULT '19:00',
  ADD COLUMN teacher_id uuid,
  ADD COLUMN meeting_url text,
  ADD COLUMN next_session_at timestamp with time zone;

UPDATE public.conversation_groups SET day_of_week = 'Segunda-feira', time_slot = '19:00' WHERE name = 'Everyday English';
UPDATE public.conversation_groups SET day_of_week = 'Terça-feira', time_slot = '20:00' WHERE name = 'Business Talk';
UPDATE public.conversation_groups SET day_of_week = 'Quarta-feira', time_slot = '19:30' WHERE name = 'Movie Club';
UPDATE public.conversation_groups SET day_of_week = 'Quinta-feira', time_slot = '18:30' WHERE name = 'Travel English';
UPDATE public.conversation_groups SET day_of_week = 'Sexta-feira', time_slot = '20:00' WHERE name = 'Debate Club';
