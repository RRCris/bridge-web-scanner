import type { Request, Response, NextFunction } from 'express';
import { FilesService } from '../services/files.service';
import { createError } from '../middleware/error-handler';

const filesService = new FilesService();

export async function listFiles(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = await filesService.listFiles();

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const file = await filesService.getFileById(id);

    if (!file) {
      throw createError(`File '${id}' not found`, 404);
    }

    res.download(file.path, file.filename);
  } catch (error) {
    next(error);
  }
}

export async function deleteFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await filesService.deleteFile(id);

    if (!deleted) {
      throw createError(`File '${id}' not found`, 404);
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
}

export async function clearFiles(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deletedCount = await filesService.clearAllFiles();

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `${deletedCount} file(s) deleted`,
      },
    });
  } catch (error) {
    next(error);
  }
}
