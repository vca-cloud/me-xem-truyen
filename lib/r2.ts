import "server-only";

/** Server-only R2 configuration skeleton. Add an S3-compatible client when uploads are implemented. */
export const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: process.env.R2_PUBLIC_URL,
};

export function getR2PublicUrl(key: string) {
  const base = r2Config.publicUrl?.replace(/\/$/, "");
  return base ? `${base}/${key.replace(/^\//, "")}` : undefined;
}
