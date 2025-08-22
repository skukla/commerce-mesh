#!/usr/bin/env node
/* global setTimeout */

/**
 * Build script to convert mesh.config.js to mesh.json
 * Follows Adobe App Builder build patterns
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check if ora and chalk are available
let ora, chalk;
try {
  ora = require('ora');
} catch {
  // Fallback if ora is not installed
  ora = (options) => ({
    start: () => {
      console.log(options.text || options);
      return { stop: () => {}, fail: () => {} };
    },
  });
}

try {
  chalk = require('chalk');
} catch {
  // Fallback if chalk is not installed
  chalk = {
    green: (str) => str,
    red: (str) => str,
    yellow: (str) => str,
    blue: (str) => str,
    cyan: (str) => str,
    gray: (str) => str,
    bold: { green: (str) => str },
  };
}

// Formatting helpers matching the example scripts
const format = {
  success: (msg) => chalk.green(`✔ ${msg}`),
  majorSuccess: (msg) => chalk.green(`✅ ${msg}`),
  error: (msg) => chalk.red(`✖ ${msg}`),
  warning: (msg) => chalk.yellow(`⚠ ${msg}`),
  muted: (msg) => chalk.gray(msg),
  deploymentStart: (msg) => chalk.cyan(`🚀 ${msg}`),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Combine GraphQL schema files into a single string
 */
function combineSchemaFiles() {
  const schemaDir = path.join(__dirname, '..', 'schema');

  // Automatically include all .graphql files in the schema directory
  const schemaFiles = fs
    .readdirSync(schemaDir)
    .filter((file) => file.endsWith('.graphql'))
    .sort(); // Sort for consistent output order

  let combinedSchema = '';

  for (const file of schemaFiles) {
    const filePath = path.join(schemaDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      // Remove comments for cleaner output
      const cleanContent = content
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n')
        .trim();

      if (cleanContent) {
        combinedSchema += cleanContent + '\n\n';
      }
    }
  }

  return combinedSchema.trim();
}

// Note: getResolverFiles function removed in favor of processResolversWithMappings

/**
 * Process resolver files to inject facet mappings
 * This creates processed versions with the mappings injected
 */
function processResolversWithMappings() {
  const resolversDir = path.join(__dirname, '..', 'resolvers-src');
  const processedDir = path.join(__dirname, '..', 'resolvers');

  // Create processed directory if it doesn't exist
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir);
  }

  // Load facet mappings
  let facetMappings = {};
  try {
    const mappingsPath = path.join(__dirname, '..', 'config', 'facet-mappings.json');
    if (fs.existsSync(mappingsPath)) {
      facetMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    }
  } catch {
    console.log(format.warning('No facet-mappings.json found, proceeding without URL mappings'));
  }

  // Inject mappings into each resolver (excluding template and utility files)
  const resolverFiles = fs
    .readdirSync(resolversDir)
    .filter(
      (file) => file.endsWith('.js') && !file.includes('template') && !file.includes('utils')
    );

  resolverFiles.forEach((file) => {
    const originalPath = path.join(resolversDir, file);
    const processedPath = path.join(processedDir, file);

    let content = fs.readFileSync(originalPath, 'utf8');

    // Inject the facet mappings at the beginning of the file
    const injection = `
// ============================================================================
// INJECTED FACET MAPPINGS - Added during build from config/facet-mappings.json
// ============================================================================
const FACET_MAPPINGS = ${JSON.stringify(facetMappings, null, 2)};

// Helper functions for facet mapping
const attributeCodeToUrlKey = (attributeCode) => {
  // Check for explicit mapping
  if (FACET_MAPPINGS.mappings && FACET_MAPPINGS.mappings[attributeCode]) {
    return FACET_MAPPINGS.mappings[attributeCode];
  }
  
  // Apply default transformations
  let urlKey = attributeCode;
  if (FACET_MAPPINGS.defaults) {
    // Remove prefixes
    (FACET_MAPPINGS.defaults.removePrefix || []).forEach(prefix => {
      if (urlKey.startsWith(prefix)) {
        urlKey = urlKey.substring(prefix.length);
      }
    });
    
    // Replace underscores
    if (FACET_MAPPINGS.defaults.replaceUnderscore) {
      urlKey = urlKey.replace(/_/g, '-');
    }
    
    // Convert to lowercase
    if (FACET_MAPPINGS.defaults.toLowerCase) {
      urlKey = urlKey.toLowerCase();
    }
  }
  
  return urlKey;
};

const urlKeyToAttributeCode = (urlKey) => {
  // Find the attribute code for a URL key
  if (FACET_MAPPINGS.mappings) {
    for (const [attributeCode, mappedKey] of Object.entries(FACET_MAPPINGS.mappings)) {
      if (mappedKey === urlKey) {
        return attributeCode;
      }
    }
  }
  
  // If no mapping found, try to reverse the default transformations
  // This is a best-effort approach
  return urlKey.replace(/-/g, '_');
};

// ============================================================================
// ORIGINAL RESOLVER CODE BELOW
// ============================================================================
`;

    // Write the processed file
    fs.writeFileSync(processedPath, injection + content, 'utf8');
  });

  // Return the processed resolver paths (excluding templates)
  return fs
    .readdirSync(processedDir)
    .filter((file) => file.endsWith('.js') && !file.includes('template') && !file.includes('utils'))
    .sort()
    .map((file) => `./resolvers/${file}`);
}

