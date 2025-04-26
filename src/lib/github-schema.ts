import * as z from "zod";

export const DefaultBranchSchema = z.string();
export type DefaultBranch = z.infer<typeof DefaultBranchSchema>;

export const KeySchema = z.string();
export type Key = z.infer<typeof KeySchema>;

export const NameSchema = z.string();
export type Name = z.infer<typeof NameSchema>;

export const NodeIdSchema = z.string();
export type NodeId = z.infer<typeof NodeIdSchema>;

export const SpdxIdSchema = z.string();
export type SpdxId = z.infer<typeof SpdxIdSchema>;

export const TypeSchema = z.enum(["Organization", "User"]);
export type Type = z.infer<typeof TypeSchema>;

export const VisibilitySchema = z.enum(["public"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const LicenseSchema = z.object({
	key: KeySchema,
	name: NameSchema,
	spdx_id: SpdxIdSchema,
	url: z.union([z.null(), z.string()]),
	node_id: NodeIdSchema,
});
export type License = z.infer<typeof LicenseSchema>;

export const OwnerSchema = z.object({
	login: z.string(),
	id: z.number(),
	node_id: z.string(),
	avatar_url: z.string(),
	gravatar_id: z.string(),
	url: z.string(),
	html_url: z.string(),
	followers_url: z.string(),
	following_url: z.string(),
	gists_url: z.string(),
	starred_url: z.string(),
	subscriptions_url: z.string(),
	organizations_url: z.string(),
	repos_url: z.string(),
	events_url: z.string(),
	received_events_url: z.string(),
	type: TypeSchema,
	user_view_type: VisibilitySchema,
	site_admin: z.boolean(),
});
export type Owner = z.infer<typeof OwnerSchema>;

export const ItemSchema = z.object({
	id: z.number(),
	node_id: z.string(),
	name: z.string(),
	full_name: z.string(),
	private: z.boolean(),
	owner: OwnerSchema,
	html_url: z.string(),
	description: z.string(),
	fork: z.boolean(),
	url: z.string(),
	forks_url: z.string(),
	keys_url: z.string(),
	collaborators_url: z.string(),
	teams_url: z.string(),
	hooks_url: z.string(),
	issue_events_url: z.string(),
	events_url: z.string(),
	assignees_url: z.string(),
	branches_url: z.string(),
	tags_url: z.string(),
	blobs_url: z.string(),
	git_tags_url: z.string(),
	git_refs_url: z.string(),
	trees_url: z.string(),
	statuses_url: z.string(),
	languages_url: z.string(),
	stargazers_url: z.string(),
	contributors_url: z.string(),
	subscribers_url: z.string(),
	subscription_url: z.string(),
	commits_url: z.string(),
	git_commits_url: z.string(),
	comments_url: z.string(),
	issue_comment_url: z.string(),
	contents_url: z.string(),
	compare_url: z.string(),
	merges_url: z.string(),
	archive_url: z.string(),
	downloads_url: z.string(),
	issues_url: z.string(),
	pulls_url: z.string(),
	milestones_url: z.string(),
	notifications_url: z.string(),
	labels_url: z.string(),
	releases_url: z.string(),
	deployments_url: z.string(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	pushed_at: z.coerce.date(),
	git_url: z.string(),
	ssh_url: z.string(),
	clone_url: z.string(),
	svn_url: z.string(),
	homepage: z.string().nullable(),
	size: z.number(),
	stargazers_count: z.number(),
	watchers_count: z.number(),
	language: z.union([z.null(), z.string()]),
	has_issues: z.boolean(),
	has_projects: z.boolean(),
	has_downloads: z.boolean(),
	has_wiki: z.boolean(),
	has_pages: z.boolean(),
	has_discussions: z.boolean(),
	forks_count: z.number(),
	mirror_url: z.null(),
	archived: z.boolean(),
	disabled: z.boolean(),
	open_issues_count: z.number(),
	license: z.union([LicenseSchema, z.null()]),
	allow_forking: z.boolean(),
	is_template: z.boolean(),
	web_commit_signoff_required: z.boolean(),
	topics: z.array(z.string()),
	visibility: VisibilitySchema,
	forks: z.number(),
	open_issues: z.number(),
	watchers: z.number(),
	default_branch: DefaultBranchSchema,
	score: z.number(),
});
export type Item = z.infer<typeof ItemSchema>;

export const GitHubSearchResponseSchema = z.object({
	total_count: z.number(),
	incomplete_results: z.boolean(),
	items: z.array(ItemSchema),
});
export type GitHubSearchResponse = z.infer<typeof GitHubSearchResponseSchema>;

const GithubTreeItemTypeSchema = z.enum(["blob", "tree", "commit"]);
export type GithubTreeItemType = z.infer<typeof GithubTreeItemTypeSchema>;

export const TreeSchema = z.object({
	path: z.string(),
	mode: z.string(),
	type: GithubTreeItemTypeSchema,
	sha: z.string(),
	url: z.string(),
	size: z.number().optional(),
});
export type GithubTreeItem = z.infer<typeof TreeSchema>;

export const GitHubTreeResponseSchema = z.object({
	sha: z.string(),
	url: z.string(),
	tree: z.array(TreeSchema),
	truncated: z.boolean(),
});
export type GitHubTreeResponse = z.infer<typeof GitHubTreeResponseSchema>;
