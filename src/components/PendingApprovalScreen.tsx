import { Clock, XCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import type { ApprovalStatus } from '@/hooks/useAuth';

export function PendingApprovalScreen({ status }: { status: ApprovalStatus }) {
  const { signOut } = useAuthContext();
  const rejected = status === 'rejected';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${rejected ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          {rejected ? <XCircle className="h-7 w-7 text-destructive" /> : <Clock className="h-7 w-7 text-primary" />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {rejected ? 'Cadastro não aprovado' : 'Aguardando aprovação'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rejected
              ? 'Seu cadastro não foi aprovado pela administração da Wisy. Entre em contato com a escola para mais informações.'
              : 'Sua conta foi criada com sucesso e está aguardando a aprovação de um administrador. Você receberá acesso assim que ela for revisada.'}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
