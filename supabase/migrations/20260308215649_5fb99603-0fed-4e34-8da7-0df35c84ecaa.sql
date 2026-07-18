INSERT INTO storage.buckets (id, name, public) VALUES ('tts-cache', 'tts-cache', true);

CREATE POLICY "TTS cache readable by all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tts-cache');
CREATE POLICY "Edge functions can insert TTS cache" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tts-cache');
CREATE POLICY "Public TTS cache read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'tts-cache');