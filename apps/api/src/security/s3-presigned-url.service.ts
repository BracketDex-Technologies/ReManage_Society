import { createHmac, createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface S3PresignedUrlOptions {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;
  now?: () => Date;
}

export interface PresignPutObjectInput {
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresInSeconds: number;
}

@Injectable()
export class S3PresignedUrlService {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly now: () => Date;

  constructor(options: S3PresignedUrlOptions = {}) {
    this.accessKeyId = options.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? "";
    this.secretAccessKey = options.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? "";
    this.region = options.region ?? process.env.S3_REGION ?? "us-east-1";
    this.endpoint = options.endpoint ?? process.env.S3_ENDPOINT ?? "http://localhost:9000";
    this.now = options.now ?? (() => new Date());
  }

  presignPutObject(input: PresignPutObjectInput): string {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error("S3 credentials are required for presigning");
    }

    const issuedAt = this.now();
    const amzDate = formatAmzDate(issuedAt);
    const dateStamp = amzDate.slice(0, 8);
    const url = new URL(`${this.endpoint.replace(/\/$/, "")}/${input.bucket}/${input.objectKey}`);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const signedHeaders = "host";
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(input.expiresInSeconds),
      "X-Amz-SignedHeaders": signedHeaders,
    });
    const canonicalRequest = [
      "PUT",
      url.pathname,
      query.toString(),
      `host:${url.host}`,
      "",
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = hmacHex(signingKey(this.secretAccessKey, dateStamp, this.region), stringToSign);

    query.set("X-Amz-Signature", signature);
    url.search = query.toString();
    return url.toString();
  }
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}
