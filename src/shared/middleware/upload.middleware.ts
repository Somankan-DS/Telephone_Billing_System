import { Request, Response, NextFunction } from 'express';

export interface UploadedFile {
  filename?: string;
  content: string;
  buffer: Buffer;
}

declare global {
  namespace Express {
    interface Request {
      file?: UploadedFile;
    }
  }
}

/**
 * Lightweight, zero-dependency multipart/form-data & text/csv stream parser for CSV uploads.
 */
export function parseCsvUpload(req: Request, _res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const text = buffer.toString('utf-8');

      // Extract boundary from Content-Type header
      const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = match ? match[1] || match[2] : null;

      if (boundary) {
        const parts = text.split(`--${boundary}`);
        for (const part of parts) {
          if (part.includes('filename=') || part.includes('Content-Type: text/csv') || part.includes('name="file"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              const content = part.slice(headerEnd + 4).replace(/\r\n--$/, '').trim();
              req.file = {
                content,
                buffer: Buffer.from(content, 'utf-8'),
              };
              req.body.csv = content;
              break;
            }
          }
        }
      }

      if (!req.file) {
        // Fallback: entire text
        req.file = { content: text.trim(), buffer };
        req.body.csv = text.trim();
      }

      next();
    });
    return;
  }

  // Already parsed by json/urlencoded or plain text
  if (typeof req.body === 'string') {
    req.file = { content: req.body, buffer: Buffer.from(req.body) };
    req.body = { csv: req.body };
  } else if (req.body && req.body.csv) {
    req.file = { content: req.body.csv, buffer: Buffer.from(req.body.csv) };
  } else if (req.body && req.body.file) {
    req.file = { content: req.body.file, buffer: Buffer.from(req.body.file) };
  }

  next();
}
