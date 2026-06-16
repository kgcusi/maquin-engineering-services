import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 over the S3 API (docs/16 §5). Browser uploads go DIRECT via a
// presigned PUT (no streaming through a Function); reads via short-lived
// presigned GET. The `files` table tracks metadata; access is authorized by the
// caller before a URL is issued. Lazy client so missing creds don't crash import.
let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2_* environment variables are not set");
    }
    client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET ?? "";
}

/**
 * Presigned PUT for a direct browser → R2 upload, constrained to the declared
 * content-type and length so R2 rejects mismatched PUTs (docs/17 §5).
 */
export function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(s3(), command, { expiresIn });
}

/** Short-lived presigned GET for an authorized read. */
export function presignDownload(key: string, expiresIn = 300): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(s3(), command, { expiresIn });
}
