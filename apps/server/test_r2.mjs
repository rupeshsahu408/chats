process.env.R2_ACCOUNT_ID = "test";
process.env.R2_ACCESS_KEY_ID = "AKIATEST";
process.env.R2_SECRET_ACCESS_KEY = "secrettest";
process.env.R2_BUCKET = "veil-media";
const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
const c = new S3Client({
  region: "auto",
  endpoint: `https://test.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secrettest" },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const url = await getSignedUrl(c, new PutObjectCommand({ Bucket: "veil-media", Key: "test/key", ContentType: "application/octet-stream" }), { expiresIn: 900 });
console.log(url);
console.log("\nhas-checksum-crc32:", url.includes("x-amz-checksum-crc32"));
console.log("has-sdk-checksum-algorithm:", url.includes("x-amz-sdk-checksum-algorithm"));
