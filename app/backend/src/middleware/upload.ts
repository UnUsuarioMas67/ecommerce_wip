import type { RequestHandler } from 'express';
import multer from 'multer';

import { HttpError } from '../lib/errors.js';
import {
  isAllowedImageMimeType,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
} from '../services/product-images.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: MAX_PRODUCT_IMAGES },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImageMimeType(file.mimetype)) {
      callback(new HttpError(400, 'Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    callback(null, true);
  },
});

export const uploadProductImages: RequestHandler = (req, res, next) => {
  parser.array('images', MAX_PRODUCT_IMAGES)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new HttpError(
            400,
            `Each image must be at most ${MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB`,
          ),
        );
        return;
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        next(new HttpError(400, `At most ${MAX_PRODUCT_IMAGES} images can be uploaded at once`));
        return;
      }
      next(new HttpError(400, error.message));
      return;
    }
    next(error as Error | undefined);
  });
};
