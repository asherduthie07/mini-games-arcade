-- MULTIPLAYER MINI-GAMES PLATFORM SCHEMA SETUP
-- Run this script in the Supabase SQL Editor to configure all tables, RLS policies, and enable Realtime sync.

-- 1. CLEAN UP EXISTING (Optional debug run)
-- DROP TABLE IF EXISTS game_events CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS players CASCADE;
-- DROP TABLE IF EXISTS rooms CASCADE;

-- 2. CREATE TABLES

-- Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  game_state JSONB DEFAULT '{}'::jsonb NOT NULL,
  current_game VARCHAR(50) DEFAULT 'Obstacle Dash' NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby' NOT NULL, -- 'lobby', 'playing', 'finished'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Players Table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY, -- Matches anonymous user ID or local client UUID
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  x_position FLOAT DEFAULT 0 NOT NULL,
  y_position FLOAT DEFAULT 0 NOT NULL,
  velocity JSONB DEFAULT '{"x": 0, "y": 0}'::jsonb NOT NULL,
  score INTEGER DEFAULT 0 NOT NULL,
  ready BOOLEAN DEFAULT false NOT NULL,
  finished BOOLEAN DEFAULT false NOT NULL,
  connected BOOLEAN DEFAULT true NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  username VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Game Events Table (for dynamic items, crashes, boosts, etc.)
CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES (Allowing anonymous/public operations)
-- Rooms Policies
ONCE_DROP_POLICY_ROOMS:
DROP POLICY IF EXISTS "Public Select Rooms" ON rooms;
CREATE POLICY "Public Select Rooms" ON rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Rooms" ON rooms;
CREATE POLICY "Public Insert Rooms" ON rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Rooms" ON rooms;
CREATE POLICY "Public Update Rooms" ON rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Rooms" ON rooms;
CREATE POLICY "Public Delete Rooms" ON rooms FOR DELETE USING (true);

-- Players Policies
DROP POLICY IF EXISTS "Public Select Players" ON players;
CREATE POLICY "Public Select Players" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Players" ON players;
CREATE POLICY "Public Insert Players" ON players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Players" ON players;
CREATE POLICY "Public Update Players" ON players FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Players" ON players;
CREATE POLICY "Public Delete Players" ON players FOR DELETE USING (true);

-- Messages Policies
DROP POLICY IF EXISTS "Public Select Messages" ON messages;
CREATE POLICY "Public Select Messages" ON messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Messages" ON messages;
CREATE POLICY "Public Insert Messages" ON messages FOR INSERT WITH CHECK (true);

-- Game Events Policies
DROP POLICY IF EXISTS "Public Select Game Events" ON game_events;
CREATE POLICY "Public Select Game Events" ON game_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Game Events" ON game_events;
CREATE POLICY "Public Insert Game Events" ON game_events FOR INSERT WITH CHECK (true);

-- 5. ENABLE REALTIME BROADCASTS (Extremely critical for player position sync)
-- Drop existing publications to prevent duplicates if any, then add tables
begin;
  -- If publication exists, we can append columns. In Supabase UI, adding tables is safest via:
  alter publication supabase_realtime add table rooms;
  alter publication supabase_realtime add table players;
  alter publication supabase_realtime add table messages;
  alter publication supabase_realtime add table game_events;
commit;
