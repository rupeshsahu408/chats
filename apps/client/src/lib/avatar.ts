/**
 * Resize an arbitrary user-supplied image (any browser-decodable
 * format) down to a square JPEG data URL no larger than ~64 KB,
 * suitable for inlining into the user row as their profile photo.
 */
export async function resizeAvatarToDataUrl(
  file: File,
  maxSize = 256,
  maxBytes = 60 * 1024,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = maxSize;
  canvas.height = maxSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, maxSize, maxSize);

  // Iteratively lower JPEG quality until the encoded payload fits.
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}
