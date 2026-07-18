import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, User, GraduationCap, Shield, Mail, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoBrand from '@/assets/logo-brand.png';
import { supabase } from '@/integrations/supabase/client';

const DEV_QUICK_ACCESS = import.meta.env.DEV;
type AccessRole = 'student' | 'teacher' | 'admin';

const ROLE_OPTIONS: Array<{ value: AccessRole; label: string; icon: typeof User }> = [
  { value: 'student', label: 'Aluno', icon: User },
  { value: 'teacher', label: 'Professor', icon: GraduationCap },
  { value: 'admin', label: 'Admin', icon: Shield },
];

const DEV_ROLE_EMAIL: Record<AccessRole, string> = {
  student: 'demo.student1@wisy.app',
  teacher: 'demo.teacher@wisy.app',
  admin: 'demo.admin@wisy.app',
};

const VIDEO_SOURCES = ['/login-bg.mp4', '/login-bg-2.mp4', '/login-bg-3.mp4'];

function VideoCarousel() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const advanceVideo = (fromIndex: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setPrev(fromIndex);
    
    const nextIndex = (fromIndex + 1) % VIDEO_SOURCES.length;
    setCurrent(nextIndex);
    
    const nextVideo = videoRefs.current[nextIndex];
    if (nextVideo) {
      nextVideo.currentTime = 0;
      nextVideo.play().catch(() => {});
    }

    setTimeout(() => {
      setIsTransitioning(false);
      const prevVideo = videoRefs.current[fromIndex];
      // Pause the old video so it doesn't continue playing in the background
      if (prevVideo && fromIndex !== nextIndex) {
        prevVideo.pause();
      }
    }, 1000);
  };

  const handleTimeUpdate = (index: number) => {
    if (index !== current || isTransitioning) return;
    const video = videoRefs.current[index];
    if (!video) return;

    // Crossfade 1 second before the current video ends for a seamless transition
    const timeRemaining = video.duration - video.currentTime;
    if (timeRemaining <= 1.0 && timeRemaining > 0) {
      advanceVideo(index);
    }
  };

  useEffect(() => {
    const firstVideo = videoRefs.current[0];
    if (firstVideo) {
      firstVideo.play().catch(() => {});
    }
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      {VIDEO_SOURCES.map((src, index) => {
        const isActive = index === current;
        const isPrev = index === prev && isTransitioning;
        
        let zIndexClass = '-z-10';
        let opacityClass = 'opacity-0';
        
        if (isActive) {
          zIndexClass = 'z-10';
          opacityClass = 'opacity-100';
        } else if (isPrev) {
          // Keep old video at z-0 and fully opaque while new one fades in at z-10 over it
          zIndexClass = 'z-0';
          opacityClass = 'opacity-100';
        }

        return (
          <video
            key={src}
            ref={(el) => (videoRefs.current[index] = el)}
            src={src}
            muted
            playsInline
            onTimeUpdate={() => handleTimeUpdate(index)}
            onEnded={() => {
              if (index === current && !isTransitioning) {
                advanceVideo(index);
              }
            }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${zIndexClass} ${opacityClass}`}
          />
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, initialized, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [quickLoadingEmail, setQuickLoadingEmail] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AccessRole>('student');

  const currentRoleEmail = useMemo(() => DEV_ROLE_EMAIL[selectedRole], [selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const name = fullName.trim();
        if (name.length < 2) {
          toast.error('Informe seu nome completo');
          return;
        }
        if (password !== confirmPassword) {
          toast.error('As senhas não conferem');
          return;
        }

        const { error } = await signUp(email, password, name);
        if (error) throw error;

        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          const message = error.message || 'Erro ao autenticar';
          if (message.toLowerCase().includes('email not confirmed')) {
            toast.error('Confirme seu e-mail para entrar. Verifique sua caixa de entrada.');
            return;
          }
          throw error;
        }
        navigate('/');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (mode === 'signup' ? 'Erro ao criar conta' : 'Erro ao autenticar'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [initialized, isAuthenticated, navigate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const error = searchParams.get('error') ?? hashParams.get('error');
    const errorDescription = searchParams.get('error_description') ?? hashParams.get('error_description');

    if (!error && !errorDescription) return;

    const message = errorDescription || error;
    toast.error(message);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        setGoogleLoading(false);
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setGoogleLoading(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar com Google');
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast.error('Digite seu e-mail para recuperar a senha.');
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Enviamos um e-mail para redefinir sua senha.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar e-mail de recuperação');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleQuickAccess = async (targetEmail: string) => {
    setQuickLoadingEmail(targetEmail);
    try {
      const { error } = await signIn(targetEmail, 'Demo1234!');
      if (error) throw error;
      navigate('/');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? `Falha no acesso rápido (${targetEmail}): ${err.message}`
          : `Falha no acesso rápido (${targetEmail})`
      );
    } finally {
      setQuickLoadingEmail(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Video Carousel Background */}
      <VideoCarousel />

      {/* Blue Overlay — primary color, 80% opacity, always above videos */}
      <div className="absolute inset-0 z-20 bg-primary/65" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-30 w-full max-w-md"
      >
        {/* Single opaque white card */}
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-white shadow-2xl">
          
          {/* Logo centered at top */}
          <div className="flex justify-center pt-8 pb-4">
            <img src={logoBrand} alt="WisyApp" className="h-12" />
          </div>

          {/* Form panel */}
          <div className="px-8 pb-8">
            <h1 className="text-2xl font-bold text-primary">
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'signup' ? 'Comece sua jornada acadêmica na Wisy.' : 'Acesse sua jornada acadêmica na Wisy.'}
            </p>

            {mode === 'login' && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {ROLE_OPTIONS.map(option => {
                  const ActiveIcon = option.icon;
                  const isActive = selectedRole === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedRole(option.value);
                        if (DEV_QUICK_ACCESS) {
                          setEmail(DEV_ROLE_EMAIL[option.value]);
                          setPassword('Demo1234!');
                        }
                      }}
                      className={`rounded-xl border px-3 py-3 text-center transition ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <ActiveIcon className="mx-auto mb-1 h-4 w-4" />
                      <span className="text-sm font-semibold">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Nome completo</label>
                  <Input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="h-11 text-base bg-background"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-primary">E-mail institucional</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seuemail@wisy.edu"
                    className="h-11 pl-11 text-base bg-background"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Senha</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? 'Enviando...' : 'Esqueci minha senha'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="•••"
                    className="h-11 pl-11 text-base bg-background"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Confirmar senha</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a senha"
                    className="h-11 text-base bg-background"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 gradient-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  mode === 'signup' ? 'Criar conta' : 'Entrar'
                )}
              </Button>
            </form>

            {mode === 'login' && (
              <div className="mt-5 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ou acesse com</span>
                <Separator className="flex-1" />
              </div>
            )}

            {mode === 'login' && (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full h-11 text-base font-semibold"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Entrar com Google
              </Button>
            )}

            {mode === 'login' && DEV_QUICK_ACCESS && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full bg-secondary"
                  onClick={() => handleQuickAccess(currentRoleEmail)}
                  disabled={!!quickLoadingEmail}
                >
                  {quickLoadingEmail === currentRoleEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Acesso rápido DEV'
                  )}
                </Button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === 'signup' ? 'Já tem conta?' : 'Não faz parte da elite Wisy?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(prev => (prev === 'login' ? 'signup' : 'login'));
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="font-semibold text-primary hover:underline"
              >
                {mode === 'signup' ? 'Entrar' : 'Criar conta'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
