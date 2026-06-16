export const PHONE_INPUT_MAX_LENGTH = 10;

export const phoneInputProps = {
  type: "tel",
  inputMode: "numeric",
  maxLength: PHONE_INPUT_MAX_LENGTH,
  pattern: "\\d{10}",
} as const;

export function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, PHONE_INPUT_MAX_LENGTH);
}

export function isTenDigitPhone(value: string | null | undefined) {
  return /^\d{10}$/.test(value ?? "");
}

export function isOptionalTenDigitPhone(value: string | null | undefined) {
  return !value || isTenDigitPhone(value);
}
