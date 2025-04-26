/**
 * $ pnpm tsx scripts/update.ts
 */

import assert from "node:assert/strict";
import { GitHubTreeResponseSchema } from "@lib/github-schema";
import type { GithubTreeItem } from "@lib/github-schema";
import { getServerEntries } from "../src/lib/collections";
import { z } from "zod";
import { cachedFetch } from "@lib/utils";
import { fetchTopicRepos } from "@lib/github";
import type { RepoInfo } from "@lib/types";

/**
 * Maximum number of repos to scan per topic.
 * Enforces a boundary on external API calls.
 */
const REPO_LIMIT = 100;

// Ensure servers are loaded before proceeding.
// This acts as an early check for required data.
const servers = await getServerEntries();
assert(Array.isArray(servers), "getServerEntries should return an array");

/**
 * Options for fetching repository structure.
 */
interface FetchRepoStructureOptions {
	owner: string;
	repo: string;
	branch: string;
	// token?: string; // Auth token not currently used
}

/**
 * Fetches the recursive file structure (tree) of a GitHub
 * repository branch.
 * @param options - Repo owner, name, and branch.
 * @returns A promise resolving to the tree items or null
 *          if an operational error occurs (e.g., repo not found).
 */
async function fetchRepoStructure(
	options: FetchRepoStructureOptions,
): Promise<GithubTreeItem[] | null> {
	const { owner, repo, branch } = options;
	// Assert preconditions: owner, repo, branch are non-empty strings.
	assert(typeof owner === "string" && owner.length > 0, "owner invalid");
	assert(typeof repo === "string" && repo.length > 0, "repo invalid");
	assert(typeof branch === "string" && branch.length > 0, "branch invalid");

	const apiUrl =
		`https://api.github.com/repos/${owner}/${repo}` + `/git/trees/${branch}?recursive=1`;
	const headers: HeadersInit = {
		Accept: "application/vnd.github.v3+json",
	};
	// if (token) { headers["Authorization"] = `Bearer ${token}`; }

	try {
		const response = await cachedFetch(apiUrl, { method: "GET", headers });

		// Assert intermediate state: response should exist.
		assert(response, "Fetch API did not return a response");

		// Handle expected operational errors (like 404 Not Found).
		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`HTTP error fetching tree for ${owner}/${repo}: ` +
					`${response.status}\nMessage: ${errorText}`,
			);
			// Return null for operational errors, don't assert/crash.
			return null;
		}

		const rawData = await response.json();
		const validationResult = GitHubTreeResponseSchema.safeParse(rawData);

		// Assert successful validation.
		assert(validationResult.success, "GitHub tree response failed Zod validation");

		const data = validationResult.data;
		// Assert postcondition: tree must be an array.
		assert(Array.isArray(data.tree), "Expected tree to be an array");

		if (data.truncated) {
			// This is an API limitation, not an error our code caused.
			console.warn(`Warning: Fetched tree for ${owner}/${repo} was truncated.`);
		}

		return data.tree;
	} catch (error) {
		// Catch fetch/network errors - these are operational.
		console.error(`Error fetching repo structure for ${owner}/${repo}:`, error);
		return null; // Indicate failure gracefully.
	}
}

/**
 * Schema for expected GitHub content API response.
 * We only need encoding and content.
 */
const GithubContentResponseSchema = z.object({
	encoding: z.literal("base64"),
	content: z.string().min(1), // Content should not be empty
});

/**
 * Options for fetching file content.
 */
interface FetchFileContentOptions {
	owner: string;
	repo: string;
	path: string;
	ref?: string;
	// token?: string; // Auth token not currently used
}

/**
 * Fetches and decodes content of a specific file from GitHub.
 * @param options - Repo owner, name, file path, optional ref.
 * @returns A promise resolving to decoded file content string
 *          or null if an operational error occurs (e.g., not found).
 */
