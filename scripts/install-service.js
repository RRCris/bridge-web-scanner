const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVICE_NAME = 'BridgeScanWeb';
const SERVICE_DISPLAY_NAME = 'Bridge Scan Web API';
const SERVICE_DESCRIPTION = 'REST API bridge for NAPS2 scanner integration';

function getPaths() {
  const currentDir = path.dirname(process.execPath);
  return {
    currentDir,
    exePath: path.join(currentDir, 'bridge-scan-web.exe'),
    nssmPath: path.join(currentDir, 'nssm.exe'),
  };
}

function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function serviceExists() {
  try {
    execSync(`sc query "${SERVICE_NAME}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function waitForKey() {
  return new Promise((resolve) => {
    console.log('\nPress Enter to exit...');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

function runCommand(cmd, ignoreError = false) {
  try {
    const result = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    return { success: true, output: result };
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${cmd}`);
      console.error(`Error: ${error.message}`);
      if (error.stdout) console.error(`stdout: ${error.stdout}`);
      if (error.stderr) console.error(`stderr: ${error.stderr}`);
    }
    return { success: false, output: error.message };
  }
}

async function installService() {
  console.log('==========================================');
  console.log('  Bridge Scan Web - Service Installer');
  console.log('==========================================\n');

  // Check admin privileges
  if (!isAdmin()) {
    console.error('ERROR: Administrator privileges required.');
    console.error('Please right-click and select "Run as administrator".');
    await waitForKey();
    process.exit(1);
  }

  const { currentDir, exePath, nssmPath } = getPaths();

  // Verify NSSM exists
  if (!fs.existsSync(nssmPath)) {
    console.error('ERROR: nssm.exe not found at:');
    console.error(nssmPath);
    console.error('\nMake sure nssm.exe is in the same folder as install.exe');
    await waitForKey();
    process.exit(1);
  }

  // Verify executable exists
  if (!fs.existsSync(exePath)) {
    console.error('ERROR: bridge-scan-web.exe not found at:');
    console.error(exePath);
    console.error('\nMake sure install.exe is in the same folder as bridge-scan-web.exe');
    await waitForKey();
    process.exit(1);
  }

  console.log(`Executable: ${exePath}`);
  console.log(`Working Dir: ${currentDir}`);
  console.log(`NSSM: ${nssmPath}\n`);

  // Create logs directory
  const logsDir = path.join(currentDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Remove existing service if exists
  if (serviceExists()) {
    console.log('Existing service found. Removing...');
    runCommand(`"${nssmPath}" stop "${SERVICE_NAME}"`, true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    runCommand(`"${nssmPath}" remove "${SERVICE_NAME}" confirm`, true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Existing service removed.\n');
  }

  // Install the service with NSSM
  console.log('Installing Windows service with NSSM...\n');

  const installResult = runCommand(`"${nssmPath}" install "${SERVICE_NAME}" "${exePath}"`);
  if (!installResult.success) {
    console.error('Failed to install service.');
    await waitForKey();
    process.exit(1);
  }

  // Configure service
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" DisplayName "${SERVICE_DISPLAY_NAME}"`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" Description "${SERVICE_DESCRIPTION}"`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppDirectory "${currentDir}"`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" Start SERVICE_AUTO_START`, true);

  // Configure stdout/stderr logging
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppStdout "${path.join(logsDir, 'service-stdout.log')}"`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppStderr "${path.join(logsDir, 'service-stderr.log')}"`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppStdoutCreationDisposition 4`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppStderrCreationDisposition 4`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppRotateFiles 1`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppRotateBytes 5242880`, true);

  // Configure restart on failure
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppExit Default Restart`, true);
  runCommand(`"${nssmPath}" set "${SERVICE_NAME}" AppRestartDelay 5000`, true);

  console.log('Service configured.');

  // Start the service
  console.log('Starting service...\n');

  runCommand(`"${nssmPath}" start "${SERVICE_NAME}"`, true);

  // Wait and check status
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const statusResult = runCommand(`"${nssmPath}" status "${SERVICE_NAME}"`, true);
  const isRunning = statusResult.output && statusResult.output.includes('SERVICE_RUNNING');

  console.log('==========================================');
  console.log('  Installation Complete!');
  console.log('==========================================');
  console.log(`\nService Name: ${SERVICE_NAME}`);
  console.log(`Status: ${isRunning ? 'Running' : 'Starting...'}`);
  console.log('Startup Type: Automatic');
  console.log('\nThe API is available at: http://localhost:3000');
  console.log('\nManage the service with:');
  console.log('  - Windows Services (services.msc)');
  console.log('  - nssm start/stop/restart BridgeScanWeb');
  console.log('  - Run uninstall.exe to remove');

  await waitForKey();
}

installService().catch(async (err) => {
  console.error('Unexpected error:', err.message);
  await waitForKey();
  process.exit(1);
});