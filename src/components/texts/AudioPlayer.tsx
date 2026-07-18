import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, ListMusic, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { invokeEdgeFunction } from '@/lib/invokeEdgeFunction';
import { toast } from 'sonner';

interface AudioPlayerProps {
  sentences: { en: string }[];
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onPlayComplete?: () => void;
  activeSentenceIdx?: number | null;
  onSentenceChange?: (idx: number) => void;
  voice: string;
  onVoiceChange: (voice: string) => void;
}

const SPEED_OPTIONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.1, 1.25, 1.5];
const VOICE_OPTIONS = [
  { id: 'en-US-Neural2-D', label: 'Voz do John' },
  { id: 'en-US-Neural2-F', label: 'Voz da Lily' }
];

// ── Global URL cache to avoid re-fetching across stage changes ──
const urlCache = new Map<string, string>();

function cacheKey(text: string, rate: number, voice: string) {
  return `${text}__${rate.toFixed(2)}__${voice}`;
}

async function fetchTTSUrl(text: string, rate: number, voice: string): Promise<string | null> {
  const key = cacheKey(text, rate, voice);
  const cached = urlCache.get(key);
  if (cached) return cached;

  try {
    const { data, error } = await invokeEdgeFunction<{ audioUrl?: string; audioBase64?: string }>('google-tts', {
      text,
      speakingRate: rate,
      voice,
    });
    if (error) throw error;
    let url = data?.audioUrl || null;
    if (!url && data?.audioBase64) {
      url = `data:audio/mpeg;base64,${data.audioBase64}`;
    }
    if (url) urlCache.set(key, url);
    return url;
  } catch (err) {
    console.error('TTS fetch error:', err);
    return null;
  }
}

