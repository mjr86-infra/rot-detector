import axios from 'axios';

const GITHUB_API_URL = 'https://api.github.com';

export interface GitHubRepoHealth {
    lastCommitDate: Date | null;
    contributorCount: number;
    openIssues: number;
    stars: number;
    isArchived: boolean;
}

/**
 * Extract owner and repo from a GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    // Handle various GitHub URL formats
    const patterns = [
        /github\.com[/:]([^/]+)\/([^/.\s]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, ''),
            };
        }
    }
    return null;
}

/**
 * Fetch repository health metrics from GitHub API
 * Note: Without auth, limited to 60 requests/hour
 */
export async function fetchGitHubRepoHealth(
    repositoryUrl: string,
    token?: string
): Promise<GitHubRepoHealth | null> {
    const parsed = parseGitHubUrl(repositoryUrl);
    if (!parsed) {
        return null;
    }

    const { owner, repo } = parsed;
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rot-detector-cli',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        // Fetch repo info
        const repoResponse = await axios.get(
            `${GITHUB_API_URL}/repos/${owner}/${repo}`,
            { headers, timeout: 10000 }
        );

        const repoData = repoResponse.data;

        // Fetch latest commit
        let lastCommitDate: Date | null = null;
        try {
            const commitsResponse = await axios.get(
                `${GITHUB_API_URL}/repos/${owner}/${repo}/commits`,
                { headers, timeout: 10000, params: { per_page: 1 } }
            );
            if (commitsResponse.data.length > 0) {
                lastCommitDate = new Date(commitsResponse.data[0].commit.committer.date);
            }
        } catch {
            // Commits may not be accessible
        }

        // Fetch contributor count
        let contributorCount = 0;
        try {
            const contributorsResponse = await axios.get(
                `${GITHUB_API_URL}/repos/${owner}/${repo}/contributors`,
                { headers, timeout: 10000, params: { per_page: 1, anon: false } }
            );
            // GitHub returns total count in Link header for pagination
            const linkHeader = contributorsResponse.headers['link'];
            if (linkHeader) {
                const match = linkHeader.match(/page=(\d+)>; rel="last"/);
                if (match) {
                    contributorCount = parseInt(match[1], 10);
                }
            } else {
                contributorCount = contributorsResponse.data.length;
            }
        } catch {
            // Contributors may not be accessible
        }

        return {
            lastCommitDate,
            contributorCount,
            openIssues: repoData.open_issues_count || 0,
            stars: repoData.stargazers_count || 0,
            isArchived: repoData.archived || false,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 403) {
                // Rate limited
                console.warn('GitHub API rate limit reached. Consider using --github-token');
                return null;
            }
            if (error.response?.status === 404) {
                return null;
            }
        }
        return null;
    }
}
