import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Naps2Service, VALID_DRIVERS } from '../services/naps2.service';
import { ProfilesService } from '../services/profiles.service';
import { createError } from '../middleware/error-handler';
import { translateZodError } from '../utils/zod-error-translator';

const naps2Service = new Naps2Service();
const profilesService = new ProfilesService();

// Schema base con campos comunes opcionales
const BaseScanSchema = z.object({
  source: z.enum(['glass', 'feeder', 'duplex']).optional(),
  dpi: z.number().int().min(50).max(2400).optional(),
  bitDepth: z.enum(['color', 'gray', 'bw']).optional(),
  pageSize: z.string().optional(),
  outputFormat: z.enum(['pdf', 'jpg', 'png', 'tiff']).optional(),
  numberOfScans: z.number().int().min(1).optional(),
});

// Schema para escaneo con perfil
const ProfileScanSchema = BaseScanSchema.extend({
  profile: z.string().min(1, 'Profile name cannot be empty'),
  driver: z.enum(VALID_DRIVERS).optional(),
  device: z.string().optional(),
});

// Schema para escaneo custom (requiere driver y device)
const CustomScanSchema = BaseScanSchema.extend({
  profile: z.undefined().optional(),
  driver: z.enum(VALID_DRIVERS),
  device: z.string().min(1, 'Device name is required for custom scan'),
});

export async function startScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;

    // Determinar qué tipo de escaneo es
    const hasProfile = typeof body.profile === 'string' && body.profile.length > 0;
    const hasCustom =
      typeof body.driver === 'string' &&
      body.driver.length > 0 &&
      typeof body.device === 'string' &&
      body.device.length > 0;

    if (!hasProfile && !hasCustom) {
      throw createError(
        'Invalid scan request. Provide either "profile" (profile name) OR both "driver" and "device" for custom scan',
        400
      );
    }

    // Validar según el tipo de escaneo
    if (hasProfile) {
      const parsed = ProfileScanSchema.safeParse(body);
      if (!parsed.success) {
        throw createError(translateZodError(parsed.error), 400);
      }

      // Verificar que el perfil existe
      const profile = await profilesService.getProfileByName(parsed.data.profile);
      if (!profile) {
        throw createError(`Profile '${parsed.data.profile}' not found`, 404);
      }

      const result = await naps2Service.scan(parsed.data);
      res.json({
        success: true,
        data: result,
      });
    } else {
      const parsed = CustomScanSchema.safeParse(body);
      if (!parsed.success) {
        throw createError(translateZodError(parsed.error), 400);
      }

      const result = await naps2Service.scan(parsed.data);
      res.json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    next(error);
  }
}