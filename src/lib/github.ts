import { GitHubSearchResponseSchema } from "./github-schema";

import { assert } from "@sindresorhus/is";
import { cachedFetch } from "./utils";
import type { RepoInfo } from "./types";
import { z } from "zod";

/**
 * Fetches repositories from GitHub based on a topic.
 * @param options - Contains the topic to search for.
 * @returns A promise resolving to an array of RepoInfo.
 */
export async function fetchTopicRepos(options: { topic: string }): Promise<RepoInfo[]> {
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
		z.object({
			id: z.number(),
			name: z.string(),
			description: z.string().nullable(),
			owner: z.object({ login: z.string() }),
			html_url: z.string(),
			default_branch: z.string(),
		}).parse(item);

		return {
			id: item.id,
			name: item.name,
			description: item.description, // Can be null
			owner: item.owner.login,
			repoUrl: item.html_url,
			defaultBranch: item.default_branch,
		};
	});
}
