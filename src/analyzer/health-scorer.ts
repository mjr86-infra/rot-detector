import {
    HealthScore,
    FreshnessScore,
    MaintainerScore,
    LicenseScore,
    PackageMetadata,
} from '../types/index.js';
import { GitHubRepoHealth } from '../clients/github-client.js';

// OSI-approved licenses (common ones)
const OSI_APPROVED_LICENSES = new Set([
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    'MPL-2.0',
    'GPL-3.0',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'LGPL-3.0',
    'LGPL-3.0-only',
    'LGPL-3.0-or-later',
    'AGPL-3.0',
    'Unlicense',
    '0BSD',
    'CC0-1.0',
    'Zlib',
    'Artistic-2.0',
    'EPL-2.0',
    'EUPL-1.2',
]);

// Deprecated or problematic licenses
const DEPRECATED_LICENSES = new Set([
    'GPL-2.0',
    'LGPL-2.0',
    'LGPL-2.1',
    'BSD-4-Clause',
    'WTFPL',
]);

// Weights for overall score calculation
const WEIGHTS = {
    freshness: 0.40,
    maintainers: 0.30,
    license: 0.30,
};

/**
 * Calculate health score for a package
 */
export function calculateHealthScore(
    metadata: PackageMetadata,
    githubHealth?: GitHubRepoHealth | null
): HealthScore {
    const freshness = calculateFreshnessScore(metadata, githubHealth);
    const maintainerHealth = calculateMaintainerScore(metadata, githubHealth);
    const licenseHealth = calculateLicenseScore(metadata);

    // Calculate weighted overall score
    const overall = Math.round(
        freshness.score * WEIGHTS.freshness +
        maintainerHealth.score * WEIGHTS.maintainers +
        licenseHealth.score * WEIGHTS.license
    );

    return {
        overall,
        freshness,
        maintainerHealth,
        licenseHealth,
    };
}

/**
 * Calculate freshness score based on last update date
 */
function calculateFreshnessScore(
    metadata: PackageMetadata,
    githubHealth?: GitHubRepoHealth | null
): FreshnessScore {
    // Use GitHub last commit if available, otherwise use registry last publish
    const lastUpdate = githubHealth?.lastCommitDate || metadata.lastPublished;

    if (!lastUpdate) {
        return {
            score: 50, // Unknown, give benefit of doubt
            lastUpdate: null,
            daysSinceUpdate: null,
            status: 'unknown',
        };
    }

    const now = new Date();
    const daysSinceUpdate = Math.floor(
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let score: number;
    let status: FreshnessScore['status'];

    if (daysSinceUpdate < 180) {
        // Less than 6 months - Active
        score = 100;
        status = 'active';
    } else if (daysSinceUpdate < 365) {
        // 6-12 months - Getting stale
        score = 75;
        status = 'active';
    } else if (daysSinceUpdate < 730) {
        // 1-2 years - Stale
        score = 40;
        status = 'stale';
    } else if (daysSinceUpdate < 1095) {
        // 2-3 years - Very stale
        score = 20;
        status = 'abandoned';
    } else {
        // 3+ years - Abandoned
        score = 5;
        status = 'abandoned';
    }

    // If GitHub repo is archived, heavily penalize
    if (githubHealth?.isArchived) {
        score = Math.min(score, 10);
        status = 'abandoned';
    }

    return {
        score,
        lastUpdate,
        daysSinceUpdate,
        status,
    };
}

/**
 * Calculate maintainer/bus factor score
 */
function calculateMaintainerScore(
    metadata: PackageMetadata,
    githubHealth?: GitHubRepoHealth | null
): MaintainerScore {
    // Use GitHub contributors if available, otherwise use registry maintainers
    const count = githubHealth?.contributorCount || metadata.maintainers.length;

    let score: number;
    let status: MaintainerScore['status'];

    if (count >= 5) {
        score = 100;
        status = 'healthy';
    } else if (count >= 3) {
        score = 85;
        status = 'healthy';
    } else if (count === 2) {
        score = 70;
        status = 'warning';
    } else if (count === 1) {
        score = 40;
        status = 'warning';
    } else {
        score = 10;
        status = 'critical';
    }

    return {
        score,
        count,
        status,
    };
}

/**
 * Calculate license health score
 */
function calculateLicenseScore(metadata: PackageMetadata): LicenseScore {
    const license = metadata.license;

    if (!license) {
        return {
            score: 30,
            license: null,
            status: 'unknown',
        };
    }

    // Normalize license string
    const normalizedLicense = license.toUpperCase().replace(/\s+/g, '-');

    // Check if deprecated
    for (const deprecated of DEPRECATED_LICENSES) {
        if (normalizedLicense.includes(deprecated.toUpperCase())) {
            return {
                score: 50,
                license,
                status: 'deprecated',
            };
        }
    }

    // Check if OSI approved
    for (const approved of OSI_APPROVED_LICENSES) {
        if (normalizedLicense.includes(approved.toUpperCase())) {
            return {
                score: 100,
                license,
                status: 'approved',
            };
        }
    }

    // Unknown license
    return {
        score: 60,
        license,
        status: 'warning',
    };
}

/**
 * Format days since update for display
 */
export function formatDaysSinceUpdate(days: number | null): string {
    if (days === null) return 'Unknown';
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 60) return '1 month ago';
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    if (days < 730) return '1 year ago';
    return `${Math.floor(days / 365)} years ago`;
}
