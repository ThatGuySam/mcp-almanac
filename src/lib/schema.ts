import { z } from "zod";

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
	ogImage: z.string().startsWith("/"),
});
