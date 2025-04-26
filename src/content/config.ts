import { defineCollection } from "astro:content";

import { ServerSchema } from "@lib/schema";

const serversCollection = defineCollection({
	type: "content",
	schema: ({ image }) =>
		ServerSchema.extend({
			ogImage: image(),
		}),
});

export const collections = {
	server: serversCollection,
};
