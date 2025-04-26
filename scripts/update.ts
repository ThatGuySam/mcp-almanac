/**
 * $ pnpm tsx scripts/update.ts
 */

import { GitHubSearchResponseSchema, GitHubTreeResponseSchema } from "@lib/github-schema";
import type { GithubTreeItem } from "@lib/github-schema";
import { getServerEntries } from "../src/lib/collections";

const servers = await getServerEntries();

async function fetchTopicRepos(topic: string) {
	const response = await fetch(`https://api.github.com/search/repositories?q=topic:${topic}`, {
		headers: {
			Accept: "application/vnd.github.mercy-preview+json",
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch topic repos: ${response.statusText}`);
	}

	const data = GitHubSearchResponseSchema.parse(await response.json());

	console.log(data.items[0]);

	return data.items.map((item) => ({
		id: item.id,
		name: item.name,
		description: item.description,
		owner: item.owner.login,
		repoUrl: item.html_url,
		defaultBranch: item.default_branch,
	}));
}

/**
 * Fetches the recursive file structure (tree) of a GitHub
 * repository branch using the fetch API.
 * @param options - The repository owner, name, branch, and
 *                  optional auth token.
 * @returns A promise that resolves to the array of tree
 *          items or null if an error occurs.
 */
async function fetchRepoStructure(options: {
	owner: string;
	repo: string;
	branch: string;
}): Promise<GithubTreeItem[] | null> {
	const { owner, repo, branch } = options;

	// Construct the API URL for the Git Trees endpoint
	// with the recursive flag.
	const apiUrl =
		`https://api.github.com/repos/${owner}/${repo}` + `/git/trees/${branch}?recursive=1`;

	// Set up the necessary headers for the GitHub API.
	const requestHeaders: HeadersInit = {
		Accept: "application/vnd.github.v3+json",
	};

	// Add Authorization header if a token is provided.
	// if (token) {
	// 	requestHeaders["Authorization"] = `Bearer ${token}`;
	// }

	try {
		const response = await fetch(apiUrl, {
			method: "GET", // GET is default, but explicit is fine
			headers: requestHeaders,
		});

		if (!response.ok) {
			// Log detailed error if response is not OK.
			const errorText = await response.text();
			console.error(`HTTP error! Status: ${response.status}` + `\nMessage: ${errorText}`);
			throw new Error(`Failed to fetch repo structure: ${response.status}`);
		}

		// Parse the JSON response.
		const data = GitHubTreeResponseSchema.parse(await response.json());

		// Warn if the returned tree was too large and got truncated.
		if (data.truncated) {
			console.warn(`Warning: Fetched tree for ${owner}/${repo} ` + `was truncated by GitHub API.`);
		}

		return data.tree;
	} catch (error) {
		console.error(`Error fetching repo structure for ${owner}/${repo}:`, error);
		return null; // Return null to indicate failure.
	}
}

(async () => {
	const repos = await fetchTopicRepos("mcp");

	const repo = await fetchRepoStructure({
		owner: repos[0].owner,
		repo: repos[0].name,
		branch: repos[0].defaultBranch,
	});

	console.log({ repo });

	process.exit(0);
})();
