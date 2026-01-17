import axios from 'axios';
import { PackageMetadata, Maintainer } from '../types/index.js';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

interface NpmPackageResponse {
    name: string;
    'dist-tags'?: { latest?: string };
    time?: Record<string, string>;
    maintainers?: Array<{ name: string; email?: string }>;
    license?: string;
    repository?: { type?: string; url?: string };
    homepage?: string;
    description?: string;
    versions?: Record<string, unknown>;
}

/**
 * Fetch package metadata from NPM registry
 */
export async function fetchNpmMetadata(packageName: string): Promise<PackageMetadata> {
    try {
        const response = await axios.get<NpmPackageResponse>(
            `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}`,
            {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                },
            }
        );

        const data = response.data;
        const latestVersion = data['dist-tags']?.latest || '';

        // Get last published date
        let lastPublished: Date | null = null;
        if (data.time) {
            const modifiedTime = data.time.modified || data.time[latestVersion];
            if (modifiedTime) {
                lastPublished = new Date(modifiedTime);
            }
        }

        // Parse maintainers
        const maintainers: Maintainer[] = (data.maintainers || []).map((m) => ({
            name: m.name,
            email: m.email,
        }));

        // Parse repository URL
        let repositoryUrl: string | null = null;
        if (data.repository?.url) {
            repositoryUrl = cleanGitUrl(data.repository.url);
        }

        return {
            name: packageName,
            version: latestVersion,
            lastPublished,
            maintainers,
            license: data.license || null,
            repositoryUrl,
            homepage: data.homepage || null,
            description: data.description || null,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                throw new Error(`Package not found: ${packageName}`);
            }
            throw new Error(`Failed to fetch ${packageName}: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Clean git URL to get a proper HTTPS URL
 */
function cleanGitUrl(url: string): string {
    return url
        .replace(/^git\+/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/^ssh:\/\/git@/, 'https://')
        .replace(/\.git$/, '')
        .replace(/git@github\.com:/, 'https://github.com/');
}
