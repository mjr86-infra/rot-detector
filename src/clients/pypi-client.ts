import axios from 'axios';
import { PackageMetadata, Maintainer } from '../types/index.js';

const PYPI_API_URL = 'https://pypi.org/pypi';

interface PyPIResponse {
    info: {
        name: string;
        version: string;
        author?: string;
        author_email?: string;
        maintainer?: string;
        maintainer_email?: string;
        license?: string;
        home_page?: string;
        project_url?: string;
        project_urls?: Record<string, string>;
        summary?: string;
    };
    releases: Record<string, Array<{ upload_time: string }>>;
}

/**
 * Fetch package metadata from PyPI
 */
export async function fetchPyPIMetadata(packageName: string): Promise<PackageMetadata> {
    try {
        const response = await axios.get<PyPIResponse>(
            `${PYPI_API_URL}/${encodeURIComponent(packageName)}/json`,
            {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                },
            }
        );

        const data = response.data;
        const info = data.info;

        // Get last published date from latest release
        let lastPublished: Date | null = null;
        const latestVersion = info.version;
        if (data.releases && data.releases[latestVersion]) {
            const releases = data.releases[latestVersion];
            if (releases.length > 0) {
                lastPublished = new Date(releases[0].upload_time);
            }
        }

        // Parse maintainers (PyPI doesn't have a clear maintainer list like NPM)
        const maintainers: Maintainer[] = [];
        if (info.maintainer) {
            maintainers.push({
                name: info.maintainer,
                email: info.maintainer_email,
            });
        } else if (info.author) {
            maintainers.push({
                name: info.author,
                email: info.author_email,
            });
        }

        // Get repository URL from project_urls
        let repositoryUrl: string | null = null;
        if (info.project_urls) {
            repositoryUrl =
                info.project_urls['Source'] ||
                info.project_urls['Repository'] ||
                info.project_urls['Code'] ||
                info.project_urls['GitHub'] ||
                info.project_urls['Homepage'] ||
                null;
        }

        return {
            name: packageName,
            version: latestVersion,
            lastPublished,
            maintainers,
            license: info.license || null,
            repositoryUrl,
            homepage: info.home_page || null,
            description: info.summary || null,
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
