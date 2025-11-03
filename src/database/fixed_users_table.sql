-- Fixed Users Table Schema
-- This version makes password optional since Supabase Auth handles passwords

-- Drop existing users table if needed
-- DROP TABLE IF EXISTS users CASCADE;

-- Create users table without password constraint
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Optional since Supabase Auth handles this
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','customer','kitchen','delivery','cashier','stores')) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- If table already exists, you can alter it to make password nullable
-- ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Add some sample data for testing
INSERT INTO users (email, name, role) VALUES 
  ('admin@egumenieats.com', 'System Admin', 'admin'),
  ('kitchen@egumenieats.com', 'Kitchen Staff', 'kitchen'),
  ('customer@egumenieats.com', 'Test Customer', 'customer')
ON CONFLICT (email) DO NOTHING;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'password';