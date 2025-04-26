import NodeFetchCache, { FileSystemCache } from "node-fetch-cache";

export const cachedFetch = NodeFetchCache.create({
	cache: new FileSystemCache({
		// Specify where to keep the cache. If undefined, '.cache' is used by default.
		// If this directory does not exist, it will be created.
		cacheDirectory: "./fetch-cache",
		// Time to live. How long (in ms) responses remain cached before being
		// automatically ejected. If undefined, responses are never
		// automatically ejected from the cache.
		ttl: 1_000_000,
	}),
});
