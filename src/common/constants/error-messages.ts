/*
 * Error messages used across the application
 * This file contains error messages in both English and Indonesian
 * You can use these messages in your controllers, services, or anywhere else
 * by importing the ERROR_MESSAGES constant.
 * Example usage take a look to ErrorMessageHelper in src/common/helpers/error-message.helper
 */

export interface ErrorMessage {
  en: string;
  id: string;
}

export const ERROR_MESSAGES = {
  // Generic errors
  INTERNAL_SERVER_ERROR: {
    en: 'Internal server error occurred',
    id: 'Terjadi kesalahan pada server',
  },
  INVALID_DATE_FORMAT: {
    en: 'Invalid date. Use YYYY-MM-DD or an ISO 8601 datetime',
    id: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD atau format ISO 8601',
  },

  // Authentication errors
  INVALID_CREDENTIALS: {
    en: 'Invalid username or password',
    id: 'Username atau kata sandi tidak valid',
  },
  UNAUTHORIZED: {
    en: 'You are not authorized to access this page. Please login to continue',
    id: 'Anda tidak memiliki izin untuk mengakses halaman ini. Silahkan login untuk melanjutkan',
  },
  RULE_GRANT_FORBIDDEN: {
    en: 'You can only grant permissions that you have yourself',
    id: 'Anda hanya dapat memberikan izin yang Anda miliki sendiri',
  },
  ROOT_ADMIN_PROTECTED: {
    en: 'Only a root admin can change or delete a root admin',
    id: 'Hanya admin root yang dapat mengubah atau menghapus admin root',
  },
  ROOT_GROUP_ASSIGN_FORBIDDEN: {
    en: 'Only a root admin can add admins to the root group',
    id: 'Hanya admin root yang dapat menambahkan admin ke grup root',
  },
  CANNOT_DELETE_SELF: {
    en: 'You cannot delete your own account',
    id: 'Anda tidak dapat menghapus akun Anda sendiri',
  },
  CANNOT_DEACTIVATE_SELF: {
    en: 'You cannot deactivate your own account',
    id: 'Anda tidak dapat menonaktifkan akun Anda sendiri',
  },
  LAST_ROOT_ADMIN: {
    en: 'The last active root admin cannot be deleted or deactivated',
    id: 'Admin root aktif terakhir tidak dapat dihapus atau dinonaktifkan',
  },
  ACCESS_DENIED: {
    en: 'Sorry, you are unauthorized for {rule_name} in {module_name} module',
    id: 'Maaf, Anda tidak memiliki izin untuk {rule_name} di modul {module_name}',
  },
  TOKEN_EXPIRED: {
    en: 'Your session has expired. Please login again',
    id: 'Sesi Anda telah berakhir. Silakan masuk kembali',
  },
  PASSWORD_CRITERIA_NOT_MET: {
    en: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
    id: 'Kata sandi harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka, dan karakter khusus',
  },
  OLD_PASSWORD_INCORRECT: {
    en: 'The old password you entered is incorrect',
    id: 'Kata sandi lama yang Anda masukkan salah',
  },
  PASSWORD_DO_NOT_MATCH: {
    en: 'New password and confirm password do not match',
    id: 'Kata sandi baru dan konfirmasi kata sandi tidak cocok',
  },
  ACCOUNT_INACTIVE: {
    en: 'Your account is inactive. Please contact administrator',
    id: 'Akun Anda tidak aktif. Silakan hubungi administrator',
  },
  IMAGE_REQUIRED: {
    en: 'Image file is required',
    id: 'File gambar wajib diunggah',
  },

  // Password Reset Flow
  OTP_RESEND_DELAY: {
    en: 'Please wait before requesting another OTP',
    id: 'Silakan tunggu sebelum meminta OTP lagi',
  },
  INCORRECT_OTP: {
    en: 'The OTP you entered is incorrect',
    id: 'OTP yang Anda masukkan salah',
  },
  OTP_EXPIRED: {
    en: 'The OTP has expired. Please request a new one',
    id: 'OTP telah kedaluwarsa. Silakan minta yang baru',
  },
  OTP_ATTEMPTS_EXCEEDED: {
    en: 'Too many incorrect attempts. Please request a new OTP',
    id: 'Terlalu banyak percobaan yang salah. Silakan minta OTP baru',
  },
  RESET_PASSWORD_TOKEN_INVALID: {
    en: 'Invalid or expired password reset token',
    id: 'Token reset kata sandi tidak valid atau telah kedaluwarsa',
  },

  // Group and Module related errors
  ADMIN_GROUP_DETAIL_NOT_FOUND: {
    en: 'Admin group detail not found',
    id: 'Detail grup admin tidak ditemukan',
  },
  ADMIN_GROUP_NOT_FOUND: {
    en: 'Admin group "Admin" not found. Please seed it first',
    id: 'Grup admin "Admin" tidak ditemukan. Silakan lakukan seed terlebih dahulu',
  },
  ADMIN_GROUP_NOT_DELETED: {
    en: 'Admin group was not deleted',
    id: 'Grup admin tidak dihapus',
  },
  ADMIN_GROUP_NAME_EXISTS: {
    en: 'Admin group name already exists. Please choose a different name',
    id: 'Nama grup admin sudah ada. Silakan pilih nama yang berbeda',
  },

  // Admin specific errors
  ADMIN_NOT_FOUND: {
    en: 'Admin not found',
    id: 'Admin tidak ditemukan',
  },
  ADMIN_NOT_DELETED: {
    en: 'Admin was not deleted',
    id: 'Admin tidak dihapus',
  },
  USERNAME_EXISTS: {
    en: 'Username already exists. Please choose a different username',
    id: 'Nama pengguna sudah ada. Silakan pilih nama pengguna yang berbeda',
  },

  // User specific errors
  USER_NOT_FOUND: {
    en: 'User not found',
    id: 'Pengguna tidak ditemukan',
  },
  USER_NOT_DELETED: {
    en: 'User was not deleted',
    id: 'Pengguna tidak dihapus',
  },

  // Module specific errors
  MODULE_NOT_FOUND: {
    en: 'Module not found',
    id: 'Modul tidak ditemukan',
  },
  MODULE_NOT_DELETED: {
    en: 'Module was not deleted',
    id: 'Modul tidak dihapus',
  },
  MODULE_NAME_EXISTS: {
    en: 'Module name already exists. Please choose a different name',
    id: 'Nama modul sudah ada. Silakan pilih nama yang berbeda',
  },

  // Module Rule specific errors
  MODULE_RULE_NOT_FOUND: {
    en: 'Module rule not found',
    id: 'Module Rule tidak ditemukan',
  },
  MODULE_RULE_NOT_DELETED: {
    en: 'Module rule was not deleted',
    id: 'Module Rule tidak dihapus',
  },
  MODULE_RULE_ALREADY_EXISTS: {
    en: 'Module rule already exists for this module. Please choose a different name',
    id: 'Module Rule sudah ada untuk modul ini. Silakan pilih nama yang berbeda',
  },

  // Banner specific errors
  BANNER_NOT_FOUND: {
    en: 'Banner not found',
    id: 'Banner tidak ditemukan',
  },
  BANNER_NOT_DELETED: {
    en: 'Banner was not deleted',
    id: 'Banner tidak dihapus',
  },
  INVALID_BANNER_POSITION: {
    en: 'Invalid position. Maximum position is {maxPosition}',
    id: 'Posisi tidak valid. Posisi maksimum adalah {maxPosition}',
  },

  // File upload errors
  // Generic: {field} is the property name (see isFileReference)
  FILE_REFERENCE_INVALID: {
    en: '{field} must be an http(s) URL or a file uploaded to this app',
    id: '{field} harus berupa URL http(s) atau file yang diunggah ke aplikasi ini',
  },
  UNSUPPORTED_FILE_CONTENT: {
    en: 'The file is not a supported image or video. Allowed: PNG, JPEG, WebP (and MP4, MOV, AVI, WMV, FLV, MKV, WebM where videos are accepted)',
    id: 'File bukan gambar atau video yang didukung. Diizinkan: PNG, JPEG, WebP (serta MP4, MOV, AVI, WMV, FLV, MKV, WebM jika video diterima)',
  },
  INVALID_FILE_TYPE: {
    en: 'Invalid file type. Only .xlsx and .csv files are allowed',
    id: 'Jenis file tidak valid. Hanya file .xlsx dan .csv yang diperbolehkan',
  },
  FILE_REQUIRED: {
    en: 'File is required',
    id: 'File wajib diunggah',
  },
  NO_DATA_FOUND: {
    en: 'No data found in the file',
    id: 'Tidak ada data yang ditemukan dalam file',
  },
  NO_WORKSHEET_FOUND: {
    en: 'No worksheet found in the Excel file',
    id: 'Tidak ada worksheet yang ditemukan dalam file Excel',
  },
  IMPORT_TOO_MANY_ROWS: {
    en: 'The file has too many rows. The maximum is {max} per import',
    id: 'File memiliki terlalu banyak baris. Maksimal {max} baris per impor',
  },
  IMPORT_INVALID_BOOLEAN: {
    en: '{field} must be true/false, yes/no, 1/0 or active/inactive',
    id: '{field} harus berupa true/false, yes/no, 1/0 atau active/inactive',
  },
  FAQ_PARENT_CYCLE: {
    en: 'A FAQ cannot be moved under itself or one of its own children',
    id: 'FAQ tidak dapat dipindahkan ke bawah dirinya sendiri atau turunannya',
  },
  FAQ_PARENT_DELETED: {
    en: 'Restore the parent FAQ first',
    id: 'Pulihkan FAQ induk terlebih dahulu',
  },
  // Database errors mapped by GlobalExceptionFilter ({field} = column)
  DUPLICATE_ENTRY: {
    en: 'A record with this {field} already exists',
    id: 'Data dengan {field} ini sudah ada',
  },
  RECORD_NOT_FOUND: {
    en: 'The record was not found or has been deleted',
    id: 'Data tidak ditemukan atau sudah dihapus',
  },
  VALUE_TOO_LONG: {
    en: 'The value for {field} is too long',
    id: 'Nilai untuk {field} terlalu panjang',
  },
  INVALID_REFERENCE: {
    en: 'The referenced record does not exist or is still in use',
    id: 'Data yang dirujuk tidak ada atau masih digunakan',
  },
  INVALID_VALUE: {
    en: 'One of the values has an invalid format',
    id: 'Salah satu nilai memiliki format yang tidak valid',
  },
  FILE_PARSE_ERROR: {
    en: 'Error parsing file. Please check the file format',
    id: 'Kesalahan saat membaca file. Silakan periksa format file',
  },
  MEDIA_URL_REQUIRED: {
    en: 'Media URL is required',
    id: 'URL media wajib diisi',
  },
  NO_VALID_DATA_TO_IMPORT: {
    en: 'No valid data to import',
    id: 'Tidak ada data valid untuk diimpor',
  },
  VALIDATION_ERRORS_FOUND: {
    en: 'Validation errors found. Please fix the errors in your file and try again',
    id: 'Ditemukan kesalahan validasi. Silakan perbaiki kesalahan dalam file Anda dan coba lagi',
  },

  // FAQ specific errors
  FAQ_NOT_FOUND: {
    en: 'FAQ not found',
    id: 'FAQ tidak ditemukan',
  },
  FAQ_NOT_DELETED: {
    en: 'FAQ was not deleted',
    id: 'FAQ tidak dihapus',
  },
  PARENT_FAQ_NOT_FOUND: {
    en: 'Parent FAQ not found',
    id: 'FAQ induk tidak ditemukan',
  },
  INVALID_FAQ_POSITION: {
    en: 'Invalid position. Maximum position is {maxPosition}',
    id: 'Posisi tidak valid. Posisi maksimum adalah {maxPosition}',
  },
  TOO_MANY_REQUESTS: {
    en: 'Too many requests. Please try again later.',
    id: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  },
  APP_UNDER_MAINTENANCE: {
    en: 'The application is currently under maintenance. Please try again later.',
    id: 'Aplikasi sedang dalam pemeliharaan. Silakan coba lagi nanti.',
  },
  DECRYPTION_FAILED: {
    en: 'Failed to decrypt payload.',
    id: 'Gagal mendekripsi data.',
  },

  // Global Config errors
  GLOBAL_CONFIG_NOT_FOUND: {
    en: 'Global config not found',
    id: 'Konfigurasi global tidak ditemukan',
  },
  GLOBAL_CONFIG_KEY_ALREADY_EXISTS: {
    en: 'A config with this key already exists',
    id: 'Konfigurasi dengan kunci ini sudah ada',
  },

  // User account state errors
  FORCE_LOGGED_OUT: {
    en: 'Your account has been signed in on another device',
    id: 'Akun Anda telah masuk di perangkat lain',
  },
  USER_PHONE_EXISTS: {
    en: 'This phone number is already registered',
    id: 'Nomor telepon ini sudah terdaftar',
  },
  EMAIL_ALREADY_EXISTS: {
    en: 'This email is already used by another account',
    id: 'Email ini sudah digunakan oleh akun lain',
  },
  USER_EMAIL_EXISTS: {
    en: 'This email is already registered',
    id: 'Email ini sudah terdaftar',
  },
  USER_NOT_ACTIVE: {
    en: 'Your account has not been verified yet',
    id: 'Akun Anda belum diverifikasi',
  },
  USER_ALREADY_ACTIVE: {
    en: 'Your account is already active',
    id: 'Akun Anda sudah aktif',
  },
  MUST_ACCEPT_TNC: {
    en: 'You must accept the Terms and Conditions to continue',
    id: 'Anda harus menyetujui Syarat dan Ketentuan untuk melanjutkan',
  },
  MUST_ACCEPT_PP: {
    en: 'You must accept the Privacy Policy to continue',
    id: 'Anda harus menyetujui Kebijakan Privasi untuk melanjutkan',
  },

  // OTP / password errors
  OTP_INVALID: {
    en: 'The verification code is invalid',
    id: 'Kode verifikasi tidak valid',
  },
  WEAK_PASSWORD: {
    en: 'Password is too weak. Please choose a stronger password',
    id: 'Kata sandi terlalu lemah. Silakan pilih kata sandi yang lebih kuat',
  },
  PASSWORD_NOT_SET: {
    en: 'No password has been set for this account',
    id: 'Akun ini belum memiliki kata sandi',
  },
  INCORRECT_PASSWORD: {
    en: 'The password you entered is incorrect',
    id: 'Kata sandi yang Anda masukkan salah',
  },
  PASSWORD_CONFIRM_MISMATCH: {
    en: 'Password and confirmation password do not match',
    id: 'Kata sandi dan konfirmasi kata sandi tidak cocok',
  },

  // Google auth errors
  GOOGLE_TOKEN_INVALID: {
    en: 'Google authentication failed. Please try again',
    id: 'Autentikasi Google gagal. Silakan coba lagi',
  },
  GOOGLE_SESSION_EXPIRED: {
    en: 'Google Sign In session has expired. Please sign in again',
    id: 'Sesi Google Sign In telah berakhir. Silakan masuk kembali',
  },
  GOOGLE_PHONE_EXISTS: {
    en: 'This phone number is already registered to another account',
    id: 'Nomor telepon ini sudah terdaftar di akun lain',
  },

  // Apple auth errors
  APPLE_TOKEN_FORMAT_INVALID: {
    en: 'Invalid Apple token format',
    id: 'Format token Apple tidak valid',
  },
  APPLE_TOKEN_DECODE_FAILED: {
    en: 'Failed to decode Apple token',
    id: 'Gagal mendekode token Apple',
  },
  APPLE_TOKEN_ISSUER_INVALID: {
    en: 'Apple token issuer is invalid',
    id: 'Issuer token Apple tidak valid',
  },
  APPLE_TOKEN_AUDIENCE_INVALID: {
    en: 'Apple token audience is invalid',
    id: 'Audience token Apple tidak valid',
  },
  APPLE_TOKEN_EXPIRED: {
    en: 'Apple token has expired. Please sign in again',
    id: 'Token Apple telah kedaluwarsa. Silakan masuk kembali',
  },
  APPLE_TOKEN_SUB_MISMATCH: {
    en: 'Apple user identifier does not match',
    id: 'Identifikasi pengguna Apple tidak cocok',
  },
  APPLE_TOKEN_SIGNATURE_INVALID: {
    en: 'Apple token signature is invalid',
    id: 'Tanda tangan token Apple tidak valid',
  },
  APPLE_PUBLIC_KEY_NOT_FOUND: {
    en: 'Apple public key not found',
    id: 'Kunci publik Apple tidak ditemukan',
  },
  APPLE_SESSION_EXPIRED: {
    en: 'Apple Sign In session has expired. Please sign in again',
    id: 'Sesi Apple Sign In telah berakhir. Silakan masuk kembali',
  },
  APPLE_PHONE_EXISTS: {
    en: 'This phone number is already registered to another account',
    id: 'Nomor telepon ini sudah terdaftar di akun lain',
  },

  // Media upload errors
  VIDEO_REQUIRED: {
    en: 'Video file is required',
    id: 'File video wajib diunggah',
  },
  VIDEO_URL_REQUIRED: {
    en: 'Video URL is required',
    id: 'URL video wajib diisi',
  },
};
