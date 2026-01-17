import { Dependency } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse a requirements.txt file and extract dependencies
 */
export function parseRequirementsTxt(filePath: string): Dependency[] {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');
    const dependencies: Dependency[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
            continue;
        }

        // Skip options like -r, -e, --index-url, etc.
        if (line.startsWith('-')) {
            continue;
        }

        // Skip URLs (git+, http://, https://)
        if (line.includes('://') || line.startsWith('git+')) {
            continue;
        }

        const parsed = parseRequirementLine(line);
        if (parsed) {
            dependencies.push({
                name: parsed.name,
                version: parsed.version,
                type: 'direct',
                source: 'pypi',
                isDev: false, // requirements.txt doesn't distinguish
            });
        }
    }

    return dependencies;
}

interface ParsedRequirement {
    name: string;
    version: string;
}

/**
 * Parse a single requirement line
 * Handles formats like:
 * - package
 * - package==1.0.0
 * - package>=1.0.0,<2.0.0
 * - package[extra]==1.0.0
 * - package~=1.0.0
 */
function parseRequirementLine(line: string): ParsedRequirement | null {
    // Remove inline comments
    const commentIndex = line.indexOf('#');
    if (commentIndex !== -1) {
        line = line.substring(0, commentIndex).trim();
    }

    if (!line) return null;

    // Remove environment markers (e.g., ; python_version >= "3.6")
    const markerIndex = line.indexOf(';');
    if (markerIndex !== -1) {
        line = line.substring(0, markerIndex).trim();
    }

    // Match package name with optional extras and version specifiers
    // Pattern: package_name[extras]<version_specifiers>
    const match = line.match(/^([a-zA-Z0-9_-]+)(?:\[[^\]]+\])?\s*(.*)$/);

    if (!match) {
        return null;
    }

    const name = match[1];
    let version = '*';

    if (match[2]) {
        // Extract version from specifiers like ==1.0.0, >=1.0.0, etc.
        const versionMatch = match[2].match(/[=~<>!]+\s*([0-9][0-9a-zA-Z.*-]*)/);
        if (versionMatch) {
            version = versionMatch[1];
        }
    }

    return { name, version };
}
