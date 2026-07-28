import { supabase } from '@/lib/supabase';

export type ImageFolder = 'banners' | 'activities' | 'reference-images' | 'logos';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadResult {
  url: string;
  path: string;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Upload an image file to the content-images bucket.
 * Returns the public URL and storage path.
 * Throws UploadError for validation or network failures.
 */
export async function uploadImage(file: File, folder: ImageFolder): Promise<UploadResult> {
  if (!ACCEPTED.includes(file.type)) {
    throw new UploadError('Unsupported format. Use JPG, PNG, WebP, or GIF.');
  }
  if (file.size > MAX_SIZE) {
    throw new UploadError('File too large. Maximum size is 5MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from('content-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new UploadError(error.message || 'Upload failed. Please try again.');
  }

  const { data } = supabase.storage.from('content-images').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Remove an image from storage by its public path.
 * Best-effort: fails silently if the file was an external URL.
 */
export async function removeImage(path: string): Promise<void> {
  if (!path) return;
  await supabase.storage.from('content-images').remove([path]);
}

/**
 * Extract the storage path from a public URL, if it belongs to our bucket.
 * Returns null for external URLs (pasted links).
 */
export function pathFromUrl(url: string): string | null {
  const marker = '/content-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
