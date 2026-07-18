import { useState, useEffect, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { User, Camera, Calendar, Lock, Bell, Settings, LogOut, Save, Trash2, Mail, Smartphone, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

type EasyCropMediaSize = {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};

type AxisLock = 'x' | 'y' | null;

// ---- helpers ----
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(r => (image.onload = r));
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.9));
}

function readLocalPrefs(userId: string) {
  try {
    return JSON.parse(localStorage.getItem(`study_prefs_${userId}`) || '{}');
  } catch { return {}; }
}
function readLocalNotif(userId: string) {
  try {
    return JSON.parse(localStorage.getItem(`notif_settings_${userId}`) || '{}');
  } catch { return {}; }
}

export default function MyAccountPage() {
  const { profile, user, signOut } = useAuthContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [cefrLevel, setCefrLevel] = useState('A1');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar crop
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const didInitCropRef = useRef(false);

  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaSize, setMediaSize] = useState<EasyCropMediaSize | null>(null);
  const [axisLock, setAxisLock] = useState<AxisLock>(null);

  const handleCropChange = useCallback(
    (next: { x: number; y: number }) => {
      if (!axisLock) {
        setCrop(next);
        return;
      }

      setCrop({
        x: axisLock === 'y' ? 0 : next.x,
        y: axisLock === 'x' ? 0 : next.y,
      });
    },
    [axisLock]
  );

  useEffect(() => {
    if (!cropImage) return;

    didInitCropRef.current = false;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setAxisLock(null);
    setMediaSize(null);
    setCropSize(null);
  }, [cropImage]);

  // Define o tamanho do recorte como um quadrado perfeito baseado no container
  useEffect(() => {
    if (!cropImage) return;
    const el = cropContainerRef.current;
    if (!el) return;

    const update = () => {
      const size = Math.floor(Math.min(el.clientWidth, el.clientHeight));
      if (size > 0) setCropSize({ width: size, height: size });
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cropImage]);

  // Ao carregar a imagem, ajusta o zoom para cobrir o círculo pela primeira extremidade (horizontal ou vertical)
  useEffect(() => {
    if (!cropImage || !cropSize || !mediaSize || didInitCropRef.current) return;
    didInitCropRef.current = true;

    const zoomToCover = Math.max(cropSize.width / mediaSize.width, cropSize.height / mediaSize.height);
    setZoom(Math.min(3, Math.max(1, zoomToCover)));
    setCrop({ x: 0, y: 0 });

    const ratio = mediaSize.naturalWidth / mediaSize.naturalHeight;
    const lock: AxisLock = ratio > 1.05 ? 'x' : ratio < 0.95 ? 'y' : null;
    setAxisLock(lock);
  }, [cropImage, cropSize, mediaSize]);

  // Study prefs
  const [dailyGoal, setDailyGoal] = useState('30');
  const [dailyReviews, setDailyReviews] = useState('20');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Notification settings
  const [studyReminders, setStudyReminders] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [showNotifDialog, setShowNotifDialog] = useState(false);

  // Password
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Init from profile
  useEffect(() => {
    if (!profile || !user) return;
    const parts = (profile.full_name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setUsername(profile.username || '');
    setCefrLevel(profile.cefr_level || 'A1');
    setAvatarUrl(profile.avatar_url || null);

    // Load study prefs (local first, then DB)
    const local = readLocalPrefs(user.id);
    setDailyGoal(local.daily_goal_minutes?.toString() || '30');
    setDailyReviews(local.daily_reviews?.toString() || '20');

    supabase.from('study_preferences').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setDailyGoal(data.daily_goal_minutes?.toString() || '30');
        setDailyReviews(data.daily_reviews?.toString() || '20');
      }
    });

    // Load notif settings
    const localNotif = readLocalNotif(user.id);
    setStudyReminders(localNotif.study_reminders ?? true);
    setEmailNotifications(localNotif.email_notifications ?? true);
    setPushNotifications(localNotif.push_notifications ?? false);

    supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setStudyReminders(data.study_reminders ?? true);
        setEmailNotifications(data.email_notifications ?? true);
        setPushNotifications(data.push_notifications ?? false);
      }
    });
  }, [profile, user]);

  // ---- Save profile ----
  const saveProfile = async () => {
    if (!user) return;
    
    // Validate username if provided
    if (username && !/^@[a-z0-9_]{3,}$/.test(username)) {
      toast({ 
        title: 'Nome de Perfil Inválido', 
        description: 'Deve começar com @, ter ao menos 3 caracteres, e conter apenas letras minúsculas, números e underline (_).', 
        variant: 'destructive' 
      });
      return;
    }

    setSavingProfile(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    // DEV BYPASS: ignore database update for mock user to avoid UUID error
    if (user.id === 'dev-user-id') {
      setTimeout(() => {
        setSavingProfile(false);
        toast({ title: 'Perfil atualizado! (Modo Dev) ✓' });
        window.dispatchEvent(new CustomEvent('wisy:profileUpdated'));
      }, 500);
      return;
    }
    
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      username: username || null,
      cefr_level: cefrLevel,
    }).eq('id', user.id);

    if (error) {
      toast({ title: 'Erro ao salvar perfil', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado! ✓' });
      window.dispatchEvent(new CustomEvent('wisy:profileUpdated'));
    }
    setSavingProfile(false);
  };

  // ---- Avatar upload ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset do editor a cada nova foto
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setAxisLock(null);
    setMediaSize(null);
    setCropSize(null);
    didInitCropRef.current = false;

    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedAvatar = async () => {
    if (!cropImage || !croppedArea || !user) return;
    setUploadingAvatar(true);
    try {
      const blob = await getCroppedImg(cropImage, croppedArea);
      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setCropImage(null);
      toast({ title: 'Foto atualizada! 📸' });
      window.dispatchEvent(new CustomEvent('wisy:profileUpdated'));
    } catch (err: unknown) {
      toast({ title: 'Erro no upload', description: err instanceof Error ? err.message : 'Falha ao enviar imagem', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setAvatarUrl(null);
    toast({ title: 'Foto removida' });
    window.dispatchEvent(new CustomEvent('wisy:profileUpdated'));
  };

  // ---- Save study prefs ----
  const saveStudyPrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const prefs = { daily_goal_minutes: parseInt(dailyGoal), daily_reviews: parseInt(dailyReviews) };
    localStorage.setItem(`study_prefs_${user.id}`, JSON.stringify(prefs));

    const { error } = await supabase.from('study_preferences').upsert({
      user_id: user.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      toast({ title: 'Erro ao salvar preferências', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Preferências salvas! ✓' });
    }
    setSavingPrefs(false);
  };

  // ---- Save notification settings ----
  const saveNotifSettings = async () => {
    if (!user) return;
    setSavingNotif(true);
    const settings = { study_reminders: studyReminders, email_notifications: emailNotifications, push_notifications: pushNotifications };
    localStorage.setItem(`notif_settings_${user.id}`, JSON.stringify(settings));

    const { error } = await supabase.from('notification_settings').upsert({
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      toast({ title: 'Erro ao salvar notificações', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Notificações atualizadas! ✓' });
      setShowNotifDialog(false);
    }
    setSavingNotif(false);
  };

  // ---- Change password ----
  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não conferem', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha alterada com sucesso! 🔒' });
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const memberSince = user?.created_at
    ? formatDistanceToNow(new Date(user.created_at), { addSuffix: false, locale: ptBR })
    : '';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Minha Conta</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Profile sidebar */}
        <motion.div variants={item} className="rounded-xl border border-border bg-card p-6 text-center space-y-4 h-fit">
          {/* Avatar */}
          <div className="relative mx-auto w-fit">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative group">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="text-3xl font-bold bg-secondary text-muted-foreground">
                      {(firstName || 'U').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/30 transition-colors">
                    <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Camera className="mr-2 h-4 w-4" />
                  Alterar Foto
                </DropdownMenuItem>
                {avatarUrl && (
                  <DropdownMenuItem onClick={removeAvatar} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover Foto
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">{`${firstName} ${lastName}`.trim() || 'Usuário'}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <Separator />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Nível CEFR</span>
              <Badge variant="outline" className="font-semibold">{cefrLevel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">XP Total</span>
              <Badge variant="outline">{profile?.xp ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sequência</span>
              <Badge className="bg-primary text-primary-foreground">{profile?.streak ?? 0} dias</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{memberSince ? `Membro há ${memberSince}` : 'Membro'}</span>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Personal info */}
          <motion.div variants={item} className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Informações Pessoais
              </h2>
              <p className="text-sm text-muted-foreground">Atualize seus dados pessoais</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} maxLength={50} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome de Usuário</Label>
              <Input 
                value={username} 
                onChange={e => {
                  let val = e.target.value.toLowerCase().replace(/\s/g, '');
                  if (val.length > 0 && !val.startsWith('@')) val = '@' + val;
                  setUsername(val);
                }} 
                placeholder="@seunome"
                maxLength={30} 
              />
              <p className="text-xs text-muted-foreground">Como as pessoas poderão te marcar (ex: @joao_silva)</p>
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ''} disabled className="bg-secondary/50" />
            </div>

            <div className="space-y-2">
              <Label>Nível de Inglês</Label>
              <Select value={cefrLevel} onValueChange={setCefrLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1 – Iniciante</SelectItem>
                  <SelectItem value="A2">A2 – Básico</SelectItem>
                  <SelectItem value="B1">B1 – Intermediário</SelectItem>
                  <SelectItem value="B2">B2 – Intermediário Superior</SelectItem>
                  <SelectItem value="C1">C1 – Avançado</SelectItem>
                  <SelectItem value="C2">C2 – Proficiente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={saveProfile} disabled={savingProfile} className="gap-2 gradient-primary text-primary-foreground">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
          </motion.div>

          {/* Study preferences */}
          <motion.div variants={item} className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Preferências de Estudo
              </h2>
              <p className="text-sm text-muted-foreground">Configure suas metas diárias</p>
            </div>

            <div className="space-y-2">
              <Label>Meta Diária (minutos)</Label>
              <Select value={dailyGoal} onValueChange={setDailyGoal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                  <SelectItem value="90">90 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Revisões de Flashcards por Dia</Label>
              <Select value={dailyReviews} onValueChange={setDailyReviews}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 revisões</SelectItem>
                  <SelectItem value="20">20 revisões</SelectItem>
                  <SelectItem value="30">30 revisões</SelectItem>
                  <SelectItem value="50">50 revisões</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={saveStudyPrefs} disabled={savingPrefs} className="gap-2 gradient-primary text-primary-foreground">
              {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Preferências
            </Button>
          </motion.div>

          {/* Account actions */}
          <motion.div variants={item} className="rounded-xl border border-border bg-card p-6 space-y-1">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Ações da Conta</h2>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-foreground">Alterar Senha</p>
                <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                <Lock className="mr-2 h-4 w-4" /> Alterar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-foreground">Notificações</p>
                <p className="text-sm text-muted-foreground">Lembretes e alertas</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowNotifDialog(true)}>
                <Bell className="mr-2 h-4 w-4" /> Configurar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-destructive">Sair da Conta</p>
                <p className="text-sm text-muted-foreground">Encerrar sessão atual</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="text-destructive hover:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ===== Crop Dialog ===== */}
      <Dialog open={!!cropImage} onOpenChange={open => !open && setCropImage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Foto</DialogTitle>
            <DialogDescription>Arraste e ajuste o zoom para cortar sua foto</DialogDescription>
          </DialogHeader>
          <div ref={cropContainerRef} className="relative h-72 rounded-lg overflow-hidden bg-black">
            {cropImage && (
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                cropSize={cropSize ?? undefined}
                objectFit="contain"
                onMediaLoaded={setMediaSize}
                onCropChange={handleCropChange}
                onZoomChange={setZoom}
                onCropComplete={(_, area) => setCroppedArea(area)}
                zoomWithScroll={false}
                restrictPosition={false}
              />
            )}
          </div>
          {/* Zoom controls - Instagram/Facebook style */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                const newZoom = Math.max(0.5, zoom - 0.1);
                setZoom(newZoom);
                // Manter o centro da imagem focado
                setCrop({ x: 0, y: 0 });
              }}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider 
              min={0.5} 
              max={3} 
              step={0.05} 
              value={[zoom]} 
              onValueChange={v => {
                setZoom(v[0]);
                // Resetar posição para o centro ao usar o slider
                setCrop({ x: 0, y: 0 });
              }}
              className="flex-1" 
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                const newZoom = Math.min(3, zoom + 0.1);
                setZoom(newZoom);
                // Manter o centro da imagem focado
                setCrop({ x: 0, y: 0 });
              }}
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}
              title="Resetar"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Arraste para reposicionar • Use os botões ou slider para ajustar o zoom
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropImage(null)}>Cancelar</Button>
            <Button onClick={uploadCroppedAvatar} disabled={uploadingAvatar} className="gap-2">
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Password Dialog ===== */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite sua nova senha</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={changePassword} disabled={changingPassword} className="gap-2">
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Notifications Dialog ===== */}
      <Dialog open={showNotifDialog} onOpenChange={setShowNotifDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
            <DialogDescription>Configure seus lembretes e alertas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Lembretes de Estudo</p>
                  <p className="text-xs text-muted-foreground">Lembrete diário para estudar</p>
                </div>
              </div>
              <Switch checked={studyReminders} onCheckedChange={setStudyReminders} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notificações por E-mail</p>
                  <p className="text-xs text-muted-foreground">Novidades e lembretes por e-mail</p>
                </div>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notificações Push</p>
                  <p className="text-xs text-muted-foreground">Alertas no navegador</p>
                </div>
              </div>
              <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifDialog(false)}>Cancelar</Button>
            <Button onClick={saveNotifSettings} disabled={savingNotif} className="gap-2">
              {savingNotif ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
