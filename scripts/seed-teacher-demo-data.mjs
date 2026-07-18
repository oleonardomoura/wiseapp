import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name] ?? (name === 'SUPABASE_URL' ? process.env.VITE_SUPABASE_URL : undefined);
  if (!value) throw new Error(`Variável ${name} não encontrada.`);
  return value;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const teacherEmail = 'demo.teacher@wisy.app';
const studentEmails = [
  'demo.student1@wisy.app',
  'demo.student2@wisy.app',
  'demo.student3@wisy.app',
  'demo.student4@wisy.app',
  'demo.student5@wisy.app',
  'demo.student6@wisy.app',
  'demo.student7@wisy.app',
  'demo.student8@wisy.app',
];

const classSeeds = [
  { suffix: 'Turma A - Iniciantes', level: 'A1', description: 'Turma demo para visualização de progresso inicial' },
  { suffix: 'Turma B - Intermediário', level: 'B1', description: 'Turma demo para acompanhar evolução intermediária' },
  { suffix: 'Turma C - Avançado', level: 'C1', description: 'Turma demo com desempenho avançado' },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function ensureUser(email, fullName, role) {
  const usersRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersRes.error) throw usersRes.error;
  const existing = usersRes.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await supabase.from('profiles').upsert({ id: existing.id, full_name: fullName, username: email, xp: randomInt(400, 4200) }, { onConflict: 'id' });
    await supabase.from('user_roles').upsert({ user_id: existing.id, role }, { onConflict: 'user_id,role' });
    return existing.id;
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password: 'Demo1234!',
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error('Erro ao criar usuário');

  await supabase.from('profiles').upsert(
    { id: created.data.user.id, full_name: fullName, username: email, xp: randomInt(400, 4200) },
    { onConflict: 'id' }
  );
  await supabase.from('user_roles').upsert({ user_id: created.data.user.id, role }, { onConflict: 'user_id,role' });
  return created.data.user.id;
}

async function clearOldDemoData(teacherId) {
  const demoClasses = await supabase
    .from('teacher_classes')
    .select('id')
    .eq('teacher_id', teacherId)
    .ilike('name', 'DEMO %');

  if (demoClasses.error) throw demoClasses.error;
  const classIds = (demoClasses.data ?? []).map((c) => c.id);
  if (classIds.length === 0) return;

  await supabase.from('class_notifications').delete().in('class_id', classIds);
  await supabase.from('live_sessions').delete().in('class_id', classIds);
  await supabase.from('conversation_groups').delete().in('class_id', classIds);
  await supabase.from('class_enrollments').delete().in('class_id', classIds);
  await supabase.from('teacher_classes').delete().in('id', classIds);
}

