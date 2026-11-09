import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { HttpError } from './errors';

const configured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Signed direct upload: the app uploads the image straight to Cloudinary,
 * so large files never pass through (or slow down) our free Render server.
 */
export function createUploadSignature(userId: string) {
  if (!configured) throw new HttpError(503, 'Image uploads are not configured on the server', 'UPLOADS_DISABLED');
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${env.CLOUDINARY_FOLDER}/scenarios/${userId}`;
  const paramsToSign = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);
  return {
    timestamp,
    folder,
    signature,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

/** Only accept image URLs/public IDs that belong to our Cloudinary account + folder. */
export function isOwnCloudinaryAsset(url: string, publicId: string, userId: string): boolean {
  return (
    url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`) &&
    publicId.startsWith(`${env.CLOUDINARY_FOLDER}/scenarios/${userId}/`)
  );
}

export async function deleteImage(publicId: string | null | undefined) {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('Cloudinary delete failed', err);
  }
}
