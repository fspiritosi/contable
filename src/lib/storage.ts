import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional: Custom domain or R2.dev subdomain

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.warn("Missing R2 environment variables. File upload will not work.");
}

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || "",
        secretAccessKey: R2_SECRET_ACCESS_KEY || "",
    },
});

export async function getPresignedUploadUrl(key: string, contentType: string) {
    if (!R2_BUCKET_NAME) throw new Error("R2_BUCKET_NAME not configured");

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(key: string) {
    if (!R2_BUCKET_NAME) throw new Error("R2_BUCKET_NAME not configured");

    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
}

export function getPublicUrl(key: string) {
    if (R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${key}`;
    }
    // If no public URL is configured, we might need presigned download URLs, 
    // but for now let's assume public access or return the key
    return key;
}
