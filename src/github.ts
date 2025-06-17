import { Octokit } from "@octokit/rest";
import { requestUrl } from "obsidian";

export class GitHubClient {
  octokit: Octokit;
  private username: string;

  constructor(token: string) {
    // Custom fetch implementation using Obsidian's requestUrl to avoid CORS issues
    const customFetch = async (
      url: string,
      options: RequestInit = {},
    ): Promise<Response> => {
      const headers: Record<string, string> = {};

      // Convert Headers object to plain object if needed
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          // Handle array format [['key', 'value'], ...]
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          // Handle plain object format
          Object.assign(headers, options.headers);
        }
      }

      try {
        const response = await requestUrl({
          url: url.toString(),
          method: (options.method || "GET") as any,
          headers,
          body: options.body as string,
          throw: false, // Don't throw on HTTP errors, let Octokit handle them
        });

        // Create a Response-like object that Octokit expects
        const responseHeaders = new Headers();
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            responseHeaders.set(key, String(value));
          });
        }

        const responseObj = {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.status.toString(),
          headers: responseHeaders,
          url: url.toString(),
          json: async () => {
            if (typeof response.json === "object" && response.json !== null) {
              return response.json;
            }
            try {
              return JSON.parse(response.text);
            } catch {
              throw new Error("Failed to parse JSON response");
            }
          },
          text: async () => response.text || "",
          arrayBuffer: async () => response.arrayBuffer || new ArrayBuffer(0),
          clone: function () {
            return { ...this };
          },
        };

        return responseObj as Response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(`GitHub API request failed: ${errorMessage}`);
      }
    };

    this.octokit = new Octokit({
      auth: token,
      request: {
        fetch: customFetch,
      },
    });
    this.username = "";
    this.initializeUsername();
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

  async getAllTasks() {
    const [
      assignedIssues,
      assignedPRs,
      reviewRequestedPRs,
      openedPRs,
      authoredIssues,
    ] = await Promise.all([
      this.getAssignedIssues(),
      this.getAssignedPRs(),
      this.getReviewRequestedPRs(),
      this.getOpenedPRs(),
      this.getAuthoredIssues(),
    ]);

    return {
      assignedIssues,
      assignedPRs,
      reviewRequestedPRs,
      openedPRs,
      authoredIssues,
    };
  }
}
