import { useState, useCallback, useRef } from 'react';
import { invokeEdgeFunction } from '@/lib/invokeEdgeFunction';
import { toast } from 'sonner';

interface UseTTSOptions {
  onError?: (error: string) => void;
}

export function useTTS(options?: UseTTSOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const speak = useCallback(async (text: string, speakingRate: number = 1.0, voice: string = 'en-US-Neural2-D') => {
    stop();

    const cacheKey = `${text}__${speakingRate.toFixed(2)}__${voice}`;
    const cachedUrl = cacheRef.current.get(cacheKey);

    if (cachedUrl) {
      const audio = new Audio(cachedUrl);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await invokeEdgeFunction<{ audioUrl?: string }>('google-tts', {
        text,
        speakingRate,
        voice,
      });

      if (error) throw new Error(error.message);
      if (!data?.audioUrl) throw new Error('No audio URL returned');

      // Cache locally
      cacheRef.current.set(cacheKey, data.audioUrl);

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('Erro ao reproduzir áudio');
      };
      await audio.play();
    } catch (err: unknown) {
      console.error('TTS error:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao gerar áudio. Tente novamente.';
      options?.onError?.(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [stop, options]);

  return { speak, stop, isLoading, isPlaying };
}
