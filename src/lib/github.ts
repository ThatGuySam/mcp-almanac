import { GitHubSearchResponseSchema } from "./github-schema";
import { assert } from "@sindresorhus/is";
import { z } from "zod";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cachedFetch } from "./utils";
import type { MiniItem } from "./schema";
import { MiniItemSchema } from "./schema";

type CachedFetchResponse = Awaited<ReturnType<typeof cachedFetch>>;

const GITHUB_BASENAME = "ungh.cc";

/**
 * Logs the GitHub rate limit status from a Response-like object.
 * @param response - An object with a `headers` property that has a `get` method.
 */
function logRateLimitStatus(response: Response | CachedFetchResponse): void {
	// Assert that the response is a GitHub API response.
	assert.truthy(response.headers.get("x-github-media-type"), "Invalid GitHub API response");

	const limit = response.headers.get("x-ratelimit-limit");
	const remaining = response.headers.get("x-ratelimit-remaining");
	const reset = response.headers.get("x-ratelimit-reset");

	if (limit && remaining && reset) {
		const resetTime = new Date(parseInt(reset, 10) * 1000);
		// Log remaining/limit and reset time for brevity
		console.info(
			`RateLimit: ${remaining}/${limit} ` + `| Resets: ${resetTime.toLocaleTimeString()}`,
		);

		return;
	}

	// Only warn if some headers are missing,
	// as ungh.cc might not include them all
	if (!limit || !remaining || !reset) {
		console.warn("Some rate limit headers not found.");
	}
}

/**
 * Fetches repositories from GitHub based on a topic,
 * handling pagination up to a specified limit.
 * @param options - Contains the topic and repoLimit.
 * @returns A promise resolving to an array of MiniItem.
 */
export async function fetchTopicRepos(options: {
	topic: string;
	repoLimit: number; // Added repoLimit
}): Promise<MiniItem[]> {
	const { topic, repoLimit } = options;
	// Assert preconditions
	assert.nonEmptyString(topic, "topic must not be empty");
	assert.integer(repoLimit, "repoLimit must be an integer");
	assert.truthy(repoLimit > 0, "repoLimit must be positive");

	const allRepos: MiniItem[] = [];
	let page = 1;
	const perPage = 100; // Max allowed by GitHub API

	while (allRepos.length < repoLimit) {
		// Construct API URL with page and per_page params
		const apiUrl =
			`https://api.github.com/search/repositories` +
			`?q=topic:${topic}+language:typescript` +
			`&per_page=${perPage}` +
			`&page=${page}`;

		const headers: HeadersInit = {
			Accept: "application/vnd.github.mercy-preview+json",
		};

		const response = await cachedFetch(apiUrl, { headers });

		// Log rate limit status after fetch
		logRateLimitStatus(response);

		// Assert intermediate state
		assert.truthy(response.ok, `GitHub API fetch failed: ${response.status}`);

		// Handle expected operational error
		if (!response.ok) {
			console.error(
				`Failed fetch for ${topic}, page ${page}: ` + `${response.status} ${response.statusText}`,
			);
			// Stop fetching if an error occurs on a page
			break;
		}

		const rawData = await response.json();
		const parseResult = GitHubSearchResponseSchema.safeParse(rawData);

		if (!parseResult.success) {
			console.error("Failed to parse GitHub API response:", parseResult.error);
			break; // Stop if parsing fails
		}
		const { data } = parseResult;

		// Ensure items is an array, even if empty
		assert.truthy(data, "Parsed data should exist");
		// Rely on loop validation + TS inference for data.items
		// assert.array(data.items, "Expected items to be an array");

		if (data.items.length === 0) {
			break; // No more items found, exit loop
		}

		// Validate and add items to the results
		for (const item of data.items) {
			const validatedItem = MiniItemSchema.safeParse(item);
			if (validatedItem.success) {
				allRepos.push(validatedItem.data);
				// Stop if we've reached the limit
				if (allRepos.length >= repoLimit) {
					break;
				}
			} else {
				console.warn("Skipping invalid item from GitHub API:", validatedItem.error);
			}
		}

		// Check again if limit reached after processing items
		if (allRepos.length >= repoLimit) {
			break;
		}

		page++; // Move to the next page
	}

	// Return exactly the number of repos requested,
	// or fewer if total found is less than the limit.
	// The slice is implicit now as we stop adding once limit is hit.
	return allRepos;
}

const FetchFileContentOptionsSchema = z.object({
	path: z.string(),
	repo: MiniItemSchema,
});

/**
 * Options for fetching file content.
 */
type FetchFileContentOptions = z.infer<typeof FetchFileContentOptionsSchema>;

/**
 * Fetches and decodes content of a specific file from GitHub.
 * @param options - Repo owner, name, file path, optional ref.
 * @returns A promise resolving to decoded file content string
 *          or null if an operational error occurs (e.g., not found).
 */
