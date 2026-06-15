const MAX_PROOF_DATA_URL_LENGTH = 4_500_000;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function validateDocumentProof(input: {
  dataUrl?: unknown;
  fileName?: unknown;
  fileType?: unknown;
}) {
  const dataUrl = typeof input.dataUrl === "string" ? input.dataUrl : "";
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const fileType = typeof input.fileType === "string" ? input.fileType.trim() : "";

  if (!dataUrl && !fileName && !fileType) {
    return null;
  }

  if (!dataUrl || !fileName || !fileType) {
    throw new Error("Document file, name, and type must be uploaded together");
  }
  if (!ALLOWED_PROOF_TYPES.has(fileType)) {
    throw new Error("Only JPG, PNG, WebP, or PDF files are allowed");
  }
  if (!dataUrl.startsWith(`data:${fileType};base64,`)) {
    throw new Error("Invalid document file");
  }
  if (dataUrl.length > MAX_PROOF_DATA_URL_LENGTH) {
    throw new Error("Document must be under 3 MB");
  }

  return { dataUrl, fileName, fileType };
}
