import { createApp } from './app';
import { config } from './config';
import { validateNaps2Installation, getNaps2ConsolePath, getBasePath } from './utils/paths';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info(`Base path: ${getBasePath()}`);
  logger.info(`Looking for NAPS2 at: ${getNaps2ConsolePath()}`);

  if (!validateNaps2Installation()) {
    logger.warn(
      'NAPS2 installation not found. Scanner features will not work.'
    );
    logger.warn(`Expected path: ${getNaps2ConsolePath()}`);
  } else {
    logger.info('NAPS2 installation validated');
  }

  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`Bridge-Scan-Web API running on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
    logger.info(`API base: http://localhost:${config.port}/api`);
  });
}

main().catch((error: Error) => {
  logger.error(`Failed to start server: ${error.message}`);
  console.error('Press any key to exit...');
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(1));
});
