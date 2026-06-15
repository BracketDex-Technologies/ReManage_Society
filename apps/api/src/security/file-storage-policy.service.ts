import { Injectable } from "@nestjs/common";
import { S3PresignedUrlService } from "./s3-presigned-url.service.js";

export interface FileStoragePolicyOptions {
  bucket?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  now?: () => Date;
  presigner?: Pick<S3PresignedUrlService, "presignPutObject">;
}

export interface UploadIntentInput {
  societyId: string;
  actorId: string;
  fileName: string;
  contentType: string;
}

export interface UploadIntent {
  bucket: string;
  method: "PUT";
  objectKey: string;
  contentType: string;
  expiresAt: string;
  signedUrl: string;
  requestedBy: string;
}

@Injectable()
export class FileStoragePolicyService {
  private readonly bucket: string;
  private readonly now: () => Date;
  private readonly presigner: Pick<S3PresignedUrlService, "presignPutObject">;

  constructor(options: FileStoragePolicyOptions = {}) {
    this.bucket = options.bucket ?? process.env.S3_BUCKET ?? "society-connect-local";
    this.now = options.now ?? (() => new Date());
    this.presigner = options.presigner ?? new S3PresignedUrlService({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
      endpoint: options.endpoint,
      now: this.now,
    });
  }

  createUploadIntent(input: UploadIntentInput): UploadIntent {
    const objectKey = `societies/${required(input.societyId, "societyId")}/uploads/${safeFileName(input.fileName)}`;
    const expiresAt = new Date(this.now().getTime() + 5 * 60_000).toISOString();

    return {
      bucket: this.bucket,
      method: "PUT",
      objectKey,
      contentType: required(input.contentType, "contentType"),
      expiresAt,
      signedUrl: this.presigner.presignPutObject({
        bucket: this.bucket,
        objectKey,
        contentType: input.contentType,
        expiresInSeconds: 300,
      }),
      requestedBy: required(input.actorId, "actorId"),
    };
  }
}

function safeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!normalized || normalized.includes("..")) {
    throw new Error("fileName is invalid");
  }

  return normalized;
}

function required(value: string, name: string): string {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value;
}
