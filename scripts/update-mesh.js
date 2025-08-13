#!/usr/bin/env node

/**
 * Update mesh configuration with status polling
 * Extracted from deploy.js for standalone mesh updates
 */

const { execSync } = require('child_process');

// Simple formatting helpers
const format = {
  success: (msg) => `✓ ${msg}`,
  error: (msg) => `✗ ${msg}`,
  warning: (msg) => `⚠ ${msg}`,
  muted: (msg) => msg,
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

function checkMeshStatus(statusOutput) {
  // Success detection
  if (statusOutput.includes('Mesh provisioned successfully.')) {
    return 'success';
  }

  // Failure detection
  if (
    statusOutput.includes('failed') ||
    statusOutput.includes('error') ||
    statusOutput.includes('Failed') ||
    statusOutput.includes('ERROR')
  ) {
    return 'failed';
  }

  // Continue polling
  if (statusOutput.includes('provisioning') || statusOutput.includes('Provisioning')) {
    return 'provisioning';
  }

  return 'unknown';
}

async function pollMeshStatus() {
  const maxTimeout = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 30 * 1000; // 30 seconds
  const maxAttempts = Math.ceil(maxTimeout / pollInterval);

  console.log(format.muted('Waiting for mesh to provision...'));
  
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;

    try {
      await format.sleep(pollInterval);

      const statusOutput = execSync('aio api-mesh:status', {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000, // 10 seconds
      });

      const status = checkMeshStatus(statusOutput);

      if (status === 'success') {
        console.log(format.success('Mesh provisioned and ready'));
        return true;
      }

      if (status === 'failed') {
        console.log(format.error('Mesh deployment failed - check status manually'));
        return false;
      }

      if (status === 'provisioning') {
        console.log(format.muted(`Mesh still provisioning... (attempt ${attempts}/${maxAttempts})`));
      }
    } catch (error) {
      // Only fail if near timeout
      if (attempts >= maxAttempts - 2) {
        console.log(format.warning(`Mesh status polling failed: ${error.message}`));
        console.log(format.warning('Mesh update may still be in progress - check manually'));
        return true;
      }
    }
  }

  console.log(format.warning('Mesh deployment timed out (10 minutes)'));
  console.log(format.warning('You may need to check mesh status manually'));
  return true;
}

async function updateMesh() {
  const isProd = process.argv.includes('--prod');
  const environment = isProd ? 'production' : 'staging';
  
  console.log(format.success(`Updating mesh in ${environment}...`));
  
  try {
    // Run the mesh update command
    execSync(`aio api-mesh:update${isProd ? ' --prod' : ''}`, {
      stdio: 'inherit'
    });
    
    // Poll for status
    const success = await pollMeshStatus();
    
    if (success) {
      console.log(format.success(`Mesh update completed successfully in ${environment}`));
      process.exit(0);
    } else {
      console.log(format.error('Mesh update failed'));
      process.exit(1);
    }
  } catch (error) {
    console.error(format.error(`Mesh update failed: ${error.message}`));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateMesh().catch(error => {
    console.error(format.error(`Error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { pollMeshStatus, checkMeshStatus };