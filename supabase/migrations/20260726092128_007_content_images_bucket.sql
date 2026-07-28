/*
# Little Minds — Content images storage bucket

## Purpose
Create a public Supabase Storage bucket for admin-uploaded content images
(banners, activity reference images). The admin panel gets direct file upload
capability alongside the existing paste-a-link option.

## Storage setup
1. Creates a bucket named `content-images` (public, 50MB file size limit).
2. Organizes uploads into folders: `banners/`, `activities/`,
   `reference-images/`. Folder structure is enforced by the upload helper
   using the path prefix — no DB-level folder definitions are needed.
3. Storage policies allow authenticated users to read all objects (public
   bucket) and super admins to upload/update/delete. Teachers read via the
   public bucket URL — no auth header needed.

## Security
- The bucket is PUBLIC so teachers' browsers can load images directly via
  the public URL without an auth header. This is appropriate for content
   images (banners, reference images) that are meant to be seen.
- WRITE access (insert/update/delete) is restricted to super admins via the
  `is_super_admin()` helper, matching the existing RLS pattern for content.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-images', 'content-images', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- SELECT (read) — public bucket, any authenticated user can read.
DROP POLICY IF EXISTS "content_images_read" ON storage.objects;
CREATE POLICY "content_images_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'content-images');

-- INSERT — only super admins can upload.
DROP POLICY IF EXISTS "content_images_insert" ON storage.objects;
CREATE POLICY "content_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-images' AND is_super_admin());

-- UPDATE — only super admins can replace.
DROP POLICY IF EXISTS "content_images_update" ON storage.objects;
CREATE POLICY "content_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content-images' AND is_super_admin())
  WITH CHECK (bucket_id = 'content-images' AND is_super_admin());

-- DELETE — only super admins can remove.
DROP POLICY IF EXISTS "content_images_delete" ON storage.objects;
CREATE POLICY "content_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-images' AND is_super_admin());
