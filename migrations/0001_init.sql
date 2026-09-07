-- 두 사람만 사용하는 공유 앨범: 계정, 세션, 미디어, 태그, 커플 캘린더

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  content_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  -- EXIF 촬영일 우선, 없으면 업로드 시각 (타임라인 자동 정렬 기준)
  taken_at INTEGER NOT NULL,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  thumbnail_r2_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_media_taken_at ON media(taken_at DESC);
CREATE INDEX idx_media_owner_id ON media(owner_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE media_tags (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);
CREATE INDEX idx_media_tags_tag_id ON media_tags(tag_id);

-- 커플 기념일 / D-day / 일정
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date INTEGER NOT NULL,
  -- 'anniversary'는 매년 반복(D-day 카운터 대상), 'event'는 1회성 일정
  kind TEXT NOT NULL CHECK (kind IN ('anniversary', 'event')) DEFAULT 'event',
  repeat_yearly INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
