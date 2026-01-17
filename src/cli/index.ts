#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

import { parseDependencyFile, detectFileType } from '../parsers/index.js';
import { fetchNpmMetadata, fetchPyPIMetadata, fetchGitHubRepoHealth } from '../clients/index.js';
import { calculateHealthScore } from '../analyzer/index.js';
import { printReport, printJsonReport } from './reporter.js';
import {
    Dependency,
    DependencyAnalysis,
    ScanResult,
    ScanSummary,
    PackageMetadata,
    getRiskLevel,
} from '../types/index.js';

const program = new Command();

program
    .name('rot-detector')
    .description('🧟 Detect dependency rot in your projects')
    .version('1.0.0');

program
    .command('scan')
    .description('Scan a dependency file for software rot')
    .argument('[path]', 'Path to package.json or requirements.txt', '.')
    .option('--json', 'Output results as JSON')
    .option('--threshold <score>', 'Fail if any dependency scores below this threshold', '0')
    .option('--github-token <token>', 'GitHub token for enhanced repo analysis')
    .option('--no-github', 'Skip GitHub repository analysis')
    .option('--dev', 'Include dev dependencies in analysis')
    .option('-v, --verbose', 'Show verbose output')
    .action(async (inputPath: string, options) => {
        try {
            await runScan(inputPath, options);
        } catch (error) {
            console.error(chalk.red(`Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });

async function runScan(inputPath: string, options: {
    json?: boolean;
    threshold?: string;
    githubToken?: string;
    github?: boolean;
    dev?: boolean;
    verbose?: boolean;
}): Promise<void> {
    // Resolve file path
    let filePath = path.resolve(inputPath);

    // If it's a directory, look for package.json or requirements.txt
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        if (fs.existsSync(path.join(filePath, 'package.json'))) {
            filePath = path.join(filePath, 'package.json');
        } else if (fs.existsSync(path.join(filePath, 'requirements.txt'))) {
            filePath = path.join(filePath, 'requirements.txt');
        } else {
            throw new Error('No package.json or requirements.txt found in directory');
        }
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileType = detectFileType(filePath);
    if (fileType === 'unknown') {
        throw new Error(`Unsupported file type: ${path.basename(filePath)}`);
    }

    // Parse dependencies
    const spinner = ora('Parsing dependencies...').start();
    let dependencies: Dependency[];

    try {
        dependencies = parseDependencyFile(filePath);
    } catch (error) {
        spinner.fail('Failed to parse dependencies');
        throw error;
    }

    // Filter out dev dependencies if not requested
    if (!options.dev && fileType === 'npm') {
        dependencies = dependencies.filter((d) => !d.isDev);
    }

    spinner.succeed(`Found ${dependencies.length} dependencies`);

    // Analyze each dependency
    const analyses: DependencyAnalysis[] = [];
    const analyzeSpinner = ora('Analyzing dependencies...').start();

    for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        analyzeSpinner.text = `Analyzing ${dep.name} (${i + 1}/${dependencies.length})...`;

        try {
            // Fetch metadata from appropriate registry
            let metadata: PackageMetadata;
            if (dep.source === 'npm') {
                metadata = await fetchNpmMetadata(dep.name);
            } else if (dep.source === 'pypi') {
                metadata = await fetchPyPIMetadata(dep.name);
            } else {
                throw new Error(`Unsupported source: ${dep.source}`);
            }

            // Optionally fetch GitHub data
            let githubHealth = null;
            if (options.github !== false && metadata.repositoryUrl) {
                githubHealth = await fetchGitHubRepoHealth(
                    metadata.repositoryUrl,
                    options.githubToken
                );
            }

            // Calculate health score
            const health = calculateHealthScore(metadata, githubHealth);

            analyses.push({
                dependency: dep,
                metadata,
                health,
            });
        } catch (error) {
            analyses.push({
                dependency: dep,
                metadata: null,
                health: null,
                error: (error as Error).message,
            });
        }

        // Small delay to avoid rate limiting
        await sleep(100);
    }

    analyzeSpinner.succeed('Analysis complete');

    // Calculate summary
    const summary: ScanSummary = {
        total: analyses.length,
        healthy: analyses.filter((a) => getRiskLevel(a.health?.overall ?? null) === 'healthy').length,
        warning: analyses.filter((a) => getRiskLevel(a.health?.overall ?? null) === 'warning').length,
        critical: analyses.filter((a) => getRiskLevel(a.health?.overall ?? null) === 'critical').length,
        failed: analyses.filter((a) => a.error !== undefined).length,
    };

    // Create result object
    const result: ScanResult = {
        file: filePath,
        source: fileType as 'npm' | 'pypi',
        scannedAt: new Date(),
        dependencies: analyses,
        summary,
    };

    // Output results
    if (options.json) {
        printJsonReport(result);
    } else {
        printReport(result, options.verbose);
    }

    // Check threshold
    const threshold = parseInt(options.threshold || '0', 10);
    if (threshold > 0) {
        const belowThreshold = analyses.filter(
            (a) => a.health && a.health.overall < threshold
        );
        if (belowThreshold.length > 0) {
            console.error(
                chalk.red(`\n❌ ${belowThreshold.length} dependencies scored below threshold of ${threshold}`)
            );
            process.exit(1);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

program.parse();
