import { z, defineCollection } from "astro:content";

const serversCollection = defineCollection({
	type: "content",
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			date: z.date(),
			ogImage: image(),
		}),
});

export const collections = {
	server: serversCollection,
};
