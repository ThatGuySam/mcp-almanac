import { GitHubSearchResponseSchema, ItemSchema } from "./github-schema";

import { assert } from "@sindresorhus/is";
import { cachedFetch } from "./utils";
import { z } from "zod";

const MiniItemSchema = ItemSchema.pick({
	id: true,
	name: true,
	description: true,
	owner: true,
	html_url: true,
	default_branch: true,
});

type MiniItem = z.infer<typeof MiniItemSchema>;

/**
 * Fetches repositories from GitHub based on a topic.
 * @param options - Contains the topic to search for.
 * @returns A promise resolving to an array of RepoInfo.
 */
export async function fetchTopicRepos(options: { topic: string }): Promise<MiniItem[]> {
	const { topic } = options;
	// Assert preconditions: topic must be a non-empty string.
	assert.nonEmptyString(topic, "topic must not be empty");

	const apiUrl = `https://api.github.com/search/repositories?q=topic:${topic}`;
	const headers: HeadersInit = {
		Accept: "application/vnd.github.mercy-preview+json",
	};

	const response = await cachedFetch(apiUrl, { headers });

	// Assert intermediate state: response should be ok.
	// This distinguishes programmer error (bad fetch setup)
	// from operational error (GitHub API issue).
	assert.truthy(response.ok, `GitHub API fetch failed: ${response.status}`);

	// Handle expected operational error.
	if (!response.ok) {
		// Log details for debugging potential API issues.
		console.error(
			`Failed to fetch topic repos for ${topic}: ` + `${response.status} ${response.statusText}`,
		);
		// Provide a clearer error message upwards.
		throw new Error(`GitHub API error for topic ${topic}: ${response.status}`);
	}

	const rawData = await response.json();
	const { data } = GitHubSearchResponseSchema.safeParse(rawData);

	assert.nonEmptyArray(data?.items, "Expected items to be an array");

	// Map to our defined RepoInfo structure.
	return data.items.map((item) => {
		// Assert item structure during mapping.
		MiniItemSchema.parse(item);

		return {
			id: item.id,
			name: item.name,
			description: item.description, // Can be null
			owner: item.owner,
			html_url: item.html_url,
			default_branch: item.default_branch,
		} satisfies MiniItem;
	});
}

/**
 * Schema for expected GitHub content API response.
 * We only need encoding and content.
 */
const GithubContentResponseSchema = z.object({
	encoding: z.literal("base64"),
	content: z.string().min(1), // Content should not be empty
});

const FetchFileContentOptionsSchema = z.object({
	owner: z.string(),
	repo: z.string(),
	path: z.string(),
	ref: z.string().optional(),
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
async function fetchFileContent(options: FetchFileContentOptions): Promise<string | null> {
	const { owner, repo, path, ref } = options;
	// Assert preconditions: owner, repo, path non-empty strings.
	FetchFileContentOptionsSchema.parse(options);

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
					`${owner}/${repo}: ${response.status}\nMessage: ${errorText}`,
			);
			return null;
		}

		const rawData = await response.json();
		const { data } = GithubContentResponseSchema.safeParse(rawData);

		// Assert intermediate state after validation.
		assert.truthy(data?.encoding === "base64", "Encoding must be base64");
		assert.nonEmptyString(data?.content, "Content must be a non-empty string");

		// Decode the content.
		const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");

		// Assert postcondition: decoded content is a string.
		assert.string(decodedContent, "Decoded content invalid");

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
export async function findPotentialServers(options: { repoLimit: number }): Promise<void> {
	// Fetch initial list of repositories.
	const repos = await fetchTopicRepos({ topic: "mcp" });
	// Assert state after fetch.
	assert.nonEmptyArray(repos, "fetchTopicRepos should return array");

	const potentialServers: MiniItem[] = [];

	// Limit iteration based on REPO_LIMIT.
	const reposToCheck = repos.slice(0, options.repoLimit);

	for (const repo of reposToCheck) {
		// Assert loop invariant: repo object structure.
		MiniItemSchema.parse(repo);

		console.log(`Checking ${repo.owner}/${repo.name}...`);

		// Fetch package.json content.
		const pkgJsonContent = await fetchFileContent({
			owner: repo.owner.login,
			repo: repo.name,
			path: "package.json",
			ref: repo.default_branch,
		});

		// Handle expected case: package.json not found (operational).
		if (pkgJsonContent === null) {
			console.log(` -> No package.json found.`);
			continue; // Move to the next repository.
		}

		// Assert state: if not null, must be a string.
		assert.string(pkgJsonContent, "pkgJsonContent should be string if not null");

		const rawJson = JSON.parse(pkgJsonContent);

		// Parse the JSON content.
		const pkg = z
			.object({
				bin: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
				dependencies: z.record(z.string(), z.string()).optional(),
				devDependencies: z.record(z.string(), z.string()).optional(),
			})
			.parse(rawJson);
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
	}

	// Assert final state before output.
	assert.nonEmptyArray(potentialServers, "potentialServers should be non-empty array");

	// --- Output Results ---
	console.log("\n--- Potential MCP Servers Found ---");
	potentialServers.forEach((server) => {
		console.log(`- ${server.owner}/${server.name} (${server.html_url})`);
	});

	const checkedCount = Math.min(repos.length, options.repoLimit);
	console.log(
		`------------------------------------\nChecked ${checkedCount} ` +
			`repositories. Found ${potentialServers.length}.`,
	);
}
