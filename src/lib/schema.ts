import { z } from "zod";
import { ItemSchema, OwnerSchema } from "./github-schema";

const verificationTags = [
	"passes-mcp-shield",
	"has-auth",
	"official",
	"openid-connect",
	"oauth-2.0",
	"oauth-2.1",
] as const;

/**
 * @description The schema for the MCP Servers collection
 */
export const ServerSchema = z.object({
	title: z.string(),
	description: z.string(),
	repoUrl: z.string().url(),
	verifications: z.array(z.enum(verificationTags)),
	lastUpdated: z.string(),
	ogImage: z.union([z.string().startsWith("/"), z.literal("")]),
});

export type Server = z.infer<typeof ServerSchema>;

export const MiniItemSchema = ItemSchema.pick({
	id: true,
	name: true,
	description: true,
	owner: true,
	html_url: true,
	default_branch: true,
}).extend({
	owner: OwnerSchema.extend({
		login: z.string().min(1),
	}),
});

export type MiniItem = z.infer<typeof MiniItemSchema>;

export const NonServerSchema = z.object({
	repoPath: z.string().refine(
		(path) => {
			const [owner, name] = path.split("/");
			return owner && name;
		},
		{
			message: "repoPath must be in the format owner/name",
		},
	),
	lastChecked: z.string().datetime(),
});

export type NonServer = z.infer<typeof NonServerSchema>;
