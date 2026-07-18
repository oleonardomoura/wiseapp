
-- Remove group_messages from realtime publication (table already dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_messages;
  END IF;
END $$;