/**
 * Get hash of source files to detect changes
 */
function getMeshSourceHash() {
  try {
    const sourceFiles = [
      'mesh.config.js',
      'schema/product-cards.graphql',
      'schema/search-suggestions.graphql',
      'schema/extensions.graphql',
      'resolvers/product-cards.js',
      'resolvers/search-suggestions.js',
      'resolvers/field-extensions.js',
    ];

    let combinedContent = '';
    for (const file of sourceFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        combinedContent += fs.readFileSync(filePath, 'utf8');
      }
    }

    return crypto.createHash('md5').update(combinedContent).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Get stored hash from last build
 */
function getStoredMeshHash() {
  try {
    const hashPath = path.join(__dirname, '..', '.mesh-build-hash');
    return fs.readFileSync(hashPath, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Store hash for change detection
 */
function storeMeshHash(hash) {
  const hashPath = path.join(__dirname, '..', '.mesh-build-hash');
  fs.writeFileSync(hashPath, hash);
}

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

async function generateMeshConfig() {
  const spinner = ora({
    text: format.muted('Generating mesh configuration'),
    spinner: 'dots',
  }).start();

  try {
    // Load the mesh configuration
    const meshConfigPath = path.join(__dirname, '..', 'mesh.config.js');

    if (!fs.existsSync(meshConfigPath)) {
      spinner.stop();
      console.log(format.warning('No mesh.config.js found, skipping'));
      return false;
    }

    // Clear require cache to get fresh config
    delete require.cache[require.resolve(meshConfigPath)];
    const meshConfig = require(meshConfigPath);

    // Validate configuration structure
    if (!meshConfig.meshConfig) {
      throw new Error('mesh.config.js must export a meshConfig object');
    }

    // Combine schema files
    spinner.text = format.muted('Combining GraphQL schema files');
    const combinedSchema = combineSchemaFiles();

    // Process resolver files with facet mappings
    spinner.text = format.muted('Injecting facet mappings into resolvers');
    const resolverFiles = processResolversWithMappings();

    // Add the combined schema and resolvers to the config
    meshConfig.meshConfig.additionalTypeDefs = combinedSchema;
    meshConfig.meshConfig.additionalResolvers = resolverFiles;

    // Write the configuration to mesh.json
    const meshJsonPath = path.join(__dirname, '..', 'mesh.json');
    fs.writeFileSync(meshJsonPath, JSON.stringify(meshConfig, null, 2), 'utf8');

    // Verify the output is valid JSON
    const written = fs.readFileSync(meshJsonPath, 'utf8');
    JSON.parse(written);

    spinner.stop();
    console.log(format.success('Mesh configuration generated (mesh.json)'));
    console.log(
      format.muted(`  - Combined ${combinedSchema.split('\n').length} lines of GraphQL schema`)
    );
    console.log(format.muted(`  - Processed ${resolverFiles.length} resolvers`));
    console.log(format.muted('  - Injected facet mappings for SEO-friendly URLs'));

    return true;
  } catch (error) {
    spinner.stop();
    console.log(format.error(`Mesh config generation failed: ${error.message}`));
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage: npm run build [options]

Options:
  --help          Show this help message
  --force         Force rebuild even if no changes detected
  --watch         Watch for changes and rebuild automatically

This script converts mesh.config.js and schema/*.graphql 
files into the mesh.json format required by Adobe API Mesh.
    `);
    return;
  }

  console.log(format.deploymentStart('Build started'));
  console.log();
  await format.sleep(500);

  try {
    // Check if rebuild is needed
    const currentHash = getMeshSourceHash();
    const storedHash = getStoredMeshHash();

    if (!args.force && currentHash === storedHash) {
      console.log(format.muted('No changes detected in mesh configuration'));
      console.log(format.success('Build skipped (use --force to rebuild)'));
      return;
    }

    // Generate mesh configuration
    const success = await generateMeshConfig();

    if (success) {
      // Store the hash for next time
      if (currentHash) {
        storeMeshHash(currentHash);
      }

      console.log();
      console.log(format.majorSuccess('Build completed successfully'));
    }
  } catch (error) {
    console.error(format.error('Build failed:'), error.message);
    if (error.stack && args.verbose) {
      console.error(format.muted(error.stack));
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(format.error('Build failed:'), error.message);
    process.exit(1);
  });
}

module.exports = { generateMeshConfig, getMeshSourceHash };
