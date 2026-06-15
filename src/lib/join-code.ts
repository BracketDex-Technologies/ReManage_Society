const CODE_SUFFIX_LENGTH = 4;

export function normalizeJoinCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateJoinCode(societyName: string) {
  const prefix =
    societyName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "SOCIETY";

  const suffix = Math.floor(Math.random() * 10 ** CODE_SUFFIX_LENGTH)
    .toString()
    .padStart(CODE_SUFFIX_LENGTH, "0");

  return `${prefix}${suffix}`;
}
