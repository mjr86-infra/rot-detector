import { Dependency } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

/**
 * Parse a package.json file and extract dependencies
 */
export function parsePackageJson(filePath: string): Dependency[] {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    let packageJson: PackageJson;

    try {
        packageJson = JSON.parse(content);
    } catch (e) {
        throw new Error(`Invalid JSON in ${filePath}: ${(e as Error).message}`);
    }

    const dependencies: Dependency[] = [];

    // Parse regular dependencies
    if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
            dependencies.push({
                name,
                version: cleanVersion(version),
                type: 'direct',
                source: 'npm',
                isDev: false,
            });
        }
    }

    // Parse dev dependencies
    if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
            dependencies.push({
                name,
                version: cleanVersion(version),
                type: 'direct',
                source: 'npm',
                isDev: true,
            });
        }
    }

    return dependencies;
}

/**
 * Clean version string by removing semver prefixes
 */
function cleanVersion(version: string): string {
    // Remove ^, ~, >=, >, <, <=, = prefixes
    return version.replace(/^[\^~>=<]+/, '').trim();
}
