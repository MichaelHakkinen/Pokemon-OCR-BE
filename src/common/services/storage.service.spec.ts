import { UnprocessableEntityException } from '@nestjs/common';
import fs from 'fs';
import * as path from 'path';
import { testConfig } from '../config/config.testing';
import { StorageService } from './storage.service';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const MP4 = Buffer.concat([
  Buffer.from('\0\0\0\x18ftypisom', 'latin1'),
  Buffer.alloc(32),
]);
const HTML = Buffer.from(
  '<!doctype html><script>alert(document.domain)</script>',
);
const file = (buffer: Buffer, originalname: string, mimetype: string): any => ({
  buffer,
  originalname,
  mimetype,
  size: buffer.length,
});

describe('StorageService', () => {
  const uploads = path.join(process.cwd(), 'src', 'public', 'uploads');
  let s3: any;
  let obs: any;

  const make = (disk = 'local') => {
    s3 = {
      uploadFile: jest.fn(
        async () => 'https://bucket.s3.region.amazonaws.com/x',
      ),
      extractKeyFromUrl: (url: string) => url.split('.amazonaws.com/')[1] || '',
      deleteFileByUrl: jest.fn(async () => undefined),
    };
    obs = { deleteFile: jest.fn(async () => true) };
    const service = new StorageService(
      testConfig({
        DISK_STORAGE: disk,
        ...(disk === 's3'
          ? {
              AWS_REGION: 'r',
              AWS_ACCESS_KEY_ID: 'a',
              AWS_SECRET_ACCESS_KEY: 's',
              AWS_S3_BUCKET_NAME: 'b',
            }
          : disk === 'obs'
            ? {
                OBS_ACCESS_KEY_ID: 'a',
                OBS_SECRET_ACCESS_KEY: 's',
                OBS_ENDPOINT: 'obs.ap-southeast-1.myhuaweicloud.com',
                OBS_BUCKET_NAME: 'b',
                OBS_DOMAIN_NAME: 'cdn.example.com',
              }
            : {}),
      }) as any,
      s3,
      obs,
    );
    jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);
    return service;
  };

  afterEach(() => jest.restoreAllMocks());

  describe('uploadFile', () => {
    it('rejects HTML disguised as a PNG', async () => {
      const service = make();
      await expect(
        service.uploadFile(file(HTML, 'x.html', 'image/png'), {
          folder: 'avatar-admin',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a video where only images are accepted', async () => {
      const service = make();
      await expect(
        service.uploadFile(file(MP4, 'clip.mp4', 'video/mp4'), {
          folder: 'avatar-admin',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('names the file after its real content, not the client filename', async () => {
      const service = make();
      const write = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => undefined);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const stored = await service.uploadFile(
        file(PNG, 'evil.html', 'text/html'),
        {
          folder: 'avatar-admin',
          prefix: 'admin',
        },
      );
      expect(stored).toMatch(
        /^src\/public\/uploads\/avatar-admin\/admin-.*\.png$/,
      );
      expect(write).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), PNG);
    });

    it('never reuses a stored name, even with the same customName', async () => {
      const service = make();
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const upload = () =>
        service.uploadFile(file(PNG, 'a.png', 'image/png'), {
          folder: 'banner',
          customName: 'Home Banner',
        });
      const [a, b] = await Promise.all([upload(), upload()]);
      expect(a).toMatch(/\/home-banner-\d+-[0-9a-f]{8}\.png$/);
      expect(a).not.toBe(b);
    });

    it('accepts videos for media uploads and passes the real type to S3', async () => {
      const service = make('s3');
      await service.uploadFile(file(MP4, 'a.png', 'image/png'), {
        folder: 'banner',
        accept: ['image', 'video'],
      });
      const passed = s3.uploadFile.mock.calls[0][0];
      expect(passed.mimetype).toBe('video/mp4');
      expect(passed.originalname).toBe('upload.mp4');
    });
  });

  describe('deleteFile', () => {
    it.each([
      '../../.env',
      'src/public/../../.env',
      'src/public/uploads/../../../package.json',
      'src/public/uploads/banner/../../../../etc/passwd',
      'https://evil.example.com/banner/x.png',
      'src/public/uploads/elsewhere/x.png',
    ])('refuses to delete %s', async (target) => {
      const service = make();
      const unlink = jest
        .spyOn(fs, 'unlinkSync')
        .mockImplementation(() => undefined);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      await expect(service.deleteFile(target)).resolves.toBe(false);
      expect(unlink).not.toHaveBeenCalled();
    });

    it('deletes files inside a managed upload folder', async () => {
      const service = make();
      const unlink = jest
        .spyOn(fs, 'unlinkSync')
        .mockImplementation(() => undefined);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      await expect(
        service.deleteFile('src/public/uploads/banner/banner-x-1.png'),
      ).resolves.toBe(true);
      expect(unlink).toHaveBeenCalledWith(
        path.join(uploads, 'banner', 'banner-x-1.png'),
      );
    });

    it('on S3, only deletes keys in managed folders', async () => {
      const service = make('s3');
      await expect(
        service.deleteFile('https://b.s3.r.amazonaws.com/backups/db.sql'),
      ).resolves.toBe(false);
      await expect(
        service.deleteFile('https://b.s3.r.amazonaws.com/banner/a.png'),
      ).resolves.toBe(true);
      expect(s3.deleteFileByUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFile on OBS', () => {
    it.each([
      [
        'the custom CDN domain',
        'https://cdn.example.com/banner/home%20banner-1-ab.png',
        'banner/home banner-1-ab.png',
      ],
      [
        'the bucket domain',
        'https://b.obs.ap-southeast-1.myhuaweicloud.com/banner/a-1-ab.png',
        'banner/a-1-ab.png',
      ],
    ])('extracts the key from %s', async (_, url, key) => {
      const service = make('obs');
      // URL-decoded path, not the full URL (which isManagedKey would refuse)
      expect((service as any).extractObsFileName(url)).toBe(key);
    });

    it('deletes CDN-domain URLs and refuses foreign hosts', async () => {
      const service = make('obs');
      await expect(
        service.deleteFile('https://cdn.example.com/banner/a-1-ab.png'),
      ).resolves.toBe(true);
      expect(obs.deleteFile).toHaveBeenCalledWith('banner/a-1-ab.png');
      await expect(
        service.deleteFile('https://evil.example.com/banner/a-1-ab.png'),
      ).resolves.toBe(false);
      expect(obs.deleteFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('withUpload', () => {
    const run = (
      save: () => Promise<string>,
      replaces: string | null = 'src/public/uploads/avatar-admin/old.png',
    ) => {
      const service = make();
      jest
        .spyOn(service, 'uploadFile')
        .mockResolvedValue('src/public/uploads/avatar-admin/new.png');
      const del = jest.spyOn(service, 'deleteFile').mockResolvedValue(true);
      const result = service.withUpload(
        {
          file: file(PNG, 'a.png', 'image/png'),
          options: { folder: 'avatar-admin' },
          replaces,
        },
        save,
      );
      return { result, del };
    };

    it('deletes the old file only after the save succeeds', async () => {
      const { result, del } = run(async () => 'saved');
      await expect(result).resolves.toBe('saved');
      expect(del).toHaveBeenCalledWith(
        'src/public/uploads/avatar-admin/old.png',
      );
      expect(del).toHaveBeenCalledTimes(1);
    });

    it('keeps the old file and removes the new upload when the save fails', async () => {
      const { result, del } = run(async () => {
        throw new Error('db failed');
      });
      await expect(result).rejects.toThrow('db failed');
      expect(del).toHaveBeenCalledWith(
        'src/public/uploads/avatar-admin/new.png',
      );
      expect(del).not.toHaveBeenCalledWith(
        'src/public/uploads/avatar-admin/old.png',
      );
    });

    it('skips upload and deletes when there is no new file', async () => {
      const service = make();
      const upload = jest.spyOn(service, 'uploadFile');
      const del = jest.spyOn(service, 'deleteFile');
      const save = jest.fn(async (ref: string | null) => ref);
      await expect(
        service.withUpload(
          { file: null, options: { folder: 'avatar-admin' }, replaces: 'x' },
          save,
        ),
      ).resolves.toBeNull();
      expect(upload).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });
  });
});
