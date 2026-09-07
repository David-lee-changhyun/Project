-- 사용자가 직접 만드는 앨범 + 사진 좋아요

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE album_media (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (album_id, media_id)
);
CREATE INDEX idx_album_media_media_id ON album_media(media_id);

ALTER TABLE media ADD COLUMN liked_at INTEGER;
CREATE INDEX idx_media_liked_at ON media(liked_at);
