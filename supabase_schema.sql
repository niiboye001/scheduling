-- Supabase Schema for ShiftMaster

-- 1. Create custom enum for Roles
CREATE TYPE user_role AS ENUM ('ADMIN', 'EMPLOYEE');

-- 2. Create Users Table (Extends Supabase Auth optionally, but standalone for now)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role user_role DEFAULT 'EMPLOYEE'::user_role NOT NULL,
  off_days INTEGER[], -- Null means no schedule set yet
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Availabilities Table
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('Available', 'Unavailable', 'Partial')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date) -- A user can only have one status per day
);

-- Add updated_at trigger functionality
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
-- Anyone authenticated can read profiles (so the calendar can show names)
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- RLS Policies for Availabilities
-- Anyone can see availabilities
CREATE POLICY "Availabilities are viewable by everyone" ON public.availabilities FOR SELECT USING (true);

-- Employees can ONLY insert/update their OWN availabilities
CREATE POLICY "Users can insert their own availability" ON public.availabilities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability" ON public.availabilities
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Enable Realtime on the availabilities table
ALTER PUBLICATION supabase_realtime ADD TABLE public.availabilities;
