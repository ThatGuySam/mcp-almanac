/**
 * $ pnpm tsx scripts/update.ts
 */

import assert from "node:assert/strict";
import { GitHubTreeResponseSchema } from "@lib/github-schema";
import type { GithubTreeItem } from "@lib/github-schema";
import { getServerEntries } from "../src/lib/collections";
import { cachedFetch } from "@lib/utils";
import { findPotentialServers } from "@lib/github";

/**
 * Maximum number of repos to scan per topic.
 * Enforces a boundary on external API calls.
 */
const REPO_LIMIT = 200;

const GITHUB_BASENAME = "ungh.cc";

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
		`https://${GITHUB_BASENAME}/repos/${owner}/${repo}` + `/git/trees/${branch}?recursive=1`;
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

// --- Script Entry Point ---
(async () => {
	try {
		await findPotentialServers({ repoLimit: REPO_LIMIT });
		process.exit(0); // Explicit success exit code.
	} catch (error) {
		// Catch unexpected errors (like assertion failures)
		// at the top level.
		console.error("Unhandled error during script execution:", error);
		process.exit(1); // Explicit failure exit code.
	}
})();
