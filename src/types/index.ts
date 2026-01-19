export interface ScanOptions {
  profile?: string;
  device?: string;
  driver?: 'wia' | 'twain';
  source?: 'glass' | 'feeder' | 'duplex';
  dpi?: number;
  bitDepth?: 'color' | 'gray' | 'bw';
  pageSize?: string;
  outputFormat?: 'pdf' | 'jpg' | 'png' | 'tiff';
  numberOfScans?: number;
}

export interface ScanResult {
  scanId: string;
  filename: string;
  path: string;
  timestamp: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  driver: string;
}

export interface ScanProfile {
  displayName: string;
  isDefault: boolean;
  device: {
    id: string;
    name: string;
  };
  driverName: string;
  bitDepth: string;
  pageSize: string;
  resolution: string;
  paperSource: string;
}

export interface ScannedFile {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  mimeType: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
