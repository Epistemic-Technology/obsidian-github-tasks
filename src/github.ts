import { Octokit } from "@octokit/rest";
import { requestUrl } from "obsidian";

export class GitHubClient {
  octokit: Octokit;
  private username: string;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      request: {
        fetch: this.customFetch.bind(this),
      },
    });
    this.username = "";
    this.initializeUsername();
  }

  // Custom fetch implementation using Obsidian's requestUrl to avoid CORS issues
  private async customFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    // Convert headers to plain object
    const headers: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    try {
      const response = await requestUrl({
        url,
        method: options.method || "GET",
        headers,
        body: options.body as string,
        throw: false,
      });

      // Return minimal Response-like object
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: new Headers(response.headers as Record<string, string>),
        json: async () => response.json,
        text: async () => response.text,
      } as Response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`GitHub API request failed: ${errorMessage}`);
    }
  }

  private async initializeUsername() {
    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      this.username = user.login;
    } catch (error) {
      console.error("Failed to get authenticated user:", error);
    }
  }

  async getAssignedIssues() {
    const { data } = await this.octokit.issues.listForAuthenticatedUser({
      filter: "assigned",
      state: "all",
      per_page: 100,
    });
    return data;
  }

  async getAssignedPRs() {
    if (!this.username) {
      await this.initializeUsername();
    }

    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr assignee:${this.username}`,
      per_page: 100,
    });
    return data.items;
  }

  async getReviewRequestedPRs() {
    if (!this.username) {
      await this.initializeUsername();
    }

    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr review-requested:${this.username}`,
      per_page: 100,
    });
    return data.items;
  }

  async getOpenedPRs() {
    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: "is:pr author:@me",
      per_page: 100,
    });
    return data.items;
  }

  async getAuthoredIssues() {
    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: "is:issue author:@me",
      per_page: 100,
    });
    return data.items;
  }
}
