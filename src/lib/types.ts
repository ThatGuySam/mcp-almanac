/**
 * Represents the core details of a GitHub repository
 * relevant to this script.
 */
export interface RepoInfo {
	id: number;
	name: string;
	description: string | null;
	owner: string;
	repoUrl: string;
	defaultBranch: string;
}
