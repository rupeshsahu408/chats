import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

let cachedClient: S3Client | null = null;

export function r2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
  );
}

export function missingR2Config(): string[] {
  const missing: string[] = [];
  if (!env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!env.R2_BUCKET) missing.push("R2_BUCKET");
  return missing;
}

function client(): S3Client {
  if (cachedClient) return cachedClient;
  if (!r2Configured()) {
    throw new Error(
      `R2 is not configured. Missing: ${missingR2Config().join(", ")}`,
    );
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

const UPLOAD_CONTENT_TYPE = "application/octet-stream";

export async function presignUpload(
  key: string,
  ttlSeconds = 15 * 60,
): Promise<{ url: string; contentType: string; expiresAt: Date }> {
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    ContentType: UPLOAD_CONTENT_TYPE,
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn: ttlSeconds });
  return {
    url,
    contentType: UPLOAD_CONTENT_TYPE,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export async function presignDownload(
  key: string,
  ttlSeconds = 5 * 60,
): Promise<{ url: string; expiresAt: Date }> {
  const cmd = new GetObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn: ttlSeconds });
  return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}

export async function headObject(
  key: string,
): Promise<{ exists: boolean; sizeBytes: number }> {
  try {
    const out = await client().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }),
    );
    return { exists: true, sizeBytes: Number(out.ContentLength ?? 0) };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return { exists: false, sizeBytes: 0 };
    throw err;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // R2/S3 caps DeleteObjects at 1000 per request.
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }
  for (const chunk of chunks) {
    await client().send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET!,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }
}
