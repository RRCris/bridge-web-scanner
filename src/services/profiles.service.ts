import fs from 'fs';
import path from 'path';
import { parseStringPromise, Builder } from 'xml2js';
import { z } from 'zod';
import { getNaps2DataPath } from '../utils/paths';
import { logger } from '../utils/logger';
import type { ScanProfile } from '../types';

// Schemas de validación Zod
const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ScanProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  isDefault: z.boolean(),
  device: DeviceSchema,
  driverName: z.enum(['wia', 'twain', '']),
  bitDepth: z.string(),
  pageSize: z.string(),
  resolution: z.string(),
  paperSource: z.string(),
});

const ScanProfileArraySchema = z.array(ScanProfileSchema);

// Schema para crear/actualizar profile (campos opcionales excepto displayName y device)
export const CreateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  isDefault: z.boolean().optional().default(false),
  device: z.object({
    id: z.string().min(1, 'Device ID is required'),
    name: z.string().min(1, 'Device name is required'),
  }),
  driverName: z.enum(['wia', 'twain', '']).optional().default('wia'),
  bitDepth: z.string().optional().default('C24Bit'),
  pageSize: z.string().optional().default('Letter'),
  resolution: z.string().optional().default('Dpi300'),
  paperSource: z.string().optional().default('Glass'),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  device: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  driverName: z.enum(['wia', 'twain', '']).optional(),
  bitDepth: z.string().optional(),
  pageSize: z.string().optional(),
  resolution: z.string().optional(),
  paperSource: z.string().optional(),
});

export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// Interfaces para XML
interface RawDevice {
  ID?: string[];
  Name?: string[];
  IconUri?: Array<{ $?: { 'xsi:nil'?: string } }>;
  ConnectionUri?: Array<{ $?: { 'xsi:nil'?: string } }>;
}

interface RawProfile {
  Version?: string[];
  Device?: RawDevice[];
  Caps?: unknown[];
  DriverName?: string[];
  DisplayName?: string[];
  IconID?: string[];
  MaxQuality?: string[];
  IsDefault?: string[];
  UseNativeUI?: string[];
  AfterScanScale?: string[];
  Brightness?: string[];
  Contrast?: string[];
  BitDepth?: string[];
  PageAlign?: string[];
  PageSize?: string[];
  CustomPageSizeName?: unknown[];
  CustomPageSize?: unknown[];
  Resolution?: string[];
  PaperSource?: string[];
  EnableAutoSave?: string[];
  AutoSaveSettings?: unknown[];
  Quality?: string[];
  AutoDeskew?: string[];
  RotateDegrees?: string[];
  BrightnessContrastAfterScan?: string[];
  ForcePageSize?: string[];
  ForcePageSizeCrop?: string[];
  TwainImpl?: string[];
  TwainProgress?: string[];
  ExcludeBlankPages?: string[];
  BlankPageWhiteThreshold?: string[];
  BlankPageCoverageThreshold?: string[];
  WiaOffsetWidth?: string[];
  WiaRetryOnFailure?: string[];
  WiaDelayBetweenScans?: string[];
  WiaDelayBetweenScansSeconds?: string[];
  WiaVersion?: string[];
  FlipDuplexedPages?: string[];
  KeyValueOptions?: unknown[];
}

interface ProfilesXml {
  ArrayOfScanProfile?: {
    $?: { 'xmlns:xsi'?: string };
    ScanProfile?: RawProfile[];
  };
}

export class ProfilesError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ProfilesError';
    this.code = code;
  }
}

export class ProfilesService {
  private readonly profilesPath: string;

  constructor() {
    this.profilesPath = path.join(getNaps2DataPath(), 'profiles.xml');
  }

