/*
 * Success messages used across the application
 * This file contains success messages in English and Indonesian
 * Import the `SUCCESS_MESSAGES` constant to get multi-language success messages.
 */

export interface SuccessMessage {
  en: string;
  id: string;
}

export const SUCCESS_MESSAGES = {
  DEFAULT_MESSAGE: {
    en: 'Success',
    id: 'Berhasil',
  },

  DATA_RETRIEVED_SUCCESS: {
    en: 'Data retrieved successfully',
    id: 'Data berhasil diambil',
  },
  DATA_CREATED_SUCCESS: {
    en: 'Data created successfully',
    id: 'Data berhasil dibuat',
  },
  DATA_UPDATED_SUCCESS: {
    en: 'Data updated successfully',
    id: 'Data berhasil diperbarui',
  },
  DATA_DELETED_SUCCESS: {
    en: 'Data deleted successfully',
    id: 'Data berhasil dihapus',
  },
  DATA_RESTORED_SUCCESS: {
    en: 'Data restored successfully',
    id: 'Data berhasil dipulihkan',
  },

  // Specific success messages
  PASSWORD_CHANGED_SUCCESS: {
    en: 'Password changed successfully',
    id: 'Kata sandi berhasil diubah',
  },
  PROFILE_UPDATED_SUCCESS: {
    en: 'Profile updated successfully',
    id: 'Profil berhasil diperbarui',
  },
  AVATAR_UPDATED_SUCCESS: {
    en: 'Avatar updated successfully',
    id: 'Avatar berhasil diperbarui',
  },
  TOKEN_REFRESHED_SUCCESS: {
    en: 'Token refreshed successfully',
    id: 'Token berhasil diperbarui',
  },

  LOGIN_SUCCESS: {
    en: 'Login successful',
    id: 'Berhasil masuk',
  },
  LOGOUT_SUCCESS: {
    en: 'Logout successful',
    id: 'Berhasil keluar',
  },

  OTP_SENT_SUCCESS: {
    en: 'OTP sent successfully to the email',
    id: 'OTP berhasil dikirim ke email',
  },
  OTP_VERIFIED_SUCCESS: {
    en: 'OTP verified successfully',
    id: 'OTP berhasil diverifikasi',
  },
  PASSWORD_RESET_SUCCESS: {
    en: 'Password reset successfully',
    id: 'Kata sandi berhasil direset',
  },

  // Sorting success messages
  SORTING_UPDATED_SUCCESS: {
    en: 'Sorting updated successfully',
    id: 'Pengurutan berhasil diperbarui',
  },

  // Auth success messages
  REGISTER_SUCCESS: {
    en: 'Account created successfully. Please verify your account',
    id: 'Akun berhasil dibuat. Silakan verifikasi akun Anda',
  },
  GOOGLE_LOGIN_SUCCESS: {
    en: 'Signed in with Google successfully',
    id: 'Berhasil masuk dengan Google',
  },
  APPLE_LOGIN_SUCCESS: {
    en: 'Signed in with Apple successfully',
    id: 'Berhasil masuk dengan Apple',
  },
  ACCOUNT_DELETED_SUCCESS: {
    en: 'Account deleted successfully',
    id: 'Akun berhasil dihapus',
  },

  // Notification success messages
  NOTIFICATION_READ_SUCCESS: {
    en: 'Notification marked as read',
    id: 'Notifikasi ditandai sudah dibaca',
  },
  NOTIFICATION_READ_ALL_SUCCESS: {
    en: 'All notifications marked as read',
    id: 'Semua notifikasi ditandai sudah dibaca',
  },
  NOTIFICATION_DELETED_SUCCESS: {
    en: 'Notification deleted successfully',
    id: 'Notifikasi berhasil dihapus',
  },
  NOTIFICATION_DELETED_ALL_SUCCESS: {
    en: 'All notifications cleared successfully',
    id: 'Semua notifikasi berhasil dihapus',
  },
};
