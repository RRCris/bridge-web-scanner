const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVICE_NAME = 'BridgeScanWeb';

function getPaths() {
  const currentDir = path.dirname(process.execPath);
  return {
    currentDir,
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

function serviceExists(nssmPath) {
  try {
    execSync(`"${nssmPath}" status "${SERVICE_NAME}"`, { stdio: 'ignore' });
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
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${error.message}`);
    }
    return false;
  }
}

async function uninstallService() {
  console.log('==========================================');
  console.log('  Bridge Scan Web - Service Uninstaller');
  console.log('==========================================\n');

  // Check admin privileges
  if (!isAdmin()) {
    console.error('ERROR: Administrator privileges required.');
    console.error('Please right-click and select "Run as administrator".');
    await waitForKey();
    process.exit(1);
  }

  const { nssmPath } = getPaths();

  // Verify NSSM exists
  if (!fs.existsSync(nssmPath)) {
    console.error('ERROR: nssm.exe not found at:');
    console.error(nssmPath);
    console.error('\nMake sure nssm.exe is in the same folder as uninstall.exe');
    await waitForKey();
    process.exit(1);
  }

  if (!serviceExists(nssmPath)) {
    console.log('Service is not installed.');
    await waitForKey();
    process.exit(0);
  }

  console.log('Stopping service...');
  runCommand(`"${nssmPath}" stop "${SERVICE_NAME}"`, true);

  // Wait for service to stop
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('Removing service...');
  if (!runCommand(`"${nssmPath}" remove "${SERVICE_NAME}" confirm`)) {
    console.error('\nFailed to remove service.');
    console.error('The service might still be stopping. Please try again.');
    await waitForKey();
    process.exit(1);
  }

  console.log('\n==========================================');
  console.log('  Uninstallation Complete!');
  console.log('==========================================');
  console.log('\nThe service has been removed successfully.');
  console.log('You can safely delete the application folder.');

  await waitForKey();
}

uninstallService().catch(async (err) => {
  console.error('Unexpected error:', err.message);
  await waitForKey();
  process.exit(1);
});