import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import iconv from 'iconv-lite';
import { getNaps2ConsolePath, getScansOutputPath } from '../utils/paths';
import { logger } from '../utils/logger';
import type { ScanOptions, ScanResult, DeviceInfo } from '../types';

export const VALID_DRIVERS = ['wia', 'twain'] as const;
export type ValidDriver = (typeof VALID_DRIVERS)[number];

// Schemas de validación para respuestas de NAPS2
const CommandResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  code: z.number(),
});

const DeviceInfoSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Device name cannot be empty'),
  driver: z.string().min(1, 'Driver cannot be empty'),
});

const DeviceListSchema = z.array(DeviceInfoSchema);

const ScanResultSchema = z.object({
  scanId: z.string().uuid(),
  filename: z.string().min(1),
  path: z.string().min(1),
  timestamp: z.string().datetime(),
});

export class Naps2Error extends Error {
  public readonly code: number;
  public readonly stderr: string;
  public readonly stdout: string;

  constructor(message: string, code: number, stderr: string, stdout: string) {
    super(message);
    this.name = 'Naps2Error';
    this.code = code;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

export class Naps2Service {
  private readonly consolePath: string;

  constructor() {
    this.consolePath = getNaps2ConsolePath();
  }

  private executeCommand(
    args: string[]
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const cwd = path.dirname(this.consolePath);

      logger.info(`Executing: ${this.consolePath} ${args.join(' ')}`);

      const proc = spawn(this.consolePath, args, {
        cwd,
        windowsHide: true,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      proc.stdout.on('data', (data: Buffer) => {
        stdoutChunks.push(data);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderrChunks.push(data);
      });

      proc.on('close', (code) => {
        logger.info(`Command finished with code: ${code ?? 0}`);

        // Decodificar buffers usando cp850 (codepage de Windows en español)
        const stdoutBuffer = Buffer.concat(stdoutChunks);
        const stderrBuffer = Buffer.concat(stderrChunks);
        const stdout = iconv.decode(stdoutBuffer, 'cp850');
        const stderr = iconv.decode(stderrBuffer, 'cp850');

        const result = { stdout, stderr, code: code ?? 0 };

        const parsed = CommandResultSchema.safeParse(result);
        if (!parsed.success) {
          reject(
            new Naps2Error(
              `Invalid command response: ${parsed.error.message}`,
              code ?? -1,
              stderr,
              stdout
            )
          );
          return;
        }

        resolve(parsed.data);
      });

      proc.on('error', (error) => {
        logger.error(`Command error: ${error.message}`);
        reject(new Naps2Error(`Failed to execute NAPS2: ${error.message}`, -1, '', ''));
      });
    });
  }

  async listDevicesByDriver(driver: string): Promise<DeviceInfo[]> {
    const args = ['--listdevices', '--driver', driver];
    const result = await this.executeCommand(args);

    if (result.code !== 0) {
      throw new Naps2Error(
        `Failed to list devices for driver '${driver}': ${result.stderr || result.stdout || 'Unknown error'}`,
        result.code,
        result.stderr,
        result.stdout
      );
    }

    const devices = this.parseDeviceList(result.stdout, driver);

    const parsed = DeviceListSchema.safeParse(devices);
    if (!parsed.success) {
      throw new Naps2Error(
        `Invalid device list response: ${parsed.error.issues.map((e: { message: string }) => e.message).join(', ')}`,
        result.code,
        result.stderr,
        result.stdout
      );
    }

    return parsed.data;
  }

  async listAllDevices(): Promise<DeviceInfo[]> {
    const allDevices: DeviceInfo[] = [];
    const errors: string[] = [];

    for (const driver of VALID_DRIVERS) {
      try {
        const devices = await this.listDevicesByDriver(driver);
        allDevices.push(...devices);
      } catch (error) {
        const message =
          error instanceof Naps2Error
            ? `${driver}: ${error.message}`
            : `${driver}: ${(error as Error).message}`;
        errors.push(message);
        logger.warn(`Failed to list devices for driver ${driver}: ${message}`);
      }
    }

    if (allDevices.length === 0 && errors.length > 0) {
      throw new Naps2Error(
        `No devices found. Errors: ${errors.join('; ')}`,
        -1,
        '',
        ''
      );
    }

    return allDevices;
  }

  async scan(options: ScanOptions): Promise<ScanResult> {
    const scanId = uuidv4();
    const outputDir = getScansOutputPath();
    const extension = options.outputFormat ?? 'pdf';
    const filename = `${scanId}.${extension}`;
    const outputPath = path.join(outputDir, filename);

    const args: string[] = ['-o', outputPath];

    if (options.profile) {
      args.push('-p', options.profile);
    }

    if (options.driver) {
      args.push('--driver', options.driver);
    }

    if (options.device) {
      args.push('--device', options.device);
    }

    if (options.source) {
      args.push('--source', options.source);
    }

    if (options.dpi) {
      args.push('--dpi', options.dpi.toString());
    }

    if (options.bitDepth) {
      args.push('--bitdepth', options.bitDepth);
    }

    if (options.pageSize) {
      args.push('--pagesize', options.pageSize);
    }

    if (options.numberOfScans) {
      args.push('-n', options.numberOfScans.toString());
    }

    args.push('-f'); // Force overwrite

    const result = await this.executeCommand(args);

    if (result.code !== 0) {
      throw new Naps2Error(
        `Scan failed: ${result.stderr || result.stdout || 'Unknown error'}`,
        result.code,
        result.stderr,
        result.stdout
      );
    }

    // Verificar que el archivo fue creado
    if (!fs.existsSync(outputPath)) {
      throw new Naps2Error(
        `Scan completed but output file was not created at: ${outputPath}`,
        result.code,
        result.stderr,
        result.stdout
      );
    }

    const scanResult: ScanResult = {
      scanId,
      filename,
      path: outputPath,
      timestamp: new Date().toISOString(),
    };

    const parsed = ScanResultSchema.safeParse(scanResult);
    if (!parsed.success) {
      throw new Naps2Error(
        `Invalid scan result: ${parsed.error.issues.map((e: { message: string }) => e.message).join(', ')}`,
        result.code,
        result.stderr,
        result.stdout
      );
    }

    return parsed.data;
  }

  private parseDeviceList(output: string, driver: string): DeviceInfo[] {
    const devices: DeviceInfo[] = [];
    const lines = output.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('Available') && !trimmed.startsWith('---')) {
        devices.push({ id: '', name: trimmed, driver });
      }
    }

    return devices;
  }
}
