import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ErrorMessageHelper } from './error-message.helper';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Encrypts plaintext using AES-256-GCM with a 32-byte hex key.
 * Output format: ivHex:authTagHex:ciphertextHex
 */
export function encryptPayload(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts an AES-256-GCM payload produced by encryptPayload.
 * Throws BadRequestException if the payload is malformed or tampered.
 */
export function decryptPayload(encrypted: string, keyHex: string): string {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    throw new BadRequestException(
      ErrorMessageHelper.getMultiLanguageMessage('DECRYPTION_FAILED'),
    );
  }
}
