import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { extname, resolve, sep } from 'path';
import {
  extensionsOf,
  LOCAL_UPLOAD_DIR,
} from 'src/common/config/upload.config';
import * as fs from 'fs';
import {
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// Only local uploads may be served. Anything else under the app directory
// (.env, source, node_modules) or outside it must stay unreachable.
const UPLOADS_ROOT = resolve(process.cwd(), LOCAL_UPLOAD_DIR);

// Types uploads can have (FILE_TYPES); everything else is an attachment.
const INLINE_EXTENSIONS = new Set(
  extensionsOf(['image', 'video']).map((ext) => `.${ext}`),
);

@ApiTags('Response')
@Controller('response')
export class ResponseController {
  @ApiOperation({ summary: 'Response' })
  @ApiParam({
    name: 'fileName',
    description:
      'Path of a local upload, as returned in file URLs. Forward slashes are encoded as a dollar sign (e.g. "src$public$uploads$banner$example.jpg"). Only files under src/public/uploads are served.',
  })
  @ApiProduces('*/*')
  @ApiResponse({
    status: 200,
    description: 'The raw file contents, streamed from local disk',
  })
  @ApiResponse({
    status: 404,
    description: 'File does not exist at the resolved path',
    schema: {
      properties: {
        code: { type: 'number', example: 404 },
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'File not found.' },
      },
    },
  })
  @Get(':fileName')
  async getFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = resolve(process.cwd(), fileName.replace(/\$/g, '/'));

    // resolve() collapses any "..", so a prefix check is enough to keep the
    // request inside the uploads folder.
    const insideUploads = filePath.startsWith(UPLOADS_ROOT + sep);

    try {
      if (!insideUploads) throw new Error('outside uploads');
      await fs.promises.access(filePath);
      // nosniff: browsers must trust the Content-Type. Anything that isn't
      // an image or video is downloaded, never rendered, so a file stored
      // before content checks existed (e.g. .html) can't run on this origin.
      const inline = INLINE_EXTENSIONS.has(extname(filePath).toLowerCase());
      return res.sendFile(filePath, {
        dotfiles: 'deny',
        headers: {
          'X-Content-Type-Options': 'nosniff',
          ...(inline ? {} : { 'Content-Disposition': 'attachment' }),
        },
      });
    } catch {
      return res.status(HttpStatus.NOT_FOUND).json({
        code: 404,
        status: 'errors',
        message: 'File not found.',
        data: null,
      });
    }
  }
}
