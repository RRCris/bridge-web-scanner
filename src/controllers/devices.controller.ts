import type { Request, Response, NextFunction } from 'express';
import { Naps2Service, VALID_DRIVERS, ValidDriver } from '../services/naps2.service';
import { WiaService } from '../services/wia.service';
import { createError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import type { DeviceInfo } from '../types';

const naps2Service = new Naps2Service();
const wiaService = new WiaService();

function isValidDriver(driver: string): driver is ValidDriver {
  return VALID_DRIVERS.includes(driver as ValidDriver);
}

async function enrichWithWiaIds(devices: DeviceInfo[]): Promise<DeviceInfo[]> {
  try {
    const wiaDevices = await wiaService.listDevices();

    logger.info(`WIA devices found: ${JSON.stringify(wiaDevices)}`);
    logger.info(`NAPS2 devices to enrich: ${JSON.stringify(devices)}`);

    return devices.map((device) => {
      if (device.driver === 'wia') {
        const wiaDevice = wiaDevices.find(
          (wd) => wd.name.toLowerCase() === device.name.toLowerCase()
        );
        if (wiaDevice) {
          logger.info(`Matched device "${device.name}" with WIA ID "${wiaDevice.id}"`);
          return { ...device, id: wiaDevice.id };
        } else {
          logger.info(`No WIA match for "${device.name}"`);
        }
      }
      return device;
    });
  } catch (error) {
    logger.warn(`Could not enrich devices with WIA IDs: ${(error as Error).message}`);
    return devices;
  }
}

export async function listDevices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = req.query.driver as string | undefined;

    if (driver && !isValidDriver(driver)) {
      throw createError(
        `Invalid driver '${driver}'. Valid drivers are: ${VALID_DRIVERS.join(', ')}`,
        400
      );
    }

    let devices = driver
      ? await naps2Service.listDevicesByDriver(driver)
      : await naps2Service.listAllDevices();

    devices = await enrichWithWiaIds(devices);

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    next(error);
  }
}
