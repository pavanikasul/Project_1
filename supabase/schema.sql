-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  mobile TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  id_proof_type TEXT,
  id_proof_number TEXT,
  city TEXT,
  state TEXT,
  exam_slot TIMESTAMP WITH TIME ZONE,
  face_photo_url TEXT,
  id_photo_url TEXT,
  role TEXT DEFAULT 'candidate' CHECK (role IN ('candidate', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EXAMS table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  negative_marking FLOAT DEFAULT 0,
  cutoff INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QUESTIONS table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  topic TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  type TEXT NOT NULL CHECK (type IN ('MCQ', 'MSQ', 'TF', 'FIB')),
  question_text TEXT NOT NULL,
  options JSONB, -- For MCQ/MSQ: ["Option A", "Option B", ...]
  correct_answer JSONB, -- For MCQ: "Option A", MSQ: ["A", "B"], TF: true/false, FIB: "answer"
  marks INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SUBMISSIONS table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES profiles(id),
  exam_id UUID REFERENCES exams(id),
  score FLOAT DEFAULT 0,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'submitted', 'flagged')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  violation_count INTEGER DEFAULT 0
);

-- ANSWERS table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  selected_answer JSONB,
  is_correct BOOLEAN,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VIOLATIONS table
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  details TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: add details column if upgrading an existing violations table
DO $$ BEGIN
  ALTER TABLE violations ADD COLUMN IF NOT EXISTS details TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS Policies (Basic)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Candidates can see their own profile
DO $$ BEGIN
    CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow candidates to insert their own profile
DO $$ BEGIN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow candidates to update their own profile
DO $$ BEGIN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow public/admin read access to profiles so the admin dashboard can fetch registrations
DO $$ BEGIN
    CREATE POLICY "Allow public read access to profiles for admin dashboard" ON profiles FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Everyone can see published exams
DO $$ BEGIN
    CREATE POLICY "Anyone can view published exams" ON exams FOR SELECT USING (status = 'published');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Submissions policies (Public/Anon friendly for local fallback)
DO $$ BEGIN
    CREATE POLICY "Public insert submissions" ON submissions FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public update submissions" ON submissions FOR UPDATE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public select submissions" ON submissions FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public delete submissions" ON submissions FOR DELETE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Violations policies
DO $$ BEGIN
    CREATE POLICY "Public insert violations" ON violations FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public update violations" ON violations FOR UPDATE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public select violations" ON violations FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public delete violations" ON violations FOR DELETE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Answers policies
DO $$ BEGIN
    CREATE POLICY "Public insert answers" ON answers FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public update answers" ON answers FOR UPDATE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public select answers" ON answers FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public delete answers" ON answers FOR DELETE USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
