// Package metadata from registries
export interface PackageMetadata {
    name: string;
    version: string;
    lastPublished: Date | null;
    maintainers: Maintainer[];
    license: string | null;
    repositoryUrl: string | null;
    homepage: string | null;
    description: string | null;
}

export interface Maintainer {
    name: string;
    email?: string;
}

// Health analysis results
export interface HealthScore {
    overall: number;  // 0-100
    freshness: FreshnessScore;
    maintainerHealth: MaintainerScore;
    licenseHealth: LicenseScore;
}

export interface FreshnessScore {
    score: number;  // 0-100
    lastUpdate: Date | null;
    daysSinceUpdate: number | null;
    status: 'active' | 'stale' | 'abandoned' | 'unknown';
}

export interface MaintainerScore {
    score: number;  // 0-100
    count: number;
    status: 'healthy' | 'warning' | 'critical';
}

export interface LicenseScore {
    score: number;  // 0-100
    license: string | null;
    status: 'approved' | 'warning' | 'unknown' | 'deprecated';
}

// Dependency types
export interface Dependency {
    name: string;
    version: string;
    type: 'direct' | 'transitive';
    source: 'npm' | 'pypi' | 'go';
    isDev: boolean;
}

// Analysis result for a single dependency
export interface DependencyAnalysis {
    dependency: Dependency;
    metadata: PackageMetadata | null;
    health: HealthScore | null;
    error?: string;
}

// Full scan result
export interface ScanResult {
    file: string;
    source: 'npm' | 'pypi' | 'go';
    scannedAt: Date;
    dependencies: DependencyAnalysis[];
    summary: ScanSummary;
}

export interface ScanSummary {
    total: number;
    healthy: number;   // 80-100
    warning: number;   // 50-79
    critical: number;  // 0-49
    failed: number;    // Could not analyze
}

// Risk level classification
export type RiskLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

export function getRiskLevel(score: number | null): RiskLevel {
    if (score === null) return 'unknown';
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'warning';
    return 'critical';
}
