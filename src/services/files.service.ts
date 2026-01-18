import fs from 'fs';
import path from 'path';
import { getScansOutputPath } from '../utils/paths';
import type { ScannedFile } from '../types';

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

export class FilesService {
  private readonly scansPath: string;

  constructor() {
    this.scansPath = getScansOutputPath();
  }

  async listFiles(): Promise<ScannedFile[]> {
    if (!fs.existsSync(this.scansPath)) {
      return [];
    }

    const files = fs.readdirSync(this.scansPath);
    const scannedFiles: ScannedFile[] = [];

    for (const filename of files) {
      const filePath = path.join(this.scansPath, filename);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const ext = path.extname(filename).toLowerCase();
        const id = path.basename(filename, ext);

        scannedFiles.push({
          id,
          filename,
          path: filePath,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          mimeType: MIME_TYPES[ext] ?? 'application/octet-stream',
        });
      }
    }

    return scannedFiles.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getFileById(id: string): Promise<ScannedFile | null> {
    const files = await this.listFiles();
    return files.find((f) => f.id === id) ?? null;
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = await this.getFileById(id);

    if (!file) {
      return false;
    }

    fs.unlinkSync(file.path);
    return true;
  }

  getFilePath(id: string): string | null {
    const files = fs.readdirSync(this.scansPath);
    const file = files.find((f) => f.startsWith(id));

    if (!file) {
      return null;
    }

    return path.join(this.scansPath, file);
  }

  async clearAllFiles(): Promise<number> {
    if (!fs.existsSync(this.scansPath)) {
      return 0;
    }

    const files = fs.readdirSync(this.scansPath);
    let deletedCount = 0;

    for (const filename of files) {
      const filePath = path.join(this.scansPath, filename);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
