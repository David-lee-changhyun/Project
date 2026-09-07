-- 완전히 동일한 파일이 여러 번 업로드됐는지 찾기 위한 콘텐츠 해시(SHA-256)
ALTER TABLE media ADD COLUMN content_hash TEXT;
CREATE INDEX idx_media_content_hash ON media(content_hash);
