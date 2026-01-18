import { spawn } from 'child_process';
import path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getScriptsPath } from '../utils/paths';
import type { DeviceInfo } from '../types';

const WiaDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.number(),
});

const WiaDevicesSchema = z.union([WiaDeviceSchema, z.array(WiaDeviceSchema)]);

export class WiaService {
  private readonly scriptPath: string;

  constructor() {
    this.scriptPath = path.join(getScriptsPath(), 'list-wia-devices.ps1');
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', this.scriptPath], {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          logger.error(`WIA script failed with code ${code}: ${stderr}`);
          reject(new Error(`Failed to list WIA devices: ${stderr}`));
          return;
        }

        try {
          const trimmed = stdout.trim();
          if (!trimmed) {
            resolve([]);
            return;
          }

          const parsed = JSON.parse(trimmed);
          const validated = WiaDevicesSchema.safeParse(parsed);

          if (!validated.success) {
            logger.error(`Invalid WIA response: ${validated.error.message}`);
            reject(new Error(`Invalid WIA response: ${validated.error.message}`));
            return;
          }

          const devices = Array.isArray(validated.data) ? validated.data : [validated.data];

          const result: DeviceInfo[] = devices
            .filter((d) => d.type === 1) // Type 1 = Scanner
            .map((d) => ({
              id: d.id,
              name: d.name,
              driver: 'wia',
            }));

          resolve(result);
        } catch (error) {
          logger.error(`Failed to parse WIA response: ${(error as Error).message}`);
          reject(new Error(`Failed to parse WIA response: ${(error as Error).message}`));
        }
      });

      proc.on('error', (error) => {
        logger.error(`WIA script error: ${error.message}`);
        reject(new Error(`Failed to execute WIA script: ${error.message}`));
      });
    });
  }
}