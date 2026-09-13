-- ============================================================
-- Supabase Storage 버킷 생성 및 보안 정책(RLS Policies) SQL
-- Supabase 대시보드의 [SQL Editor]에서 실행하세요.
-- ============================================================

-- 0. 버킷이 없는 경우 자동 생성 및 Public으로 설정
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ============================================================
-- 1) 'avatars' 버킷 정책 (Public 버킷)
-- ============================================================

-- 1-1. [SELECT] 누구나 avatars 버킷의 이미지 조회 가능
CREATE POLICY "Avatars Public Select"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 1-2. [INSERT] 로그인한 사용자만 본인 폴더(user_id 경로)에 이미지 업로드 가능
CREATE POLICY "Avatars Authenticated User Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 1-3. [UPDATE] 로그인한 사용자만 본인 폴더(user_id 경로)의 이미지 수정 가능
CREATE POLICY "Avatars Authenticated User Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- 2) 'chat-images' 버킷 정책 (Public 버킷)
-- ============================================================

-- 2-1. [SELECT] 누구나 chat-images 버킷의 이미지 조회 가능
CREATE POLICY "Chat Images Public Select"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- 2-2. [INSERT] 로그인한 사용자만 채팅 이미지 업로드 가능
CREATE POLICY "Chat Images Authenticated User Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');