export default function AudioPlayer({
  sentences,
  playbackRate,
  onPlaybackRateChange,
  onPlayComplete,
  activeSentenceIdx,
  onSentenceChange,
  voice,
  onVoiceChange,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [totalTime, setTotalTime] = useState('0:00');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null); // pre-buffered next
  const animFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  const sentenceUrlsRef = useRef<(string | null)[]>([]);
  const currentSentenceRef = useRef(0);
  const fullAudioUrlRef = useRef<string | null>(null);

  const sentenceDurationsRef = useRef<number[]>([]);
  const totalDurationRef = useRef(0);
  const elapsedBeforeCurrentRef = useRef(0);

  const needsSentenceSync = !!onSentenceChange;
  const cachedRateRef = useRef<number | null>(null);
  const cachedVoiceRef = useRef<string | null>(null);
  const eagerFetchStartedRef = useRef(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (nextAudioRef.current) { nextAudioRef.current = null; }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      isPlayingRef.current = false;
    };
  }, []);

  // ── Eager prefetch on mount: start fetching all URLs immediately ──
  useEffect(() => {
    if (eagerFetchStartedRef.current) return;
    eagerFetchStartedRef.current = true;

    const rate = playbackRate;

    if (needsSentenceSync) {
      // Initialize arrays
      sentenceUrlsRef.current = new Array(sentences.length).fill(null);
      sentenceDurationsRef.current = new Array(sentences.length).fill(2);

      // Fire all fetches in background without blocking
      sentences.forEach((s, idx) => {
        fetchTTSUrl(s.en, rate, voice).then((url) => {
          sentenceUrlsRef.current[idx] = url;
          if (url) {
            const a = new Audio();
            a.preload = 'auto';
            a.src = url;
            a.addEventListener('loadedmetadata', () => {
              sentenceDurationsRef.current[idx] = a.duration || 2;
              totalDurationRef.current = sentenceDurationsRef.current.reduce((x, y) => x + y, 0);
              setTotalTime(formatTime(totalDurationRef.current));
            });
          }
        });
      });
    } else {
      const fullText = sentences.map((s) => s.en).join(' ');
      fetchTTSUrl(fullText, rate, voice).then((url) => {
        fullAudioUrlRef.current = url;
      });
    }
  }, []); // intentionally run once on mount

  // Invalidate cache when rate or voice changes
  useEffect(() => {
    if ((cachedRateRef.current !== null && cachedRateRef.current !== playbackRate) ||
        (cachedVoiceRef.current !== null && cachedVoiceRef.current !== voice)) {
      sentenceUrlsRef.current = [];
      fullAudioUrlRef.current = null;
      sentenceDurationsRef.current = [];
      totalDurationRef.current = 0;
      eagerFetchStartedRef.current = false;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      nextAudioRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime('0:00');
      setTotalTime('0:00');
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      // Re-trigger eager fetch with new rate/voice
      const rate = playbackRate;
      if (needsSentenceSync) {
        sentenceUrlsRef.current = new Array(sentences.length).fill(null);
        sentenceDurationsRef.current = new Array(sentences.length).fill(2);
        sentences.forEach((s, idx) => {
          fetchTTSUrl(s.en, rate, voice).then((url) => {
            sentenceUrlsRef.current[idx] = url;
            if (url) {
              const a = new Audio();
              a.preload = 'auto';
              a.src = url;
              a.addEventListener('loadedmetadata', () => {
                sentenceDurationsRef.current[idx] = a.duration || 2;
                totalDurationRef.current = sentenceDurationsRef.current.reduce((x, y) => x + y, 0);
                setTotalTime(formatTime(totalDurationRef.current));
              });
            }
          });
        });
      } else {
        const fullText = sentences.map((s) => s.en).join(' ');
        fetchTTSUrl(fullText, rate, voice).then((url) => {
          fullAudioUrlRef.current = url;
        });
      }
      eagerFetchStartedRef.current = true;
    }
    cachedRateRef.current = playbackRate;
    cachedVoiceRef.current = voice;
  }, [playbackRate, voice, needsSentenceSync, sentences]);

  const updateProgressForAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    if (needsSentenceSync) {
      const elapsed = elapsedBeforeCurrentRef.current + (audio.currentTime || 0);
      const total = totalDurationRef.current || 1;
      setProgress((elapsed / total) * 100);
      setCurrentTime(formatTime(elapsed));
    } else {
      const dur = audio.duration || 1;
      setProgress((audio.currentTime / dur) * 100);
      setCurrentTime(formatTime(audio.currentTime));
      setTotalTime(formatTime(dur));
    }

    animFrameRef.current = requestAnimationFrame(updateProgressForAudio);
  }, [needsSentenceSync]);

  // ── Pre-buffer next sentence audio element ──
  const prebufferNext = useCallback((nextIdx: number) => {
    if (nextIdx >= sentences.length) { nextAudioRef.current = null; return; }
    const url = sentenceUrlsRef.current[nextIdx];
    if (!url) { nextAudioRef.current = null; return; }
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    nextAudioRef.current = a;
  }, [sentences.length]);

  // ── Play sentence chain (synced mode) ──
  const playSentenceAt = useCallback(async (idx: number) => {
    if (idx >= sentences.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(100);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      onPlayComplete?.();
      return;
    }
    if (!isPlayingRef.current) return;

    // Use pre-buffered audio if available, otherwise fetch
    let audio: HTMLAudioElement;
    if (nextAudioRef.current && nextAudioRef.current.src && sentenceUrlsRef.current[idx] &&
        nextAudioRef.current.src === sentenceUrlsRef.current[idx]) {
      audio = nextAudioRef.current;
      nextAudioRef.current = null;
    } else {
      let url = sentenceUrlsRef.current[idx];
      if (!url) {
        url = await fetchTTSUrl(sentences[idx].en, cachedRateRef.current || 0.85, cachedVoiceRef.current || 'en-US-Neural2-D');
        sentenceUrlsRef.current[idx] = url;
      }
      if (!url) { playSentenceAt(idx + 1); return; }
      audio = new Audio(url);
    }

    currentSentenceRef.current = idx;
    onSentenceChange?.(idx);

    elapsedBeforeCurrentRef.current = sentenceDurationsRef.current
      .slice(0, idx)
      .reduce((a, b) => a + b, 0);

    audioRef.current = audio;

    // Pre-buffer the next sentence while this one plays
    prebufferNext(idx + 1);

    audio.onended = () => {
      if (isPlayingRef.current) {
        playSentenceAt(idx + 1);
      }
    };
    audio.onerror = () => {
      if (isPlayingRef.current) playSentenceAt(idx + 1);
    };

    audio.play();
    animFrameRef.current = requestAnimationFrame(updateProgressForAudio);
  }, [sentences, onSentenceChange, onPlayComplete, updateProgressForAudio, prebufferNext]);

  // ── Play full text (non-synced mode) ──
  const playFullText = useCallback(() => {
    const url = fullAudioUrlRef.current;
    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => setTotalTime(formatTime(audio.duration));
    audio.onended = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(100);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      onPlayComplete?.();
    };
    audio.onerror = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };

    audio.play();
    animFrameRef.current = requestAnimationFrame(updateProgressForAudio);
  }, [onPlayComplete, updateProgressForAudio]);

  // ── Main play ──
  const play = useCallback(async () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (needsSentenceSync) {
      // Check if first sentence is already eagerly fetched
      let firstUrl = sentenceUrlsRef.current[0];
      if (!firstUrl) {
        setIsLoading(true);
        firstUrl = await fetchTTSUrl(sentences[0].en, playbackRate, voice);
        sentenceUrlsRef.current[0] = firstUrl;
        setIsLoading(false);
      }
      if (!firstUrl) { toast.error('Erro ao carregar áudio'); return; }

      isPlayingRef.current = true;
      setIsPlaying(true);
      playSentenceAt(0);
    } else {
      if (!fullAudioUrlRef.current) {
        setIsLoading(true);
        const fullText = sentences.map((s) => s.en).join(' ');
        const url = await fetchTTSUrl(fullText, playbackRate, voice);
        fullAudioUrlRef.current = url;
        setIsLoading(false);
        if (!url) { toast.error('Erro ao carregar áudio'); return; }
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      playFullText();
    }
  }, [needsSentenceSync, sentences, playbackRate, voice, playSentenceAt, playFullText]);

  const stop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else if (audioRef.current && audioRef.current.currentTime > 0 && !audioRef.current.ended && !needsSentenceSync) {
      audioRef.current.play();
      isPlayingRef.current = true;
      setIsPlaying(true);
      animFrameRef.current = requestAnimationFrame(updateProgressForAudio);
    } else {
      play();
    }
  }, [isPlaying, stop, play, needsSentenceSync, updateProgressForAudio]);

  const restart = useCallback(() => {
    stop();
    setProgress(0);
    setCurrentTime('0:00');
    elapsedBeforeCurrentRef.current = 0;
  }, [stop]);

  const skipPrev = useCallback(() => {
    if (needsSentenceSync && isPlayingRef.current) {
      const prev = Math.max(0, currentSentenceRef.current - 1);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      playSentenceAt(prev);
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
    }
  }, [needsSentenceSync, playSentenceAt]);

  const skipNext = useCallback(() => {
    if (needsSentenceSync && isPlayingRef.current) {
      const next = Math.min(sentences.length - 1, currentSentenceRef.current + 1);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      playSentenceAt(next);
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
    }
  }, [needsSentenceSync, sentences.length, playSentenceAt]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <button onClick={restart} className="text-muted-foreground hover:text-foreground transition-colors" title="Repetir">
          <RotateCcw className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 p-1 pr-2 rounded-full text-[11px] text-muted-foreground hover:text-foreground transition-colors outline-none shrink-0" title="Selecionar Voz">
              <Settings2 className="h-3.5 w-3.5" />
              Voz
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {VOICE_OPTIONS.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => onVoiceChange(v.id)}
                className={cn(v.id === voice && 'bg-primary/10 text-primary font-medium')}
              >
                {v.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Slider
          value={[progress]}
          min={0}
          max={100}
          step={0.1}
          className="flex-1"
          onValueChange={([v]) => {
            if (!needsSentenceSync && audioRef.current && audioRef.current.duration) {
              audioRef.current.currentTime = (v / 100) * audioRef.current.duration;
              setProgress(v);
            }
          }}
          disabled={needsSentenceSync}
        />

        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap hidden sm:inline-block">
          {currentTime} / {totalTime}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors outline-none shrink-0" title="Velocidade">
              <ListMusic className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SPEED_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onPlaybackRateChange(s)}
                className={cn(s === playbackRate && 'bg-primary/10 text-primary font-medium')}
              >
                {s.toFixed(2)}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={skipPrev} disabled={isLoading}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-11 w-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={togglePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={skipNext} disabled={isLoading}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
