/*
 *This file is part of the DTO validation messages for the application.
 * It contains validation messages in both English and Indonesian.
 * These messages are used to provide user-friendly error messages when validation fails on DTOs.
 */

export interface ValidationMessage {
  en: string;
  id: string;
}

export const VALIDATION_MESSAGES = {
  // String validations
  IS_NOT_EMPTY: {
    en: '$property cannot be empty',
    id: '$property tidak boleh kosong',
  },
  IS_STRING: {
    en: '$property must be a string',
    id: '$property harus berupa teks',
  },
  MIN_LENGTH: {
    en: '$property must be at least $constraint1 characters',
    id: '$property harus memiliki minimal $constraint1 karakter',
  },
  MAX_LENGTH: {
    en: '$property must not exceed $constraint1 characters',
    id: '$property tidak boleh lebih dari $constraint1 karakter',
  },

  // Number validations
  IS_NUMBER: {
    en: '$property must be a number',
    id: '$property harus berupa angka',
  },
  MIN: {
    en: '$property must not be less than $constraint1',
    id: '$property tidak boleh kurang dari $constraint1',
  },
  MAX: {
    en: '$property must not be greater than $constraint1',
    id: '$property tidak boleh lebih dari $constraint1',
  },

  // Date validations
  IS_DATE: {
    en: '$property must be a valid date',
    id: '$property harus berupa tanggal yang valid',
  },

  IS_DATE_STRING: {
    en: '$property must be a valid date',
    id: '$property harus berupa tanggal yang valid',
  },

  // Format validations
  IS_FORMAT_TIME_VALID: {
    en: '$property must be a valid time format (HH:mm:ss)',
    id: '$property harus berupa format waktu yang valid (HH:mm:ss)',
  },

  IS_FORMAT_CATEGORY_VALID: {
    en: '$property must be a valid category format (1-10)',
    id: '$property harus berupa format kategori yang valid (1-10)',
  },

  // Email validations
  IS_EMAIL: {
    en: '$property must be a valid email address',
    id: '$property harus berupa alamat email yang valid',
  },

  // Boolean validations
  IS_BOOLEAN: {
    en: '$property must be a boolean',
    id: '$property harus berupa boolean',
  },

  // Array validations
  IS_SAFE_LINK: {
    en: '$property must be an http(s) URL or a path starting with /',
    id: '$property harus berupa URL http(s) atau path yang diawali /',
  },
  IS_FILE_REFERENCE: {
    en: '$property must be an http(s) URL or a file uploaded to this app',
    id: '$property harus berupa URL http(s) atau file yang diunggah ke aplikasi ini',
  },
  IS_UUID: {
    en: '$property must be a valid ID',
    id: '$property harus berupa ID yang valid',
  },
  IS_ARRAY: {
    en: '$property must be an array',
    id: '$property harus berupa array',
  },
  ARRAY_MIN_SIZE: {
    en: '$property must contain at least $constraint1 elements',
    id: '$property harus berisi minimal $constraint1 elemen',
  },
  ARRAY_MAX_SIZE: {
    en: '$property cannot contain more than $constraint1 elements',
    id: '$property tidak boleh berisi lebih dari $constraint1 elemen',
  },

  // Object validations
  IS_OBJECT: {
    en: '$property must be an object',
    id: '$property harus berupa objek',
  },

  // ENUM validations
  IS_ENUM: {
    en: '$property must be one of the following values: $constraint1',
    id: '$property harus salah satu dari nilai berikut: $constraint1',
  },

  // Custom validations for specific fields
  PASSWORD_CRITERIA: {
    en: 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character',
    id: 'Kata sandi harus minimal 8 karakter, termasuk huruf besar, huruf kecil, angka dan karakter khusus',
  },
  PHONE_NUMBER_FORMAT: {
    en: 'Phone number must start with +628',
    id: 'Nomor telepon harus dimulai dengan +628',
  },
};
