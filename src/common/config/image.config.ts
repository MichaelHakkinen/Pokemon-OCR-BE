import { UnprocessableEntityException } from '@nestjs/common';
import {
  extensionsOf,
  LOCAL_UPLOAD_DIR,
  mimeRegexOf,
  UPLOAD_SIZE_LIMITS,
} from './upload.config';

// Multer pre-checks used by controllers, derived from upload.config.ts so
// types and limits are defined once. These only check what the client
// *claims*; StorageService.uploadFile() verifies the actual content.
export const defaultMaxFileSize = UPLOAD_SIZE_LIMITS.image;

export const defaultMaxVideoFileSize = UPLOAD_SIZE_LIMITS.video;

export const defaultImageDestination = `./${LOCAL_UPLOAD_DIR}`;

export const defaultAllowedImageTypes = extensionsOf(['image']);

export const defaultAllowedImageTypeRegex = mimeRegexOf(['image']);

export const defaultAllowedVideoTypes = extensionsOf(['video']);

export const defaultAllowedVideoTypeRegex = mimeRegexOf(['video']);

export const defaultAllowedMediaTypes = extensionsOf(['image', 'video']);

export const defaultAllowedMediaTypeRegex = mimeRegexOf(['image', 'video']);

export const defaultAllowedFileTypes = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
];

export const invalidMimesType = (allowedTypes: string[], key: string[]) => {
  const errors = key.map((item) => {
    return {
      [item]: [
        `Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`,
      ],
    };
  });

  throw new UnprocessableEntityException({
    errors,
  });
};
