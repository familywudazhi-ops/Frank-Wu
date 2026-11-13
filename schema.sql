-- Trade Balance Live / 貿易平衡全民搶答
-- Cloudflare D1 schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS class_sessions (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL DEFAULT '教師',
  status TEXT NOT NULL DEFAULT 'lobby',
  question_index INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'zh',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  hint_level INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  score_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON question_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_player ON question_attempts(player_id);

