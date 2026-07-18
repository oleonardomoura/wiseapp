import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const error = searchParams.get('error') ?? hashParams.get('error');
        const errorDescription = searchParams.get('error_description') ?? hashParams.get('error_description');
        if (error || errorDescription) {
          toast.error(errorDescription || error || 'Erro ao abrir recuperação de senha');
          navigate('/login', { replace: true });
          return;
        }

        if (searchParams.has('code')) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          toast.error('Sessão de recuperação inválida ou expirada.');
          navigate('/login', { replace: true });
          return;
        }

        setLoading(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao validar recuperação de senha');
        navigate('/login', { replace: true });
      }
    };

    void run();
  }, [navigate]);

  const handleSave = async () => {
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Senha atualizada! Faça login novamente.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar senha');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">Defina uma nova senha para sua conta.</p>

        <div className="mt-6 space-y-4">
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Nova senha"
            className="h-12 text-base"
          />
          <Input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirmar nova senha"
            className="h-12 text-base"
          />

          <Button
            type="button"
            className="w-full h-12 gradient-primary text-primary-foreground font-medium text-base"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
          </Button>
        </div>
      </div>
    </div>
  );
}