  async getProfiles(): Promise<ScanProfile[]> {
    if (!fs.existsSync(this.profilesPath)) {
      return [];
    }

    const xml = fs.readFileSync(this.profilesPath, 'utf-8');
    let result: ProfilesXml;

    try {
      result = (await parseStringPromise(xml)) as ProfilesXml;
    } catch (error) {
      throw new ProfilesError(
        `Failed to parse profiles.xml: ${(error as Error).message}`,
        'PARSE_ERROR'
      );
    }

    if (!result.ArrayOfScanProfile?.ScanProfile) {
      return [];
    }

    const profiles = result.ArrayOfScanProfile.ScanProfile.map((p) => this.mapProfile(p));

    const parsed = ScanProfileArraySchema.safeParse(profiles);
    if (!parsed.success) {
      throw new ProfilesError(
        `Invalid profiles structure: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    return parsed.data;
  }

  async getProfileByName(name: string): Promise<ScanProfile | null> {
    const profiles = await this.getProfiles();
    return profiles.find((p) => p.displayName === name) ?? null;
  }

  async createProfile(input: CreateProfileInput): Promise<ScanProfile> {
    const parsed = CreateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new ProfilesError(
        `Invalid profile data: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    const profileData = parsed.data;

    // Verificar que no exista un profile con el mismo nombre
    const existing = await this.getProfileByName(profileData.displayName);
    if (existing) {
      throw new ProfilesError(
        `Profile '${profileData.displayName}' already exists`,
        'DUPLICATE_ERROR'
      );
    }

    const rawProfiles = await this.getRawProfiles();

    // Si es default, quitar default de los demás
    if (profileData.isDefault) {
      rawProfiles.forEach((p) => {
        if (p.IsDefault) {
          p.IsDefault = ['false'];
        }
      });
    }

    const newRawProfile = this.createRawProfile(profileData);
    rawProfiles.push(newRawProfile);

    this.saveProfiles(rawProfiles);

    logger.info(`Profile '${profileData.displayName}' created successfully`);

    return this.mapProfile(newRawProfile);
  }

  async updateProfile(name: string, input: UpdateProfileInput): Promise<ScanProfile> {
    const parsed = UpdateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new ProfilesError(
        `Invalid profile data: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    const updateData = parsed.data;
    const rawProfiles = await this.getRawProfiles();

    const profileIndex = rawProfiles.findIndex((p) => p.DisplayName?.[0] === name);

    if (profileIndex === -1) {
      throw new ProfilesError(`Profile '${name}' not found`, 'NOT_FOUND');
    }

    // Si se está cambiando el nombre, verificar que no exista
    if (updateData.displayName && updateData.displayName !== name) {
      const existingWithNewName = rawProfiles.find(
        (p) => p.DisplayName?.[0] === updateData.displayName
      );
      if (existingWithNewName) {
        throw new ProfilesError(
          `Profile '${updateData.displayName}' already exists`,
          'DUPLICATE_ERROR'
        );
      }
    }

    // Si se está estableciendo como default, quitar default de los demás
    if (updateData.isDefault === true) {
      rawProfiles.forEach((p, i) => {
        if (i !== profileIndex && p.IsDefault) {
          p.IsDefault = ['false'];
        }
      });
    }

    const currentProfile = rawProfiles[profileIndex];
    this.updateRawProfile(currentProfile, updateData);

    this.saveProfiles(rawProfiles);

    logger.info(`Profile '${name}' updated successfully`);

    return this.mapProfile(currentProfile);
  }

  async deleteProfile(name: string): Promise<boolean> {
    const rawProfiles = await this.getRawProfiles();

    const profileIndex = rawProfiles.findIndex((p) => p.DisplayName?.[0] === name);

    if (profileIndex === -1) {
      return false;
    }

    rawProfiles.splice(profileIndex, 1);
    this.saveProfiles(rawProfiles);

    logger.info(`Profile '${name}' deleted successfully`);

    return true;
  }

  private async getRawProfiles(): Promise<RawProfile[]> {
    if (!fs.existsSync(this.profilesPath)) {
      return [];
    }

    const xml = fs.readFileSync(this.profilesPath, 'utf-8');
    const result = (await parseStringPromise(xml)) as ProfilesXml;

    return result.ArrayOfScanProfile?.ScanProfile ?? [];
  }

  private saveProfiles(profiles: RawProfile[]): void {
    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'utf-8' },
      renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    });

    const xmlObj: ProfilesXml = {
      ArrayOfScanProfile: {
        $: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance' },
        ScanProfile: profiles,
      },
    };

    const xml = builder.buildObject(xmlObj);

    // Asegurar que el directorio existe
    const dir = path.dirname(this.profilesPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.profilesPath, xml, 'utf-8');
  }

  private createRawProfile(data: CreateProfileInput): RawProfile {
    return {
      Version: ['2'],
      Device: [
        {
          ID: [data.device.id],
          Name: [data.device.name],
          IconUri: [{ $: { 'xsi:nil': 'true' } }],
          ConnectionUri: [{ $: { 'xsi:nil': 'true' } }],
        },
      ],
      DriverName: [data.driverName],
      DisplayName: [data.displayName],
      IconID: ['0'],
      MaxQuality: ['false'],
      IsDefault: [data.isDefault ? 'true' : 'false'],
      UseNativeUI: ['false'],
      AfterScanScale: ['OneToOne'],
      Brightness: ['0'],
      Contrast: ['0'],
      BitDepth: [data.bitDepth],
      PageAlign: ['Right'],
      PageSize: [data.pageSize],
      CustomPageSizeName: [{ $: { 'xsi:nil': 'true' } }],
      CustomPageSize: [{ $: { 'xsi:nil': 'true' } }],
      Resolution: [data.resolution],
      PaperSource: [data.paperSource],
      EnableAutoSave: ['false'],
      AutoSaveSettings: [{ $: { 'xsi:nil': 'true' } }],
      Quality: ['75'],
      AutoDeskew: ['false'],
      RotateDegrees: ['0'],
      BrightnessContrastAfterScan: ['false'],
      ForcePageSize: ['false'],
      ForcePageSizeCrop: ['false'],
      TwainImpl: ['Default'],
      TwainProgress: ['false'],
      ExcludeBlankPages: ['false'],
      BlankPageWhiteThreshold: ['70'],
      BlankPageCoverageThreshold: ['25'],
      WiaOffsetWidth: ['false'],
      WiaRetryOnFailure: ['false'],
      WiaDelayBetweenScans: ['false'],
      WiaDelayBetweenScansSeconds: ['2'],
      WiaVersion: ['Default'],
      FlipDuplexedPages: ['false'],
      KeyValueOptions: [{ $: { 'xsi:nil': 'true' } }],
    };
  }

  private updateRawProfile(profile: RawProfile, data: UpdateProfileInput): void {
    if (data.displayName !== undefined) {
      profile.DisplayName = [data.displayName];
    }
    if (data.isDefault !== undefined) {
      profile.IsDefault = [data.isDefault ? 'true' : 'false'];
    }
    if (data.device !== undefined) {
      if (!profile.Device) {
        profile.Device = [{ ID: [''], Name: [''] }];
      }
      if (data.device.id !== undefined) {
        profile.Device[0].ID = [data.device.id];
      }
      if (data.device.name !== undefined) {
        profile.Device[0].Name = [data.device.name];
      }
    }
    if (data.driverName !== undefined) {
      profile.DriverName = [data.driverName];
    }
    if (data.bitDepth !== undefined) {
      profile.BitDepth = [data.bitDepth];
    }
    if (data.pageSize !== undefined) {
      profile.PageSize = [data.pageSize];
    }
    if (data.resolution !== undefined) {
      profile.Resolution = [data.resolution];
    }
    if (data.paperSource !== undefined) {
      profile.PaperSource = [data.paperSource];
    }
  }

  private mapProfile(rawProfile: RawProfile): ScanProfile {
    return {
      displayName: rawProfile.DisplayName?.[0] ?? '',
      isDefault: rawProfile.IsDefault?.[0] === 'true',
      device: {
        id: rawProfile.Device?.[0]?.ID?.[0] ?? '',
        name: rawProfile.Device?.[0]?.Name?.[0] ?? '',
      },
      driverName: rawProfile.DriverName?.[0] ?? '',
      bitDepth: rawProfile.BitDepth?.[0] ?? '',
      pageSize: rawProfile.PageSize?.[0] ?? '',
      resolution: rawProfile.Resolution?.[0] ?? '',
      paperSource: rawProfile.PaperSource?.[0] ?? '',
    };
  }
}