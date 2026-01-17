import chalk from 'chalk';
import Table from 'cli-table3';
import { DependencyAnalysis, ScanResult, getRiskLevel } from '../types/index.js';
import { formatDaysSinceUpdate } from '../analyzer/health-scorer.js';

/**
 * Print scan results to console with colors
 */
export function printReport(result: ScanResult, verbose: boolean = false): void {
    console.log('\n');
    console.log(chalk.bold.cyan('🧟 Dependency Rot Detector'));
    console.log(chalk.gray(`Scanned: ${result.file}`));
    console.log(chalk.gray(`Source: ${result.source.toUpperCase()}`));
    console.log(chalk.gray(`Time: ${result.scannedAt.toISOString()}`));
    console.log('\n');

    // Create table
    const table = new Table({
        head: [
            chalk.white.bold('Package'),
            chalk.white.bold('Score'),
            chalk.white.bold('Last Update'),
            chalk.white.bold('Maintainers'),
            chalk.white.bold('License'),
            chalk.white.bold('Status'),
        ],
        colWidths: [30, 8, 16, 13, 15, 12],
        style: {
            head: [],
            border: ['gray'],
        },
    });

    // Sort by score (worst first)
    const sorted = [...result.dependencies].sort((a, b) => {
        const scoreA = a.health?.overall ?? 999;
        const scoreB = b.health?.overall ?? 999;
        return scoreA - scoreB;
    });

    for (const dep of sorted) {
        const row = formatDependencyRow(dep, verbose);
        table.push(row);
    }

    console.log(table.toString());
    console.log('\n');

    // Print summary
    printSummary(result);
}

/**
 * Format a single dependency row for the table
 */
function formatDependencyRow(dep: DependencyAnalysis, verbose: boolean): string[] {
    if (dep.error) {
        return [
            chalk.gray(dep.dependency.name),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.red('Error'),
        ];
    }

    if (!dep.health) {
        return [
            chalk.gray(dep.dependency.name),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.gray('—'),
            chalk.yellow('Unknown'),
        ];
    }

    const score = dep.health.overall;
    const risk = getRiskLevel(score);

    // Format score with color
    let scoreStr: string;
    let statusStr: string;
    let statusEmoji: string;

    switch (risk) {
        case 'healthy':
            scoreStr = chalk.green.bold(score.toString());
            statusStr = chalk.green('Healthy');
            statusEmoji = '🟢';
            break;
        case 'warning':
            scoreStr = chalk.yellow.bold(score.toString());
            statusStr = chalk.yellow('Warning');
            statusEmoji = '🟡';
            break;
        case 'critical':
            scoreStr = chalk.red.bold(score.toString());
            statusStr = chalk.red('Critical');
            statusEmoji = '🔴';
            break;
        default:
            scoreStr = chalk.gray(score.toString());
            statusStr = chalk.gray('Unknown');
            statusEmoji = '⚪';
    }

    // Format last update
    const lastUpdate = formatDaysSinceUpdate(dep.health.freshness.daysSinceUpdate);
    let lastUpdateStr: string;
    if (dep.health.freshness.status === 'abandoned') {
        lastUpdateStr = chalk.red(lastUpdate);
    } else if (dep.health.freshness.status === 'stale') {
        lastUpdateStr = chalk.yellow(lastUpdate);
    } else {
        lastUpdateStr = chalk.green(lastUpdate);
    }

    // Format maintainer count
    const maintainerCount = dep.health.maintainerHealth.count;
    let maintainerStr: string;
    if (maintainerCount >= 3) {
        maintainerStr = chalk.green(maintainerCount.toString());
    } else if (maintainerCount >= 2) {
        maintainerStr = chalk.yellow(maintainerCount.toString());
    } else {
        maintainerStr = chalk.red(maintainerCount.toString());
    }

    // Format license
    const license = dep.health.licenseHealth.license || 'Unknown';
    let licenseStr: string;
    if (dep.health.licenseHealth.status === 'approved') {
        licenseStr = chalk.green(truncate(license, 13));
    } else if (dep.health.licenseHealth.status === 'deprecated') {
        licenseStr = chalk.red(truncate(license, 13));
    } else {
        licenseStr = chalk.yellow(truncate(license, 13));
    }

    // Package name with dev indicator
    let pkgName = dep.dependency.name;
    if (dep.dependency.isDev) {
        pkgName = chalk.gray(`${pkgName} (dev)`);
    }

    return [
        truncate(pkgName, 28),
        `${statusEmoji} ${scoreStr}`,
        lastUpdateStr,
        maintainerStr,
        licenseStr,
        statusStr,
    ];
}

/**
 * Print summary section
 */
function printSummary(result: ScanResult): void {
    const { summary } = result;

    console.log(chalk.bold('Summary'));
    console.log(chalk.gray('─'.repeat(50)));

    const total = chalk.white.bold(summary.total.toString());
    const healthy = chalk.green.bold(summary.healthy.toString());
    const warning = chalk.yellow.bold(summary.warning.toString());
    const critical = chalk.red.bold(summary.critical.toString());
    const failed = chalk.gray.bold(summary.failed.toString());

    console.log(`  Total packages: ${total}`);
    console.log(`  🟢 Healthy (80-100): ${healthy}`);
    console.log(`  🟡 Warning (50-79):  ${warning}`);
    console.log(`  🔴 Critical (0-49):  ${critical}`);

    if (summary.failed > 0) {
        console.log(`  ⚪ Failed to check:  ${failed}`);
    }

    console.log('\n');

    // Recommendation
    if (summary.critical > 0) {
        console.log(chalk.red.bold('⚠️  Action Required!'));
        console.log(chalk.red('Some dependencies are critical and should be reviewed or replaced.'));
    } else if (summary.warning > 0) {
        console.log(chalk.yellow('📋 Some dependencies could use attention.'));
    } else {
        console.log(chalk.green('✅ All dependencies look healthy!'));
    }

    console.log('\n');
}

/**
 * Print results as JSON
 */
export function printJsonReport(result: ScanResult): void {
    // Convert dates to ISO strings for JSON output
    const jsonResult = {
        ...result,
        scannedAt: result.scannedAt.toISOString(),
        dependencies: result.dependencies.map((dep) => ({
            ...dep,
            metadata: dep.metadata ? {
                ...dep.metadata,
                lastPublished: dep.metadata.lastPublished?.toISOString() || null,
            } : null,
            health: dep.health ? {
                ...dep.health,
                freshness: {
                    ...dep.health.freshness,
                    lastUpdate: dep.health.freshness.lastUpdate?.toISOString() || null,
                },
            } : null,
        })),
    };

    console.log(JSON.stringify(jsonResult, null, 2));
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '…';
}
