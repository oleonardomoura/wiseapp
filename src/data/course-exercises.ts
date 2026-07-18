// ── Oral Practice phrases per lesson ──
export interface OralPhrase {
  id: number;
  phrase: string;
  translation: string;
}

export interface ConsolidationExercise {
  id: number;
  prompt: string; // Portuguese
  answer: string; // Primary correct answer
  acceptable: string[]; // Other valid answers
}

export interface LessonExercises {
  oralPhrases: OralPhrase[];
  consolidation: ConsolidationExercise[];
}

// Map of lessonId -> exercises
export const lessonExercises: Record<number, LessonExercises> = {
  1: {
    oralPhrases: [
      { id: 1, phrase: "Hello, how are you?", translation: "Olá, como você está?" },
      { id: 2, phrase: "Good morning, nice to meet you.", translation: "Bom dia, prazer em conhecê-lo." },
      { id: 3, phrase: "Hi, my name is John.", translation: "Oi, meu nome é John." },
      { id: 4, phrase: "Good evening, how is it going?", translation: "Boa noite, como vai?" },
    ],
    consolidation: [
      { id: 1, prompt: "Olá, como você está?", answer: "Hello, how are you?", acceptable: ["Hi, how are you?", "Hey, how are you?"] },
      { id: 2, prompt: "Bom dia!", answer: "Good morning!", acceptable: ["Good morning"] },
      { id: 3, prompt: "Prazer em conhecê-lo.", answer: "Nice to meet you.", acceptable: ["Nice to meet you", "Pleased to meet you.", "Pleased to meet you"] },
      { id: 4, prompt: "Boa noite!", answer: "Good evening!", acceptable: ["Good evening", "Good night!"] },
    ],
  },
  2: {
    oralPhrases: [
      { id: 1, phrase: "My name is Maria and I am from Brazil.", translation: "Meu nome é Maria e eu sou do Brasil." },
      { id: 2, phrase: "I am twenty-five years old.", translation: "Eu tenho vinte e cinco anos." },
      { id: 3, phrase: "I live in São Paulo.", translation: "Eu moro em São Paulo." },
      { id: 4, phrase: "I am a student.", translation: "Eu sou estudante." },
      { id: 5, phrase: "What is your name?", translation: "Qual é o seu nome?" },
    ],
    consolidation: [
      { id: 1, prompt: "Meu nome é Ana.", answer: "My name is Ana.", acceptable: ["I am Ana.", "I'm Ana."] },
      { id: 2, prompt: "Eu sou do Brasil.", answer: "I am from Brazil.", acceptable: ["I'm from Brazil."] },
      { id: 3, prompt: "Eu tenho 20 anos.", answer: "I am twenty years old.", acceptable: ["I'm twenty years old.", "I am 20 years old.", "I'm 20 years old."] },
      { id: 4, prompt: "Qual é o seu nome?", answer: "What is your name?", acceptable: ["What's your name?"] },
      { id: 5, prompt: "Eu sou estudante.", answer: "I am a student.", acceptable: ["I'm a student."] },
    ],
  },
  3: {
    oralPhrases: [
      { id: 1, phrase: "Where are you from?", translation: "De onde você é?" },
      { id: 2, phrase: "What do you do for a living?", translation: "O que você faz da vida?" },
      { id: 3, phrase: "How old are you?", translation: "Quantos anos você tem?" },
      { id: 4, phrase: "Do you have any siblings?", translation: "Você tem irmãos?" },
    ],
    consolidation: [
      { id: 1, prompt: "De onde você é?", answer: "Where are you from?", acceptable: ["Where do you come from?"] },
      { id: 2, prompt: "O que você faz da vida?", answer: "What do you do for a living?", acceptable: ["What do you do?", "What is your job?"] },
      { id: 3, prompt: "Quantos anos você tem?", answer: "How old are you?", acceptable: [] },
      { id: 4, prompt: "Você tem irmãos?", answer: "Do you have any siblings?", acceptable: ["Do you have brothers or sisters?", "Do you have any brothers or sisters?"] },
    ],
  },
  4: {
    oralPhrases: [
      { id: 1, phrase: "Please and thank you.", translation: "Por favor e obrigado." },
      { id: 2, phrase: "Excuse me, can you help me?", translation: "Com licença, você pode me ajudar?" },
      { id: 3, phrase: "I am sorry.", translation: "Eu sinto muito." },
      { id: 4, phrase: "You are welcome.", translation: "De nada." },
    ],
    consolidation: [
      { id: 1, prompt: "Por favor.", answer: "Please.", acceptable: ["Please"] },
      { id: 2, prompt: "Obrigado.", answer: "Thank you.", acceptable: ["Thank you", "Thanks.", "Thanks"] },
      { id: 3, prompt: "Com licença.", answer: "Excuse me.", acceptable: ["Excuse me", "Pardon me."] },
      { id: 4, prompt: "De nada.", answer: "You are welcome.", acceptable: ["You're welcome.", "You're welcome", "No problem.", "No problem"] },
    ],
  },
  // Default fallback for lessons without specific exercises
};

// Get exercises for a lesson, with fallback
export function getExercisesForLesson(lessonId: number): LessonExercises {
  return lessonExercises[lessonId] || {
    oralPhrases: [
      { id: 1, phrase: "This is a practice sentence.", translation: "Esta é uma frase de prática." },
      { id: 2, phrase: "I am learning English.", translation: "Eu estou aprendendo inglês." },
      { id: 3, phrase: "Practice makes perfect.", translation: "A prática leva à perfeição." },
    ],
    consolidation: [
      { id: 1, prompt: "Eu estou aprendendo inglês.", answer: "I am learning English.", acceptable: ["I'm learning English."] },
      { id: 2, prompt: "A prática leva à perfeição.", answer: "Practice makes perfect.", acceptable: [] },
      { id: 3, prompt: "Esta é uma frase de prática.", answer: "This is a practice sentence.", acceptable: [] },
    ],
  };
}
