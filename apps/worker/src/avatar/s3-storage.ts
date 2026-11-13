import { createS3Bucket, type S3Location } from "@sprachpilot/s3";
import { publicObjectUrl } from "@sprachpilot/shared";

import type { AvatarStorage } from "./process-avatar-job.js";

export function createS3AvatarStorage(location: S3Location): AvatarStorage {
  const bucket = createS3Bucket(location);
  return {
    put(input) {
      return bucket.put(input);
    },
    get(key) {
      return bucket.get(key);
    },
    delete(key) {
      return bucket.delete(key);
    },
    publicUrl(key) {
      return publicObjectUrl(location, key);
    },
  };
}