async function fetchFileContent(options: FetchFileContentOptions): Promise<string | null> {
	const { owner, repo, path, ref } = options;
	// Assert preconditions: owner, repo, path non-empty strings.
	assert(typeof owner === "string" && owner.length > 0, "owner invalid");
	assert(typeof repo === "string" && repo.length > 0, "repo invalid");
	assert(typeof path === "string" && path.length > 0, "path invalid");
	assert(
		ref === undefined || (typeof ref === "string" && ref.length > 0),
		"ref must be undefined or a non-empty string",
	);

	let apiUrl = `https://api.github.com/repos/${owner}/${repo}` + `/contents/${path}`;
	if (ref) {
		apiUrl += `?ref=${ref}`;
	}

	const headers: HeadersInit = {
		Accept: "application/vnd.github.v3+json",
	};
	// if (token) { headers["Authorization"] = `Bearer ${token}`; }

	try {
		const response = await cachedFetch(apiUrl, { method: "GET", headers });

		// Assert intermediate state: response should exist.
		assert(response, "Fetch API did not return a response");

		// Handle operational errors (404 Not Found is expected).
		if (response.status === 404) {
			// console.log(`File not found: ${path} in ${owner}/${repo}`);
			return null;
		}

		// Handle other non-OK statuses as operational errors.
		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`HTTP error fetching content for ${path} in ` +
					`${owner}/${repo}: ${response.status}\nMessage: ${errorText}`,
			);
			return null;
		}

		const rawData = await response.json();
		const validationResult = GithubContentResponseSchema.safeParse(rawData);

		// Assert successful validation.
		assert(validationResult.success, "GitHub content response failed Zod validation");

		const data = validationResult.data;
		// Assert intermediate state after validation.
		assert(data.encoding === "base64", "Encoding must be base64");
		assert(
			typeof data.content === "string" && data.content.length > 0,
			"Content must be a non-empty string",
		);

		// Decode the content.
		const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");

		// Assert postcondition: decoded content is a string.
		assert(typeof decodedContent === "string", "Decoded content invalid");

		return decodedContent;
	} catch (error) {
		// Catch fetch/network/Buffer errors - operational.
		console.error(`Error fetching file content for ${path} in ${owner}/${repo}:`, error);
		return null; // Indicate failure gracefully.
	}
}

/**
 * Main execution logic for finding potential MCP servers.
 */
async function findPotentialServers(): Promise<void> {
	// Fetch initial list of repositories.
	const repos = await fetchTopicRepos({ topic: "mcp" });
	// Assert state after fetch.
	assert(Array.isArray(repos), "fetchTopicRepos should return array");

	const potentialServers: RepoInfo[] = [];

	// Limit iteration based on REPO_LIMIT.
	const reposToCheck = repos.slice(0, REPO_LIMIT);
	// Assert loop boundary condition.
	assert(reposToCheck.length <= REPO_LIMIT, "Loop limit check failed");

	for (const repo of reposToCheck) {
		// Assert loop invariant: repo object structure.
		assert(typeof repo === "object" && repo !== null, "Repo is null");
		assert(typeof repo.owner === "string", "Repo owner invalid");
		assert(typeof repo.name === "string", "Repo name invalid");
		assert(typeof repo.defaultBranch === "string", "Repo branch invalid");

		console.log(`Checking ${repo.owner}/${repo.name}...`);

		// Fetch package.json content.
		const pkgJsonContent = await fetchFileContent({
			owner: repo.owner,
			repo: repo.name,
			path: "package.json",
			ref: repo.defaultBranch,
		});

		// Handle expected case: package.json not found (operational).
		if (pkgJsonContent === null) {
			console.log(` -> No package.json found.`);
			continue; // Move to the next repository.
		}

		// Assert state: if not null, must be a string.
		assert(typeof pkgJsonContent === "string", "pkgJsonContent should be string if not null");

		try {
			// Parse the JSON content.
			const pkg = JSON.parse(pkgJsonContent);
			// Assert state after parsing.
			assert(typeof pkg === "object" && pkg !== null, "Parsed pkg invalid");

			// Check for criteria: presence of 'bin' and SDK dependency.
			// These checks use boolean coercion, which is acceptable here.
			const hasBin = !!pkg.bin;
			const hasSdkDep =
				!!pkg.dependencies?.["@modelcontextprotocol/sdk"] ||
				!!pkg.devDependencies?.["@modelcontextprotocol/sdk"];

			if (hasBin && hasSdkDep) {
				console.log(` --> Found potential server!`);
				potentialServers.push(repo);
			} else {
				console.log(` -> Does not meet criteria (bin: ${hasBin}, sdk: ${hasSdkDep})`);
			}
		} catch (e) {
			// Handle JSON parsing error (operational error: invalid file).
			console.error(
				` -> Error parsing package.json for ` + `${repo.owner}/${repo.name}:`,
				e instanceof Error ? e.message : String(e),
			);
			// Continue to the next repo despite parsing error.
		}
	}

	// Assert final state before output.
	assert(Array.isArray(potentialServers), "potentialServers should be array");

	// --- Output Results ---
	console.log("\n--- Potential MCP Servers Found ---");
	potentialServers.forEach((server) => {
		// Assert invariant during output loop.
		assert(typeof server.owner === "string", "Server owner invalid");
		assert(typeof server.name === "string", "Server name invalid");
		assert(typeof server.repoUrl === "string", "Server URL invalid");
		console.log(`- ${server.owner}/${server.name} (${server.repoUrl})`);
	});

	const checkedCount = Math.min(repos.length, REPO_LIMIT);
	console.log(
		`------------------------------------\nChecked ${checkedCount} ` +
			`repositories. Found ${potentialServers.length}.`,
	);
}

// --- Script Entry Point ---
(async () => {
	try {
		await findPotentialServers();
		process.exit(0); // Explicit success exit code.
	} catch (error) {
		// Catch unexpected errors (like assertion failures)
		// at the top level.
		console.error("Unhandled error during script execution:", error);
		process.exit(1); // Explicit failure exit code.
	}
})();
