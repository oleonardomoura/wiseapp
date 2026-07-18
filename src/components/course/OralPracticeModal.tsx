import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mic, MicOff, RotateCcw, ChevronRight, CheckCircle2, Volume2, Loader2, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { OralPhrase } from '@/data/course-exercises';
import { calculateSimilarity, getFeedbackMessage } from '@/lib/speech-utils';
import { useTTS } from '@/hooks/useTTS';
import { invokeEdgeFunction } from '@/lib/invokeEdgeFunction';
import { toast } from 'sonner';

interface OralPracticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrases: OralPhrase[];
  lessonTitle: string;
  onComplete: () => void;
}

const MIN_SCORE = 75;
const MAX_ATTEMPTS = 5;
const LOCKOUT_KEY = 'oral_practice_lockout';

const VOICE_OPTIONS = [
  { id: 'en-US-Neural2-D', label: 'Voz do John' },
  { id: 'en-US-Neural2-F', label: 'Voz da Lily' },
];

function isLockedOut(lessonTitle: string): boolean {
  try {
    const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}');
    const lockUntil = data[lessonTitle];
    if (!lockUntil) return false;
    return new Date().getTime() < new Date(lockUntil).getTime();
  } catch { return false; }
}

function setLockout(lessonTitle: string) {
  try {
    const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}');
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    data[lessonTitle] = tomorrow.toISOString();
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

export function OralPracticeModal({ open, onOpenChange, phrases, lessonTitle, onComplete }: OralPracticeModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [voice, setVoice] = useState('en-US-Neural2-D');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const { speak, stop: stopTTS, isLoading: isTTSLoading, isPlaying: isSpeaking } = useTTS();

  const currentPhrase = phrases[currentIndex];
  const progress = ((currentIndex) / phrases.length) * 100;
  const feedback = score !== null ? getFeedbackMessage(score) : null;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setTranscript('');
      setScore(null);
      setCompleted(false);
      setIsListening(false);
      setIsTranscribing(false);
      setAttempts(0);
      setLockedOut(isLockedOut(lessonTitle));
    }
    return () => {
      // Cleanup on close
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const audioBase64 = btoa(binary);

      const { data, error } = await invokeEdgeFunction<{ transcript?: string; confidence?: number }>('google-stt', {
        audioBase64,
        languageCode: 'en-US',
      });

      if (error) throw new Error(error.message);
      if (!data?.transcript) {
        toast.error('Não foi possível reconhecer a fala. Tente novamente.');
        return;
      }

      setTranscript(data.transcript);
    } catch (err: unknown) {
      console.error('Transcription error:', err);
      toast.error('Erro ao transcrever áudio. Tente novamente.');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    // Stop any ongoing TTS before recording
    stopTTS();
    setTranscript('');
    setScore(null);
    chunksRef.current = [];

    try {
      // getUserMedia called directly in click handler
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size > 0) {
          transcribeAudio(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect data every 250ms
      setIsListening(true);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      const errorName =
        err && typeof err === 'object' && 'name' in err && typeof (err as { name?: unknown }).name === 'string'
          ? (err as { name: string }).name
          : undefined;
      if (errorName === 'NotAllowedError') {
        setHasPermission(false);
        toast.error('Permissão de microfone negada. Verifique as configurações do navegador.');
      } else {
        toast.error('Erro ao acessar o microfone.');
      }
    }
  }, [stopTTS, transcribeAudio]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Calculate score when transcript is set
  useEffect(() => {
    if (!isListening && !isTranscribing && transcript && score === null && currentPhrase) {
      const similarity = calculateSimilarity(transcript, currentPhrase.phrase);
      setScore(similarity);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // If failed and used all attempts, lock out
      if (similarity < MIN_SCORE && newAttempts >= MAX_ATTEMPTS) {
        setLockout(lessonTitle);
        setLockedOut(true);
      }
    }
  }, [isListening, isTranscribing, transcript, score, currentPhrase]);

  const handleNext = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTranscript('');
      setScore(null);
      setAttempts(0);
    } else {
      setCompleted(true);
      onComplete();
    }
  };

  const handleRetry = () => {
    setTranscript('');
    setScore(null);
  };

  const attemptsLeft = MAX_ATTEMPTS - attempts;

  const speakPhrase = useCallback((text: string) => {
    speak(text, 0.85, voice);
  }, [speak, voice]);

  const isBusy = isListening || isTranscribing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Prática Oral
          </DialogTitle>
          <DialogDescription>{lessonTitle}</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Frase {currentIndex + 1} de {phrases.length}</span>
            <span>{Math.round(completed ? 100 : progress)}%</span>
          </div>
          <Progress value={completed ? 100 : progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-4"
            >
              <span className="text-5xl">🎉</span>
              <h3 className="text-xl font-bold text-foreground">Prática Concluída!</h3>
              <p className="text-muted-foreground">Você completou todas as frases da prática oral.</p>
              <Button onClick={() => onOpenChange(false)} className="gradient-primary text-primary-foreground">
                Fechar
              </Button>
            </motion.div>
          ) : currentPhrase ? (
            <motion.div
              key={currentPhrase.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Target phrase */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">Repita a frase</Badge>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 p-1 px-2.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground transition-colors outline-none" title="Selecionar Voz">
                          <Settings2 className="h-3.5 w-3.5" />
                          Voz
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {VOICE_OPTIONS.map((v) => (
                          <DropdownMenuItem
                            key={v.id}
                            onClick={() => setVoice(v.id)}
                            className={cn(v.id === voice && 'bg-primary/10 text-primary font-medium')}
                          >
                            {v.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speakPhrase(currentPhrase.phrase)}
                      disabled={isSpeaking || isTTSLoading || isBusy}
                      className={cn("h-8 w-8 p-0", isSpeaking && "animate-pulse text-primary")}
                    >
                      {isTTSLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xl font-semibold text-foreground text-center">
                  "{currentPhrase.phrase}"
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  {currentPhrase.translation}
                </p>
              </div>

              {/* Mic button */}
              <div className="flex justify-center">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isTranscribing || lockedOut}
                  className={cn(
                    "relative flex h-20 w-20 items-center justify-center rounded-full transition-all",
                    isTranscribing
                      ? "bg-muted text-muted-foreground cursor-wait"
                      : isListening
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "gradient-primary text-primary-foreground hover:scale-105"
                  )}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                  {isListening && (
                    <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping" />
                  )}
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {isTranscribing
                  ? "Analisando sua pronúncia..."
                  : isListening
                    ? "Ouvindo... Clique para parar."
                    : hasPermission === false
                      ? "Permissão de microfone negada."
                      : "Clique no microfone para gravar"}
              </p>

              {/* Lockout message */}
              {lockedOut && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-2"
                >
                  <span className="text-4xl">🔒</span>
                  <p className="font-semibold text-foreground">Tentativas esgotadas</p>
                  <p className="text-sm text-muted-foreground">
                    Você usou todas as {MAX_ATTEMPTS} tentativas. Tente novamente amanhã!
                  </p>
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                    Fechar
                  </Button>
                </motion.div>
              )}

              {/* Transcript & Score */}
              {!lockedOut && transcript && !isListening && !isTranscribing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Você disse:</p>
                    <p className="text-foreground font-medium">"{transcript}"</p>
                  </div>

                  {score !== null && feedback && (
                    <div className={cn(
                      "rounded-xl border p-4 flex items-center justify-between",
                      feedback.variant === 'success' && "border-primary/30 bg-primary/5",
                      feedback.variant === 'warning' && "border-warning/30 bg-warning/5",
                      feedback.variant === 'error' && "border-destructive/30 bg-destructive/5"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{feedback.emoji}</span>
                        <div>
                          <p className="font-semibold text-foreground">{score}%</p>
                          <p className="text-sm text-muted-foreground">{feedback.text}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attempts info when below min score */}
                  {score !== null && score < MIN_SCORE && attemptsLeft > 0 && (
                    <p className="text-sm text-center text-muted-foreground">
                      Nota mínima: {MIN_SCORE}%. Você tem <span className="font-semibold text-foreground">{attemptsLeft}</span> tentativa{attemptsLeft !== 1 ? 's' : ''} restante{attemptsLeft !== 1 ? 's' : ''}.
                    </p>
                  )}

                  <div className="flex gap-2">
                    {score !== null && score < MIN_SCORE && attemptsLeft > 0 && (
                      <Button variant="outline" className="flex-1" onClick={handleRetry}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Tentar Novamente ({attemptsLeft})
                      </Button>
                    )}
                    {score !== null && score >= MIN_SCORE && (
                      <>
                        <Button variant="outline" className="flex-1" onClick={handleRetry}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Repetir
                        </Button>
                        <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleNext}>
                          {currentIndex < phrases.length - 1 ? (
                            <>Próxima <ChevronRight className="ml-1 h-4 w-4" /></>
                          ) : (
                            <>Concluir <CheckCircle2 className="ml-1 h-4 w-4" /></>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
