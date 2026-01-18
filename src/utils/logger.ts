import winston from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, colorize, errors } = winston.format;

interface ProcessWithPkg extends NodeJS.Process {
  pkg?: unknown;
}

const isPkg = typeof (process as ProcessWithPkg).pkg !== 'undefined';

function getBasePath(): string {
  return isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '../..');
}

// Crear directorio de logs si no existe
function getLogsPath(): string {
  const logsPath = path.join(getBasePath(), 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }
  return logsPath;
}

// Formato con timestamp preciso (incluye milisegundos)
const preciseTimestamp = timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' });

// Formato para consola (con colores)
const consoleFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const msg = stack || message;
  return `${ts as string} [${level}]: ${msg as string}`;
});

// Formato para archivos (sin colores, con más detalle)
const fileFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const msg = stack || message;
  return `${ts as string} [${level.toUpperCase()}]: ${msg as string}`;
});

const logsPath = getLogsPath();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(errors({ stack: true }), preciseTimestamp),
  transports: [
    // Consola con colores
    new winston.transports.Console({
      format: combine(colorize(), preciseTimestamp, consoleFormat),
    }),
    // Archivo combinado (todos los logs)
    new winston.transports.File({
      filename: path.join(logsPath, 'combined.log'),
      format: combine(preciseTimestamp, fileFormat),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Archivo solo de errores
    new winston.transports.File({
      filename: path.join(logsPath, 'error.log'),
      level: 'error',
      format: combine(preciseTimestamp, fileFormat),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsPath, 'exceptions.log'),
      format: combine(preciseTimestamp, fileFormat),
    }),
  ],
  // Manejar promesas rechazadas no capturadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsPath, 'rejections.log'),
      format: combine(preciseTimestamp, fileFormat),
    }),
  ],
});
