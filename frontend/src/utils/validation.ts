import { ALLOWED_TYPES, MAX_FILE_SIZE } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Client-side validation — backend always re-validates */
export function validateUploadFile(file: File): ValidationResult {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload PDF, JPG, JPEG, or PNG.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File exceeds the 10 MB size limit.',
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png'];
  if (!ext || !allowedExt.includes(ext)) {
    return {
      valid: false,
      error: 'Unsupported file extension.',
    };
  }

  return { valid: true };
}
