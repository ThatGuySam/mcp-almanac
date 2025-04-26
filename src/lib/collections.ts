import { glob } from "glob";
import matter from "gray-matter";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const SERVERS_COLLECTION_DIR_URL = "src/content/servers";

export async function getServerEntries() {
	const files = await glob(path.join(SERVERS_COLLECTION_DIR_URL, "**/*.md"));

	// Read each file and parse it with gray-matter
	const entries = await Promise.all(
		files.map(async (file) => {
			const content = await fs.readFile(file, "utf-8");
			const { data, content: body } = matter(content);
			return { ...data, body };
		}),
	);

	return entries;
}
