export type Requirement = {
  id: string;
  text: string;
  kind: string; 
  priority: 'must' | 'nice';
};

export type Question = {
  id: string;
  requirement_ids: string[];
  category: string; 
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  is_edited?: boolean;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  confidence: 1 | 3 | 5 | null;
  is_edited?: boolean;
};

export type FullKit = {
  _id: string;
  source: {
    company: string;
    company_url: string;
    role: string;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    hiring_process?: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: {
      day: number;
      focus: string;
      question_ids: string[];
      minutes: number;
    }[];
  };
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
};