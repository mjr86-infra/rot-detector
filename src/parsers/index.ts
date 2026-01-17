import { parsePackageJson } from './package-json.js';
import { parseRequirementsTxt } from './requirements-txt.js';
import { Dependency } from '../types/index.js';
import * as path from 'path';

export type FileType = 'npm' | 'pypi' | 'unknown';

/**
 * Detect file type based on filename
 */
export function detectFileType(filePath: string): FileType {
    const basename = path.basename(filePath).toLowerCase();

    if (basename === 'package.json') {
        return 'npm';
    }

    if (basename === 'requirements.txt' || basename.endsWith('.txt')) {
        // Could be a requirements file
        return 'pypi';
    }

    return 'unknown';
}

/**
 * Parse a dependency file and return dependencies
 */
export function parseDependencyFile(filePath: string): Dependency[] {
    const fileType = detectFileType(filePath);

    switch (fileType) {
        case 'npm':
            return parsePackageJson(filePath);
        case 'pypi':
            return parseRequirementsTxt(filePath);
        default:
            throw new Error(`Unsupported file type: ${path.basename(filePath)}`);
    }
}

export { parsePackageJson } from './package-json.js';
export { parseRequirementsTxt } from './requirements-txt.js';
