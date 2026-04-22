import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const c = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const KEY = "diagnostic/test-" + Date.now();
const url = await getSignedUrl(c, new PutObjectCommand({
  Bucket: process.env.R2_BUCKET, Key: KEY, ContentType: "application/octet-stream",
}), { expiresIn: 300 });
console.log("Presigned PUT URL:");
console.log(url);
console.log("\nQuery params:");
new URL(url).searchParams.forEach((v,k) => console.log(`  ${k}=${v.length>40?v.slice(0,40)+"...":v}`));

// Try PUTing some bytes
const body = new Uint8Array([1,2,3,4,5,6,7,8,9,10]);
const r = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "application/octet-stream" },
  body,
});
console.log("\nPUT response:", r.status, r.statusText);
if (!r.ok) console.log("Body:", await r.text());

// Verify and clean up
const head = await c.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: KEY }));
console.log("HEAD ContentLength:", head.ContentLength);
await c.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: KEY }));
console.log("Cleaned up.");
