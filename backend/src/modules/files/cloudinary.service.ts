import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { createHash } from 'crypto';
import streamifier from 'streamifier';
import { businessRule, fileTooLarge, unsupportedMedia } from '../../common';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;
  private readonly allowed: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.allowed = new Set(
      (this.config.get<string>('UPLOAD_ALLOWED_MIME') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    );
  }

  onModuleInit(): void {
    const name = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const key = this.config.get<string>('CLOUDINARY_API_KEY');
    const secret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (name && key && secret) {
      cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
      this.configured = true;
      this.logger.log('Cloudinary configured');
    } else {
      this.logger.warn('Cloudinary not configured — file uploads will fail until env vars are set');
    }
  }

  validateSize(bytes: number): void {
    const max = this.config.get<number>('UPLOAD_MAX_BYTES')!;
    if (bytes > max) throw fileTooLarge(`Max size is ${Math.round(max / 1024 / 1024)} MB`);
  }

  validateMime(mime: string): void {
    if (!this.allowed.has(mime)) {
      throw unsupportedMedia(`MIME type ${mime} is not allowed`);
    }
  }

  /**
   * Upload a buffer to Cloudinary. Returns the API response.
   * @param folder override the default folder (e.g. "vendorbridge/rfq/abc")
   */
  uploadBuffer(
    buffer: Buffer,
    filename: string,
    mime: string,
    folderOverride?: string,
  ): Promise<UploadApiResponse> {
    if (!this.configured) throw businessRule('Cloudinary is not configured');
    const folder = folderOverride ?? this.config.get<string>('CLOUDINARY_FOLDER')!;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: this.resourceTypeFor(mime),
          public_id: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`,
          use_filename: false,
          unique_filename: true,
        },
        (err, res) => {
          if (err || !res) return reject(err ?? new Error('No response from Cloudinary'));
          resolve(res);
        },
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });
  }

  async destroy(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'raw'): Promise<void> {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  }

  checksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private resourceTypeFor(mime: string): 'image' | 'raw' {
    if (mime.startsWith('image/')) return 'image';
    return 'raw';
  }
}
