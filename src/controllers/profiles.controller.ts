import type { Request, Response, NextFunction } from 'express';
import {
  ProfilesService,
  CreateProfileSchema,
  UpdateProfileSchema,
} from '../services/profiles.service';
import { createError } from '../middleware/error-handler';
import { translateZodError } from '../utils/zod-error-translator';

const profilesService = new ProfilesService();

export async function listProfiles(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profiles = await profilesService.getProfiles();

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.params;
    const profile = await profilesService.getProfileByName(name);

    if (!profile) {
      throw createError(`Profile '${name}' not found`, 404);
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function createProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = CreateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createError(translateZodError(parsed.error), 400);
    }

    const profile = await profilesService.createProfile(parsed.data);

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.params;

    const parsed = UpdateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createError(translateZodError(parsed.error), 400);
    }

    const profile = await profilesService.updateProfile(name, parsed.data);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.params;
    const deleted = await profilesService.deleteProfile(name);

    if (!deleted) {
      throw createError(`Profile '${name}' not found`, 404);
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
}