async function seedForTeacher(teacherId, studentIds) {
  const teacherTag = teacherId.slice(0, 6).toUpperCase();
  await clearOldDemoData(teacherId);

  const classInsert = await supabase.from('teacher_classes').insert(
    classSeeds.map((c) => ({
      name: `DEMO ${teacherTag} - ${c.suffix}`,
      level: c.level,
      description: c.description,
      teacher_id: teacherId,
    }))
  ).select('*');
  if (classInsert.error) throw classInsert.error;
  const classes = classInsert.data ?? [];

  const enrollmentRows = [];
  classes.forEach((cls, idx) => {
    const slice = studentIds.filter((_, i) => i % classes.length === idx || i % 2 === idx % 2);
    slice.forEach((studentId) => enrollmentRows.push({ class_id: cls.id, student_id: studentId }));
  });
  if (enrollmentRows.length) {
    const enr = await supabase.from('class_enrollments').insert(enrollmentRows);
    if (enr.error) throw enr.error;
  }

  const notifs = classes.flatMap((cls, i) => ([
    {
      class_id: cls.id,
      teacher_id: teacherId,
      title: 'Lembrete de estudo',
      message: `Turma ${cls.name}: revisem flashcards antes da próxima aula.`,
    },
    {
      class_id: cls.id,
      teacher_id: teacherId,
      title: 'Aula ao vivo confirmada',
      message: `A live desta semana da turma ${cls.name} já está disponível no menu Lives.`,
    },
    {
      class_id: cls.id,
      teacher_id: teacherId,
      title: 'Meta da semana',
      message: `Turma ${cls.name}: completar 2 textos e 30 revisões até sexta-feira.`,
    },
  ]));
  const notifInsert = await supabase.from('class_notifications').insert(notifs);
  if (notifInsert.error) throw notifInsert.error;

  const liveRows = classes.map((cls, i) => ({
    title: `Live DEMO - ${cls.name}`,
    description: `Sessão ao vivo de prática para ${cls.level}`,
    host_id: teacherId,
    class_id: cls.id,
    scheduled_at: nowPlusDays(i + 1),
    duration_minutes: 60 + i * 10,
    status: 'upcoming',
    meeting_url: 'https://meet.google.com/demo-wisy',
    level: cls.level,
  }));
  const liveInsert = await supabase.from('live_sessions').insert(liveRows);
  if (liveInsert.error) throw liveInsert.error;

  const groupRows = classes.map((cls, i) => ({
    class_id: cls.id,
    name: `Grupo DEMO - ${cls.level}`,
    description: `Grupo de conversação da ${cls.name}`,
    level: cls.level,
    max_members: 12 + i * 4,
    day_of_week: pick(['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira']),
    time_slot: pick(['18:30', '19:00', '19:30', '20:00']),
    teacher_id: teacherId,
    created_by: teacherId,
    meeting_url: 'https://meet.google.com/demo-group',
    next_session_at: nowPlusDays(i + 2),
  }));
  const groupInsert = await supabase.from('conversation_groups').insert(groupRows);
  if (groupInsert.error) throw groupInsert.error;

  const flashcardsRes = await supabase.from('flashcards').select('id').limit(120);
  if (flashcardsRes.error) throw flashcardsRes.error;
  const flashcardIds = (flashcardsRes.data ?? []).map((f) => f.id);

  const textsRes = await supabase.from('audio_texts').select('id').limit(20);
  if (textsRes.error) throw textsRes.error;
  const textIds = (textsRes.data ?? []).map((t) => t.id);

  const progressRows = [];
  studentIds.forEach((studentId, sIdx) => {
    for (let lessonId = 1; lessonId <= 24; lessonId++) {
      const completed = lessonId <= (8 + sIdx * 2);
      progressRows.push({
        user_id: studentId,
        module_id: Math.ceil(lessonId / 3),
        lesson_id: lessonId,
        oral_practice_completed: completed && lessonId % 2 === 0,
        consolidation_completed: completed && lessonId % 3 !== 0,
        completed,
        score: completed ? randomInt(68, 98) : randomInt(0, 45),
      });
    }
  });
  const courseUpsert = await supabase
    .from('course_progress')
    .upsert(progressRows, { onConflict: 'user_id,lesson_id' });
  if (courseUpsert.error) throw courseUpsert.error;

  const flashRows = [];
  studentIds.forEach((studentId, idx) => {
    flashcardIds.slice(0, 40 + idx * 5).forEach((flashcardId) => {
      const total = randomInt(5, 80);
      const correct = randomInt(Math.floor(total * 0.55), total);
      flashRows.push({
        user_id: studentId,
        flashcard_id: flashcardId,
        interval: randomInt(0, 30),
        repetitions: randomInt(0, 12),
        due_at: nowPlusDays(randomInt(-3, 10)),
        last_reviewed_at: nowPlusDays(randomInt(-12, -1)),
        total_reviews: total,
        correct_reviews: correct,
      });
    });
  });
  const flashUpsert = await supabase
    .from('flashcard_progress')
    .upsert(flashRows, { onConflict: 'user_id,flashcard_id' });
  if (flashUpsert.error) throw flashUpsert.error;

  const audioRows = [];
  studentIds.forEach((studentId, idx) => {
    textIds.slice(0, 6 + idx).forEach((textId) => {
      audioRows.push({
        user_id: studentId,
        text_id: textId,
        initial_score: randomInt(45, 88),
        final_score: randomInt(70, 100),
        completed: true,
        completed_at: nowPlusDays(randomInt(-20, -1)),
      });
    });
  });
  const audioUpsert = await supabase
    .from('audio_sessions')
    .upsert(audioRows, { onConflict: 'user_id,text_id' });
  if (audioUpsert.error) throw audioUpsert.error;

  const achievementKeys = ['streak_3', 'streak_7', 'first_live', 'text_master', 'flashcard_novice', 'course_sprinter'];
  const achievementRows = [];
  studentIds.forEach((studentId, idx) => {
    achievementKeys.slice(0, 3 + (idx % 3)).forEach((key) => {
      achievementRows.push({
        user_id: studentId,
        achievement_key: key,
        tier: pick(['bronze', 'silver', 'gold']),
        xp_earned: randomInt(20, 180),
      });
    });
  });
  const achUpsert = await supabase
    .from('user_achievements')
    .upsert(achievementRows, { onConflict: 'user_id,achievement_key' });
  if (achUpsert.error) throw achUpsert.error;

  return {
    teacherId,
    classes: classes.length,
    notifications: notifs.length,
    lives: liveRows.length,
    groups: groupRows.length,
  };
}

async function main() {
  await ensureUser('demo.admin@wisy.app', 'Admin Demo', 'admin');
  const demoTeacherId = await ensureUser(teacherEmail, 'Professor Demo', 'teacher');
  const studentIds = [];

  for (let i = 0; i < studentEmails.length; i++) {
    const id = await ensureUser(studentEmails[i], `Aluno Demo ${i + 1}`, 'student');
    studentIds.push(id);
  }

  const roleRowsRes = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['teacher', 'admin']);
  if (roleRowsRes.error) throw roleRowsRes.error;
  const teacherIds = [...new Set([demoTeacherId, ...(roleRowsRes.data ?? []).map(r => r.user_id)])];

  const results = [];
  for (const teacherId of teacherIds) {
    const r = await seedForTeacher(teacherId, studentIds);
    results.push(r);
  }

  console.log('Seed demo concluído');
  console.log({
    teacherEmail,
    studentCount: studentIds.length,
    teacherTargets: teacherIds.length,
    classRowsCreated: results.reduce((acc, r) => acc + r.classes, 0),
    notificationRowsCreated: results.reduce((acc, r) => acc + r.notifications, 0),
    liveRowsCreated: results.reduce((acc, r) => acc + r.lives, 0),
    groupRowsCreated: results.reduce((acc, r) => acc + r.groups, 0),
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
