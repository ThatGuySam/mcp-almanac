/**
 * $ pnpm tsx scripts/update.ts
 */

import { GitHubSearchResponseSchema, GitHubTreeResponseSchema } from "@lib/github-schema";
import type { GithubTreeItem } from "@lib/github-schema";
import { getServerEntries } from "../src/lib/collections";
import { z } from "zod";

/**
 * Maximum number of repos to scan
 */
const REPO_LIMIT = 10;

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

/**
 * Schema for the GitHub Get Content API response.
 * We only care about the content and encoding for now.
 */
const GithubContentResponseSchema = z.object({
	// We expect base64 encoding for files like package.json
	encoding: z.literal("base64"),
	// The actual base64 encoded content
	content: z.string(),
	// Other fields exist but are ignored here:
	// name, path, sha, size, url, html_url, git_url,
	// download_url, type, _links
});

/**
 * Options for fetching a file's content from GitHub.
 */
interface FetchFileContentOptions {
	owner: string;
	repo: string;
	path: string; // Path to the file, e.g., "package.json"
	ref?: string; // Optional branch, tag, or commit SHA
	token?: string; // Optional GitHub token for auth
}

/**
 * Fetches the content of a specific file from a GitHub
 * repository using the fetch API.
 * @param options - Repository owner, name, file path,
 *                  optional ref, and optional auth token.
 * @returns A promise that resolves to the file content
 *          (decoded string) or null if an error occurs
 *          or the file is not found/valid.
 */
async function fetchFileContent(options: FetchFileContentOptions): Promise<string | null> {
	const { owner, repo, path, ref, token } = options;

	// Construct the API URL for the Get Contents endpoint.
	let apiUrl = `https://api.github.com/repos/${owner}/${repo}` + `/contents/${path}`;
	if (ref) {
		apiUrl += `?ref=${ref}`;
	}

	// Set up the necessary headers for the GitHub API.
	const requestHeaders: HeadersInit = {
		// Standard v3 API header is fine here.
		Accept: "application/vnd.github.v3+json",
	};

	// Add Authorization header if a token is provided.
	if (token) {
		requestHeaders["Authorization"] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(apiUrl, {
			method: "GET",
			headers: requestHeaders,
		});

		// 404 specifically means the file wasn't found.
		if (response.status === 404) {
			// console.log(
			// 	`File not found: ${path} in ${owner}/${repo}` +
			// 		(ref ? ` at ref ${ref}` : ""),
			// );
			return null;
		}

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`HTTP error fetching content for ${path} in ` +
					`${owner}/${repo}! Status: ${response.status}` +
					`\nMessage: ${errorText}`,
			);
			// Don't throw, just return null for non-404 errors too
			return null;
		}

		// Parse and validate the JSON response structure.
		const rawData = await response.json();
		const validationResult = GithubContentResponseSchema.safeParse(rawData);

		if (!validationResult.success) {
			console.error(
				`Invalid API response structure for ${path} in ` + `${owner}/${repo}:`,
				validationResult.error.errors,
			);
			return null;
		}

		const data = validationResult.data;

		// Decode the Base64 content.
		// Need Buffer for base64 decoding in Node.js.
		return Buffer.from(data.content, "base64").toString("utf-8");
	} catch (error) {
		console.error(`Error fetching file content for ${path} ` + `in ${owner}/${repo}:`, error);
		return null; // Return null to indicate failure.
	}
}

(async () => {
	const repos = await fetchTopicRepos("mcp");

	// const repo = await fetchRepoStructure({
	// 	owner: repos[0].owner,
	// 	repo: repos[0].name,
	// 	branch: repos[0].defaultBranch,
	// });

	// console.log({ repo });

	const potentialServers = [];

	for (const repo of repos.slice(0, REPO_LIMIT)) {
		console.log(`Checking ${repo.owner}/${repo.name}...`);
		const pkgJsonContent = await fetchFileContent({
			owner: repo.owner,
			repo: repo.name,
			path: "package.json",
			ref: repo.defaultBranch,
		});

		if (!pkgJsonContent) {
			console.log(` -> No package.json found.`);
			continue;
		}

		try {
			const pkg = JSON.parse(pkgJsonContent);

			const hasBin = pkg && typeof pkg.bin !== "undefined";
			const hasSdkDep =
				pkg &&
				((pkg.dependencies && pkg.dependencies["@modelcontextprotocol/sdk"]) ||
					(pkg.devDependencies && pkg.devDependencies["@modelcontextprotocol/sdk"]));

			if (hasBin && hasSdkDep) {
				console.log(` --> Found potential server!`);
				potentialServers.push(repo);
			} else {
				console.log(` -> Does not meet criteria (bin: ${hasBin}, sdk: ${hasSdkDep})`);
			}
		} catch (e) {
			console.error(` -> Error parsing package.json for ${repo.owner}/${repo.name}:`, e);
		}
	}

	console.log("\n--- Potential MCP Servers Found ---");
	potentialServers.forEach((server) =>
		console.log(`- ${server.owner}/${server.name} (${server.repoUrl})`),
	);
	console.log(
		`------------------------------------\nChecked ${Math.min(repos.length, REPO_LIMIT)} repositories. Found ${potentialServers.length}.`,
	);

	process.exit(0);
})();
