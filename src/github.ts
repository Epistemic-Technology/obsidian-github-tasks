import { Octokit } from "@octokit/rest";

export class GitHubClient {
  octokit: Octokit;
  private username: string;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
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
      advanced_search: "true",
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
      advanced_search: "true",
    });
    return data.items;
  }

  async getOpenedPRs() {
    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: "is:pr author:@me",
      per_page: 100,
      advanced_search: "true",
    });
    return data.items;
  }

  async getAuthoredIssues() {
    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: "is:issue author:@me",
      per_page: 100,
      advanced_search: "true",
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
