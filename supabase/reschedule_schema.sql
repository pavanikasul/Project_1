-- RESCHEDULE REQUESTS table
CREATE TABLE IF NOT EXISTS reschedule_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  candidate_id_val TEXT NOT NULL,
  previous_slot TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT NOT NULL,
  explanation TEXT,
  preferred_date DATE NOT NULL,
  preferred_slot TEXT NOT NULL,
  supporting_doc_name TEXT,
  new_slot_time TIMESTAMP WITH TIME ZONE,  -- exact datetime assigned by admin on approval
  status TEXT DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected', 'New Slot Assigned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: add new_slot_time column if upgrading an existing table
DO $$ BEGIN
  ALTER TABLE reschedule_requests ADD COLUMN IF NOT EXISTS new_slot_time TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migration: update CHECK constraint to include 'New Slot Assigned'
ALTER TABLE reschedule_requests
  DROP CONSTRAINT IF EXISTS reschedule_requests_status_check;
ALTER TABLE reschedule_requests
  ADD CONSTRAINT reschedule_requests_status_check
  CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected', 'New Slot Assigned'));

-- Enable RLS for security
ALTER TABLE reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Allow candidates to view and insert their own reschedule requests
DO $$ BEGIN
    CREATE POLICY "Users can view own reschedule requests" ON reschedule_requests 
        FOR SELECT USING (auth.uid() = candidate_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own reschedule requests" ON reschedule_requests 
        FOR INSERT WITH CHECK (auth.uid() = candidate_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to perform all operations
DO $$ BEGIN
    CREATE POLICY "Admins have full access to reschedule requests" ON reschedule_requests
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
