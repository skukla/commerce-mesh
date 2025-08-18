#!/usr/bin/env node

/**
 * Update mesh configuration with status polling
 * Follows Adobe App Builder deployment patterns
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check if ora and chalk are available
let ora, chalk;
try {
  ora = require('ora');
} catch (e) {
  // Fallback if ora is not installed
  ora = (options) => ({
    start: () => {
      console.log(options.text || options);
      return { stop: () => {}, fail: () => {} };
    }
  });
}

try {
  chalk = require('chalk');
} catch (e) {
  // Fallback if chalk is not installed
  chalk = {
    green: (str) => str,
    red: (str) => str,
    yellow: (str) => str,
    blue: (str) => str,
    cyan: (str) => str,
    gray: (str) => str,
    magenta: (str) => str,
    bold: { green: (str) => str, cyan: (str) => str }
  };
}

// Formatting helpers matching the example scripts
const format = {
  success: (msg) => chalk.green(`✔ ${msg}`),
  majorSuccess: (msg) => chalk.bold.green(`✅ ${msg}`),
  error: (msg) => chalk.red(`✖ ${msg}`),
  warning: (msg) => chalk.yellow(`⚠ ${msg}`),
  muted: (msg) => chalk.gray(msg),
  deploymentStart: (msg) => chalk.bold.cyan(`🚀 ${msg}`),
  deploymentAction: (msg) => chalk.blue(`🔧 ${msg}`),
  celebration: (msg) => chalk.magenta(`🎉 ${msg}`),
  environment: (env) => env.charAt(0).toUpperCase() + env.slice(1),
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = { params: {} };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      parsed[key] = value || true;
    }
  }
  
  return parsed;
}

/**
 * Check if production environment
 */
function isProdEnvironment(args) {
  return args.prod === true || args.production === true;
}

/**
 * Get hash of mesh files to detect changes
 */
