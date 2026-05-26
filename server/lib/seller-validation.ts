export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const INDIAN_PHONE_PATTERN = /^[6-9][0-9]{9}$/;
export const INDIAN_PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function normalizeTaxId(value?: string): string | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized || undefined;
}

export function validateSellerIdentity(input: {
  email: string;
  phone: string;
  gstin?: string;
  pan?: string;
  pincode: string;
}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return "Enter a valid email address";
  }

  if (!INDIAN_PHONE_PATTERN.test(input.phone)) {
    return "Enter a valid 10 digit Indian mobile number";
  }

  if (!INDIAN_PINCODE_PATTERN.test(input.pincode)) {
    return "Enter a valid 6 digit Indian pincode";
  }

  if (input.gstin && !GSTIN_PATTERN.test(input.gstin)) {
    return "Enter a valid 15 character GSTIN";
  }

  if (input.pan && !PAN_PATTERN.test(input.pan)) {
    return "Enter a valid 10 character PAN";
  }

  // if (!input.gstin && !input.pan) {
  //   return "GSTIN or PAN is required for seller onboarding";
  // }

  // if (input.gstin && input.pan && input.gstin.slice(2, 12) !== input.pan) {
  //   return "PAN must match characters 3 to 12 of GSTIN";
  // }

  return null;
}
