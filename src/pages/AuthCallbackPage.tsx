import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const next = searchParams.get('next');

      const error = searchParams.get('error') ?? hashParams.get('error');
      const errorDescription = searchParams.get('error_description') ?? hashParams.get('error_description');

      if (error || errorDescription) {
        toast.error(errorDescription || error || 'Erro ao autenticar');
        navigate('/login', { replace: true });
        return;
      }

      try {
        if (searchParams.has('code')) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (data.session) {
          navigate(next || '/', { replace: true });
          return;
        }

        navigate('/login', { replace: true });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao finalizar login');
        navigate('/login', { replace: true });
      }
    };

    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
