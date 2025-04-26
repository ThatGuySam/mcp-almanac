import { z } from "zod";

export const ServerSchema = z.object({
	title: z.string(),
	description: z.string(),
	date: z.date(),
	ogImage: z.string().startsWith("/"),
});