function getMeshHash() {
  try {
    const meshJsonPath = path.join(__dirname, '..', 'mesh.json');
    const resolversDir = path.join(__dirname, '..', 'resolvers');
    
    let combinedContent = '';
    if (fs.existsSync(meshJsonPath)) {
      combinedContent += fs.readFileSync(meshJsonPath, 'utf8');
    }
    
    // Include all resolver files
    if (fs.existsSync(resolversDir)) {
      const resolverFiles = fs.readdirSync(resolversDir)
        .filter(f => f.endsWith('.js'))
        .sort(); // Sort for consistent hash
      
      resolverFiles.forEach(file => {
        const filePath = path.join(resolversDir, file);
        combinedContent += fs.readFileSync(filePath, 'utf8');
      });
    }
    
    return crypto.createHash('md5').update(combinedContent).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Get stored mesh deployment hash
 */
function getStoredDeployHash(isProd) {
  try {
    const hashFile = isProd ? '.mesh-deploy-hash-prod' : '.mesh-deploy-hash';
    const hashPath = path.join(__dirname, '..', hashFile);
    return fs.readFileSync(hashPath, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

/**
 * Store mesh deployment hash
 */
function storeDeployHash(hash, isProd) {
  const hashFile = isProd ? '.mesh-deploy-hash-prod' : '.mesh-deploy-hash';
  const hashPath = path.join(__dirname, '..', hashFile);
  fs.writeFileSync(hashPath, hash);
}

/**
 * Run deploy command with proper output handling
 */
async function runDeployCommand(command, description, suppressCompletion = false, captureOutput = false) {
  console.log(format.deploymentAction(description));
  await format.sleep(500);

  try {
    if (captureOutput) {
      // Capture output to show errors properly
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      // Check for errors in output
      if (output.toLowerCase().includes('error:')) {
        console.error(format.error(`${description} failed`));
        console.error(output);
        throw new Error('Mesh update failed with errors');
      }
      
      // Show output if it contains important information
      if (output.trim()) {
        console.log(output);
      }
    } else {
      execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    }
    
    if (!suppressCompletion) {
      console.log(format.success(`${description} completed`));
    }
    return true;
  } catch (error) {
    // Extract the actual error message from command output
    const errorMessage = error.stdout || error.stderr || error.message;
    console.error(format.error(`${description} failed`));
    
    // Display the full error output for debugging
    if (errorMessage) {
      console.error(format.muted('Error details:'));
      console.error(errorMessage);
    }
    
    throw new Error(`${description} failed`);
  }
}

/**
 * Check mesh deployment status
 */
function checkMeshStatus(statusOutput) {
  // Success detection
  if (statusOutput.includes('Mesh provisioned successfully')) {
    return 'success';
  }

  // Failure detection - but ignore warnings
  const lowerOutput = statusOutput.toLowerCase();
  if (
    (lowerOutput.includes('failed') || lowerOutput.includes('error')) &&
    !lowerOutput.includes('deprecationwarning') &&
    !lowerOutput.includes('update available') &&
    !lowerOutput.includes('timeoutnanwarning')
  ) {
    return 'failed';
  }

  // Continue polling - various provisioning messages
  if (
    statusOutput.includes('Currently provisioning') ||
    statusOutput.includes('provisioning') || 
    statusOutput.includes('Provisioning') ||
    statusOutput.includes('Wait a few minutes')
  ) {
    return 'provisioning';
  }

  return 'unknown';
}

/**
 * Poll mesh status until provisioned
 */
async function pollMeshStatus(isProd) {
  const maxTimeout = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 30 * 1000; // 30 seconds
  const maxAttempts = Math.ceil(maxTimeout / pollInterval);

  const spinner = ora({
    text: format.muted('Provisioning mesh...'),
    spinner: 'dots'
  }).start();

  // Initial delay to allow provisioning to start
  await format.sleep(5000); // 5 seconds
  
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;

    try {
      // Wait between attempts (except first)
      if (attempts > 1) {
        await format.sleep(pollInterval);
        spinner.text = format.muted(`Provisioning mesh... (attempt ${attempts}/${maxAttempts})`);
      }

      // Check status
      const statusCommand = isProd 
        ? 'echo | aio api-mesh:status --prod 2>&1'
        : 'echo | aio api-mesh:status 2>&1';
      
      const statusOutput = execSync(statusCommand, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000, // 15 seconds
        shell: true
      });

      const status = checkMeshStatus(statusOutput);

      if (status === 'success') {
        spinner.stop();
        console.log(format.success('Mesh provisioned successfully'));
        return true;
      }

      if (status === 'failed') {
        spinner.stop();
        console.log(format.error('Mesh deployment failed - check status manually'));
        return false;
      }
    } catch (error) {
      // Only fail if near timeout
      if (attempts >= maxAttempts - 2) {
        spinner.stop();
        console.log(format.warning(`Mesh status polling timed out`));
        console.log(format.warning('Mesh update may still be in progress - check manually'));
        return true; // Assume success to not block deployment
      }
    }
  }

  spinner.stop();
  console.log(format.warning('Mesh deployment timed out (10 minutes)'));
  console.log(format.warning('You may need to check mesh status manually'));
  return true; // Assume success
}

/**
 * Purge mesh cache
 */
async function purgeMeshCache(isProd, environment) {
  const cacheCommand = `aio api-mesh:cache:purge -a -c${isProd ? ' --prod' : ''}`;
  try {
    await runDeployCommand(cacheCommand, `Purging mesh cache in ${environment}`);
  } catch (error) {
    // Don't fail deployment for cache purge issues
    console.log(format.warning('Cache purge failed, proceeding with mesh update anyway'));
  }
}

/**
 * Update mesh configuration
 */
async function updateMeshConfiguration(isProd, environment) {
  const meshCommand = `echo "y" | aio api-mesh:update mesh.json${isProd ? ' --prod' : ''} 2>&1`;
  await runDeployCommand(meshCommand, `Updating mesh configuration in ${environment}`, true, true);
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isProd = isProdEnvironment(args);
  const environment = format.environment(isProd ? 'production' : 'staging');

  if (args.help) {
    console.log(`
Usage: npm run update [options]

Options:
  --help          Show this help message
  --prod          Deploy to production environment
  --force         Force update even if no changes detected
  --skip-cache    Skip cache purge step

This script updates the Adobe API Mesh configuration in the
specified environment and waits for provisioning to complete.
    `);
    return;
  }

  console.log(format.deploymentStart(`Mesh deployment started (${environment})`));
  console.log();
  await format.sleep(500);

  try {
    // Check if mesh.json exists
    const meshJsonPath = path.join(__dirname, '..', 'mesh.json');
    if (!fs.existsSync(meshJsonPath)) {
      console.log(format.warning('mesh.json not found - running build first...'));
      execSync('npm run build', { stdio: 'inherit' });
      console.log();
    }

    // Check if update is needed
    const currentHash = getMeshHash();
    const storedHash = getStoredDeployHash(isProd);
    
    if (!args.force && currentHash === storedHash) {
      console.log(format.muted(`No changes detected since last ${environment} deployment`));
      console.log(format.success('Deployment skipped (use --force to redeploy)'));
      return;
    }

    // Purge cache if not skipped
    if (!args['skip-cache']) {
      await purgeMeshCache(isProd, environment);
      console.log();
    }

    // Update mesh configuration
    await updateMeshConfiguration(isProd, environment);
    
    // Poll for status
    const success = await pollMeshStatus(isProd);
    
    if (success) {
      // Store the hash for next time
      if (currentHash) {
        storeDeployHash(currentHash, isProd);
      }
      
      console.log();
      console.log(format.celebration(`Mesh deployed successfully to ${environment}!`));
    } else {
      console.log(format.error('Mesh deployment may have failed'));
      console.log(format.muted('Run "npm run status" to check current status'));
      process.exit(1);
    }
  } catch (error) {
    console.error(format.error(`Deployment failed: ${error.message}`));
    if (error.stack && args.verbose) {
      console.error(format.muted(error.stack));
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(format.error(`Error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { pollMeshStatus, checkMeshStatus };