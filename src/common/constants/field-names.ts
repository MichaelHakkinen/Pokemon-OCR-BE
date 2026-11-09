export interface FieldTranslation {
  en: string; // Translated field name in English
  id: string; // Translated field name in Indonesian
  name: string; // Original input/property name
}

export const FIELD_NAMES: { [key: string]: FieldTranslation } = {
  fullname: {
    en: 'Full Name',
    id: 'Nama Lengkap',
    name: 'fullname',
  },
  email: {
    en: 'Email',
    id: 'Email',
    name: 'email',
  },
  phoneNumber: {
    en: 'Phone Number',
    id: 'Nomor Telepon',
    name: 'phoneNumber',
  },
  password: {
    en: 'Password',
    id: 'Kata Sandi',
    name: 'password',
  },
  username: {
    en: 'Username',
    id: 'Nama Pengguna',
    name: 'username',
  },
  otp: {
    en: 'OTP',
    id: 'OTP',
    name: 'otp',
  },
  isActive: {
    en: 'Is Active',
    id: 'Aktif',
    name: 'isActive',
  },
  oldPassword: {
    en: 'Old Password',
    id: 'Kata Sandi Lama',
    name: 'oldPassword',
  },
  newPassword: {
    en: 'New Password',
    id: 'Kata Sandi Baru',
    name: 'newPassword',
  },
  confirmNewPassword: {
    en: 'Confirm New Password',
    id: 'Konfirmasi Kata Sandi Baru',
    name: 'confirmNewPassword',
  },

  // Auth tokens
  token: { en: 'Token', id: 'Token', name: 'token' },
  refreshToken: {
    en: 'Refresh Token',
    id: 'Refresh Token',
    name: 'refreshToken',
  },
  idToken: { en: 'ID Token', id: 'ID Token', name: 'idToken' },
  tempToken: {
    en: 'Temporary Token',
    id: 'Token Sementara',
    name: 'tempToken',
  },
  fcmToken: { en: 'FCM Token', id: 'FCM Token', name: 'fcmToken' },

  // Device
  deviceId: { en: 'Device ID', id: 'ID Perangkat', name: 'deviceId' },
  platform: { en: 'Platform', id: 'Platform', name: 'platform' },

  // Legal consent
  acceptTnc: {
    en: 'Accept Terms and Conditions',
    id: 'Setuju Syarat dan Ketentuan',
    name: 'acceptTnc',
  },
  acceptPp: {
    en: 'Accept Privacy Policy',
    id: 'Setuju Kebijakan Privasi',
    name: 'acceptPp',
  },

  // Profile
  avatar: { en: 'Avatar', id: 'Avatar', name: 'avatar' },
  subtitle: { en: 'Subtitle', id: 'Subjudul', name: 'subtitle' },
  label: { en: 'Label', id: 'Label', name: 'label' },

  // Identity
  userId: { en: 'User ID', id: 'ID Pengguna', name: 'userId' },
  id: { en: 'ID', id: 'ID', name: 'id' },
  parentId: { en: 'Parent ID', id: 'ID Induk', name: 'parentId' },
  adminGroupId: {
    en: 'Admin Group ID',
    id: 'ID Grup Admin',
    name: 'adminGroupId',
  },
  moduleId: { en: 'Module ID', id: 'ID Modul', name: 'moduleId' },
  modules: { en: 'Modules', id: 'Modul', name: 'modules' },
  moduleRuleIds: {
    en: 'Module Rule IDs',
    id: 'ID Aturan Modul',
    name: 'moduleRuleIds',
  },
  groups: { en: 'Groups', id: 'Grup', name: 'groups' },
  groupLabel: { en: 'Group Label', id: 'Label Grup', name: 'groupLabel' },

  // Generic fields
  status: { en: 'Status', id: 'Status', name: 'status' },
  type: { en: 'Type', id: 'Tipe', name: 'type' },
  code: { en: 'Code', id: 'Kode', name: 'code' },
  key: { en: 'Key', id: 'Kunci', name: 'key' },
  value: { en: 'Value', id: 'Nilai', name: 'value' },
  message: { en: 'Message', id: 'Pesan', name: 'message' },
  confirmText: {
    en: 'Confirmation Text',
    id: 'Teks Konfirmasi',
    name: 'confirmText',
  },
  force: { en: 'Force', id: 'Paksa', name: 'force' },
  position: { en: 'Position', id: 'Posisi', name: 'position' },
  newPosition: { en: 'New Position', id: 'Posisi Baru', name: 'newPosition' },

  // Temporal fields
  startAt: { en: 'Start At', id: 'Mulai Pada', name: 'startAt' },
  endAt: { en: 'End At', id: 'Berakhir Pada', name: 'endAt' },
  startDate: { en: 'Start Date', id: 'Tanggal Mulai', name: 'startDate' },
  endDate: { en: 'End Date', id: 'Tanggal Selesai', name: 'endDate' },
  startTime: { en: 'Start Time', id: 'Waktu Mulai', name: 'startTime' },
  endTime: { en: 'End Time', id: 'Waktu Selesai', name: 'endTime' },
  scheduledAt: {
    en: 'Scheduled At',
    id: 'Dijadwalkan Pada',
    name: 'scheduledAt',
  },
  validUntil: { en: 'Valid Until', id: 'Berlaku Hingga', name: 'validUntil' },
  validUntilType: {
    en: 'Valid Until Type',
    id: 'Tipe Berlaku Hingga',
    name: 'validUntilType',
  },

  // Media / file
  mediaType: { en: 'Media Type', id: 'Tipe Media', name: 'mediaType' },
  mediaUrl: { en: 'Media URL', id: 'URL Media', name: 'mediaUrl' },
  downloadUrl: { en: 'Download URL', id: 'URL Unduhan', name: 'downloadUrl' },
  targetUrl: { en: 'Target URL', id: 'URL Target', name: 'targetUrl' },
  filename: { en: 'File Name', id: 'Nama File', name: 'filename' },
  mimetype: { en: 'MIME Type', id: 'Tipe MIME', name: 'mimetype' },
  file_size: { en: 'File Size', id: 'Ukuran File', name: 'file_size' },
  width: { en: 'Width', id: 'Lebar', name: 'width' },
  height: { en: 'Height', id: 'Tinggi', name: 'height' },
  isFile: { en: 'Is File', id: 'Adalah File', name: 'isFile' },
  totalChunks: {
    en: 'Total Chunks',
    id: 'Total Potongan',
    name: 'totalChunks',
  },
};
