import path from 'path';
import fs from 'fs';

interface ProcessWithPkg extends NodeJS.Process {
  pkg?: unknown;
}

const isPkg = typeof (process as ProcessWithPkg).pkg !== 'undefined';

export function getBasePath(): string {
  return isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '../..');
}

export function getNaps2Path(): string {
  const base = getBasePath();
  // En pkg, el .exe está en bin/ junto a naps2-8.2.1-win-x64/
  // En desarrollo, está en la raíz del proyecto
  return isPkg
    ? path.join(base, 'naps2-8.2.1-win-x64')
    : path.join(base, 'bin', 'naps2-8.2.1-win-x64');
}

export function getNaps2ConsolePath(): string {
  return path.join(getNaps2Path(), 'App', 'NAPS2.Console.exe');
}

export function getNaps2DataPath(): string {
  return path.join(getNaps2Path(), 'Data');
}

export function getScansOutputPath(): string {
  const base = getBasePath();
  const scansPath = path.join(base, 'scans');

  if (!fs.existsSync(scansPath)) {
    fs.mkdirSync(scansPath, { recursive: true });
  }

  return scansPath;
}

export function getScriptsPath(): string {
  const base = getBasePath();
  return path.join(base, 'scripts');
}

export function validateNaps2Installation(): boolean {
  const consolePath = getNaps2ConsolePath();
  return fs.existsSync(consolePath);
}
