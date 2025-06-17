import { GitHubClient } from "./github";
import { buildTaskLine } from "./utils";

export async function syncTasks(noteContent: string, github: GitHubClient) {
  // Parse existing lines and block IDs
  const lines = noteContent.split("\n");
  const idToLine = new Map();
  lines.forEach(line => {
    const match = line.match(/\^gh-(\d+)/);
    if (match) idToLine.set(match[1], line);
  });

  // Fetch from GitHub
  const issues = await github.getAssignedIssues();
  const assignedPRs = await github.getAssignedPRs();
  const openedPRs = await github.getOpenedPRs();

  // Build new content
  const sections = {
    issues: ["## Issues assigned to me"],
    assignedPRs: ["## PRs assigned to me"],
    openedPRs: ["## PRs opened by me"],
  };

  issues.forEach(issue => {
    sections.issues.push(buildTaskLine(issue, "issue"));
    idToLine.delete(issue.id.toString());
  });
  assignedPRs.forEach(pr => {
    sections.assignedPRs.push(buildTaskLine(pr, "pr"));
    idToLine.delete(pr.id.toString());
  });
  openedPRs.forEach(pr => {
    sections.openedPRs.push(buildTaskLine(pr, "pr"));
    idToLine.delete(pr.id.toString());
  });

  // Optionally, handle orphaned lines (no longer assigned/open)
  // idToLine.forEach((line, id) => { ... });

  return [
    sections.issues.join("\n"),
    sections.assignedPRs.join("\n"),
    sections.openedPRs.join("\n"),
  ].join("\n\n");
}
