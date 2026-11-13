import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface S3Location {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

export interface StoredObject {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export interface S3Bucket {
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

/** One S3 client for the API upload and the worker that publishes avatars. */
export function createS3Bucket(location: S3Location): S3Bucket {
  const client = new S3Client({
    region: location.region,
    endpoint: location.endpoint,
    forcePathStyle: location.forcePathStyle,
    credentials: {
      accessKeyId: location.accessKeyId,
      secretAccessKey: location.secretAccessKey,
    },
  });

  return {
    async put(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: location.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
        }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: location.bucket, Key: key }),
        );
        const bytes = await result.Body?.transformToByteArray();
        if (!bytes) return null;
        return {
          body: Buffer.from(bytes),
          contentType: result.ContentType ?? "application/octet-stream",
          cacheControl: result.CacheControl ?? "",
        };
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: location.bucket, Key: key }));
    },
  };
}