async function fetchFileContent(options: FetchFileContentOptions) {
	// Assert preconditions: owner, repo, path non-empty strings.
	const { repo, path } = FetchFileContentOptionsSchema.parse(options);
	const { owner, default_branch } = repo;
	assert.nonEmptyString(owner.login, "owner.login must not be empty");
	const repoPath = `${owner.login}/${repo.name}`;

	const apiUrl = `https://${GITHUB_BASENAME}/repos/${repoPath}/files/${default_branch}/${path}`;

	console.log(`🔍 Fetching ${apiUrl}`);

	const headers: HeadersInit = {
		Accept: "application/vnd.github.v3+json",
	};
	// if (token) { headers["Authorization"] = `Bearer ${token}`; }

	try {
		const response = await cachedFetch(apiUrl, { method: "GET", headers });

		// Assert intermediate state: response should exist.
		assert.truthy(response, "Fetch API did not return a response");

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
					`${repoPath}: ${response.status}\nMessage: ${errorText}`,
			);
			return null;
		}

		const rawData = await response.json();

		assert.nonEmptyObject(rawData, "rawData should not be empty");

		console.log(`✅ Successfully fetched ${path} in ${repoPath}`);

		return rawData;
	} catch (error) {
		// Catch fetch/network/Buffer errors - operational.
		console.error(`❌ Error fetching file content for ${path} in ${owner}/${repo}:`, error);
		throw error;
	}
}

/**
 * Reads the non-servers CSV file and returns a Set of repo paths
 * @returns Promise<Set<string>> of repo paths (owner/name)
 */
async function getNonServerPaths(): Promise<Set<string>> {
	const csvPath = join(process.cwd(), "data", "non-servers.csv");
	const nonServerPaths = new Set<string>();

	if (!existsSync(csvPath)) {
		return nonServerPaths;
	}

	try {
		const content = await readFile(csvPath, "utf-8");
		// Skip header, process each line
		const lines = content.split("\n").slice(1);
		for (const line of lines) {
			if (!line.trim()) continue;
			const [repoPath] = line.split(",");
			nonServerPaths.add(repoPath);
		}
	} catch (error) {
		console.warn("Failed to read non-servers:", error);
	}

	return nonServerPaths;
}

/**
 * Main execution logic for finding potential MCP servers.
 */
export async function findPotentialServers(options: { repoLimit: number }): Promise<MiniItem[]> {
	// Load known non-servers first
	const nonServerPaths = await getNonServerPaths();

	// Fetch initial list of repositories, up to repoLimit.
	const repos = await fetchTopicRepos({
		topic: "mcp-server",
		repoLimit: options.repoLimit,
	});
	// Assert state after fetch.
	assert.nonEmptyArray(repos, "fetchTopicRepos should return array");

	const potentialServers: MiniItem[] = [];

	// Limit iteration based on REPO_LIMIT.
	// const reposToCheck = repos.slice(0, options.repoLimit);
	// No longer needed, limit applied in fetchTopicRepos

	for (const repo of repos) {
		// Assert loop invariant: repo object structure.
		MiniItemSchema.parse(repo);

		// Skip if already known as non-server
		const repoPath = `${repo.owner.login}/${repo.name}`;
		if (nonServerPaths.has(repoPath)) {
			console.log(`⏭️ Skipping ${repo.html_url} (known non-server)`);
			continue;
		}

		console.log(`🔍 Checking ${repo.html_url}...`);

		// Fetch package.json content.
		const pkgJsonContent = await fetchFileContent({
			path: "package.json",
			repo,
		}).catch((error) => {
			console.error(`❌ Error fetching package.json for ${repo.html_url}:`, error);
			throw error;
		});

		// Handle expected case: package.json not found (operational).
		if (pkgJsonContent === null) {
			console.log(` -> No package.json found.`);
			continue; // Move to the next repository.
		}

		// Parse the JSON content.
		const pkg = z
			.object({
				bin: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
				dependencies: z.record(z.string(), z.string()).optional(),
				devDependencies: z.record(z.string(), z.string()).optional(),
			})
			.parse(pkgJsonContent);
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
			await storeNonServer(repo);
		}
	}

	// Assert final state before output.
	assert.nonEmptyArray(potentialServers, "potentialServers should be non-empty array");

	// --- Output Results ---
	console.log("\n--- Potential MCP Servers Found ---");
	potentialServers.forEach((server) => {
		console.log(`- ${server.owner.login}/${server.name} (${server.html_url})`);
	});

	// const checkedCount = Math.min(repos.length, options.repoLimit);
	// Since repos.length is now <= options.repoLimit,
	// checkedCount is simply repos.length.
	console.log(
		`------------------------------------
Checked ${repos.length} ` + `repositories. Found ${potentialServers.length}.`,
	);

	return potentialServers;
}

/**
 * Stores non-server repositories in a CSV file.
 * @param repo - Repository that doesn't meet server criteria
 * @returns Promise that resolves when write is complete
 */
export async function storeNonServer(repo: MiniItem): Promise<void> {
	const { writeFile } = await import("node:fs/promises");
	const { existsSync } = await import("node:fs");
	const { join } = await import("node:path");

	// Create CSV line from NonServerSchema fields
	const repoPath = `${repo.owner.login}/${repo.name}`;
	const lastChecked = new Date().toISOString();
	const csvLine = `${repoPath},${lastChecked}\n`;

	const csvPath = join(process.cwd(), "data", "non-servers.csv");

	try {
		// Ensure data directory exists
		const dataDir = join(process.cwd(), "data");
		if (!existsSync(dataDir)) {
			const { mkdir } = await import("node:fs/promises");
			await mkdir(dataDir, { recursive: true });
		}

		// Create header if file doesn't exist
		if (!existsSync(csvPath)) {
			await writeFile(csvPath, "repoPath,lastChecked\n");
		}
		// Append new entry
		await writeFile(csvPath, csvLine, { flag: "a" });
	} catch (error) {
		console.error("Failed to write non-server:", error);
		throw error;
	}
}
