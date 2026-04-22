import { trpcClientProxy } from "./trpcClientProxy";
import { encryptBlob, decryptBlob, bytesToBase64Std, base64ToBytesStd } from "./mediaCrypto";

export interface MediaAttachment {
  /** Discriminator inside a chat-message envelope. */
  kind: "image" | "voice";
  /** Server blob id. */
  blobId: string;
  /** Base64 raw 32-byte AES-GCM key. */
  key: string;
  mime: string;
  sizeBytes: number;
  /** Voice notes only. Milliseconds. */
  durationMs?: number;
  /** Images only. Pixel dimensions of the (possibly downscaled) image. */
  width?: number;
  height?: number;
  /** Inline thumbnail (base64 JPEG, ≤ ~5 KB). Only for images. */
  thumbB64?: string;
}

export async function uploadEncryptedMedia(
  bytes: Uint8Array,
  mime: string,
): Promise<{ blobId: string; key: string; sizeBytes: number }> {
  const enc = await encryptBlob(bytes);
  const result = await trpcClientProxy().media.upload.mutate({
    ciphertext: bytesToBase64Std(enc.ciphertext),
    mime,
  });
  return { blobId: result.blobId, key: enc.keyB64, sizeBytes: bytes.byteLength };
}

const blobUrlCache = new Map<string, string>();

export async function fetchAndDecryptMedia(
  attachment: MediaAttachment,
): Promise<string> {
  const cacheKey = `${attachment.blobId}:${attachment.key.slice(0, 16)}`;
  const hit = blobUrlCache.get(cacheKey);
  if (hit) return hit;

  const dl = await trpcClientProxy().media.download.query({
    blobId: attachment.blobId,
  });
  const ct = base64ToBytesStd(dl.ciphertext);
  const plain = await decryptBlob(ct, attachment.key);
  const blob = new Blob([plain.slice().buffer], { type: dl.mime || attachment.mime });
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(cacheKey, url);
  return url;
}

/** Downscale an image File so the longest edge is ≤ maxEdge px (JPEG, q≈0.85). */
export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!out) throw new Error("Image encode failed.");
  const buf = await out.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    mime: "image/jpeg",
    width,
    height,
  };
}

/** Tiny inline JPEG thumbnail, base64-encoded (no encryption — already inside an E2E message). */
export async function makeThumbnail(
  file: File | Blob,
  maxEdge = 96,
  quality = 0.6,
): Promise<{ thumbB64: string; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return {
      thumbB64: bytesToBase64Std(new Uint8Array(buf)),
      width,
      height,
    };
  } catch {
    return null;
  }
}
