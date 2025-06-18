import { GitHubTasksSettings } from "@/settings";

type GitHubLabel =
  | string
  | {
      id?: number;
      node_id?: string;
      url?: string;
      name?: string;
      description?: string | null;
      color?: string | null;
      default?: boolean;
    };

export interface TaskItem {
  state: string;
  title: string;
  html_url: string;
  repository_url: string;
  id: number;
  number: number;
  tags: string[];
  labels: GitHubLabel[];
  fullLine?: string;
  lineIndex?: number;
  created_at?: string;
  closed_at?: string;
}

function normalizeLabel(labelName: string): string {
  return labelName.toLowerCase().replace(/\s+/g, "-");
}

export function buildTaskLine(
  item: TaskItem,
  type: "issue" | "pr",
  settings: GitHubTasksSettings,
) {
  const checked = item.state === "closed" ? "x" : " ";
  const url = item.html_url;
  const repo = item.repository_url.split("/").slice(-2).join("/");
  const id = item.id;
  const prefix = type === "pr" ? "PR:" : "";

  // Combine tags and labels
  let allTags = [...item.tags];
  if (settings.importLabels && item.labels && item.labels.length > 0) {
    const labelTags = item.labels
      .map((label) => (typeof label === "string" ? label : label.name || ""))
      .filter((name) => name !== "")
      .map(normalizeLabel);
    allTags = [...allTags, ...labelTags];
  }

  if (settings.repositoryTags) {
    const repoTag = `${repo}`;
    allTags.push(repoTag);
  }

  const tagsStr =
    allTags.length > 0 ? ` ${allTags.map((tag) => `#${tag}`).join(" ")}` : "";

  let createdDateStr = "";
  if (settings.showCreatedAt && item.created_at) {
    const date = new Date(item.created_at).toISOString().split("T")[0];
    if (settings.taskFormat === "tasks") {
      createdDateStr = ` ➕ ${date}`;
    } else if (settings.taskFormat === "dataview") {
      createdDateStr = ` [created:: ${date}]`;
    }
  }

  let completedDateStr = "";
  if (settings.showCompletedAt && item.closed_at) {
    const date = new Date(item.closed_at).toISOString().split("T")[0];
    if (settings.taskFormat === "tasks") {
      completedDateStr = ` ✅ ${date}`;
    } else if (settings.taskFormat === "dataview") {
      completedDateStr = ` [completion:: ${date}]`;
    }
  }

  return `- [${checked}] ${prefix} [${item.title}](${url}) (${repo}#${item.number})${tagsStr}${createdDateStr}${completedDateStr} ^gh-${id}`;
}

export function buildUpdatedTaskLine(
  item: TaskItem,
  type: "issue" | "pr",
  settings: GitHubTasksSettings,
  existingTask?: TaskItem,
): string {
  if (!existingTask) {
    return buildTaskLine(item, type, settings);
  }

  // If there is an existing task with the same URL, we want to leave it as is
  // in order to preserve any changes the user has made to it.
  if (existingTask.html_url == item.html_url && existingTask.fullLine) {
    if (item.state === "closed" && existingTask.state !== "closed") {
      existingTask.fullLine = existingTask.fullLine.replace(/\[ \]/, `[x]`);
      if (settings.showCompletedAt && item.closed_at) {
        const date = new Date(item.closed_at).toISOString().split("T")[0];
        if (settings.taskFormat == "dataview") {
          existingTask.fullLine = existingTask.fullLine.replace(
            /\^gh/,
            `[completion:: ${date}] ^gh`,
          );
        } else {
          existingTask.fullLine = existingTask.fullLine.replace(
            /\^gh/,
            ` ✅ ${date} ^gh`,
          );
        }
      }
    }
    return existingTask.fullLine;
  }

  if (existingTask.state === "closed") {
    item.state = "closed";
  }

  // Merge tags from existing task to preserve user-added tags
  if (existingTask.tags && existingTask.tags.length > 0) {
    // Combine item tags with labels if importLabels is enabled
    let itemTags = [...item.tags];
    if (settings.importLabels && item.labels && item.labels.length > 0) {
      const labelTags = item.labels
        .map((label) => (typeof label === "string" ? label : label.name || ""))
        .filter((name) => name !== "")
        .map(normalizeLabel);
      itemTags = [...itemTags, ...labelTags];
    }

    const mergedTags = [...new Set([...itemTags, ...existingTask.tags])];
    item.tags = mergedTags;
  } else if (settings.importLabels && item.labels && item.labels.length > 0) {
    // If no existing tags but labels should be imported, add labels to item tags
    const labelTags = item.labels
      .map((label) => (typeof label === "string" ? label : label.name || ""))
      .filter((name) => name !== "")
      .map(normalizeLabel);
    item.tags = [...item.tags, ...labelTags];
  }

  // Preserve creation date from existing task if item doesn't have one
  if (existingTask.created_at && !item.created_at) {
    item.created_at = existingTask.created_at;
  }

  return buildTaskLine(item, type, settings);
}

export function parseTaskLine(
  line: string,
  lineIndex: number,
): TaskItem | null {
  const match = line.match(/^- \[([x ])\].*\^gh-(\d+).*$/);
  if (!match) return null;

  // Extract URL from markdown link [text](url)
  const urlMatch = line.match(/\[.*?\]\((https:\/\/github\.com\/[^)]+)\)/);
  const url = urlMatch ? urlMatch[1] : "";

  // Extract title from markdown link
  const titleMatch = line.match(/\[([^\]]+)\]\(/);
  const title = titleMatch ? titleMatch[1] : "";

  // Extract repository info from parentheses like (owner/repo#123)
  const repoMatch = line.match(/\(([^)]+)#(\d+)\)/);
  const repo = repoMatch ? repoMatch[1] : "";
  const number = repoMatch ? parseInt(repoMatch[2], 10) : 0;

  // Extract creation date - check for both tasks format (➕ YYYY-MM-DD) and dataview format ([created:: YYYY-MM-DD])
  let created_at = "";
  const tasksDateMatch = line.match(/➕ (\d{4}-\d{2}-\d{2})/);
  const dataviewDateMatch = line.match(/\[created:: (\d{4}-\d{2}-\d{2})\]/);
  if (tasksDateMatch) {
    created_at = `${tasksDateMatch[1]}T00:00:00Z`;
  } else if (dataviewDateMatch) {
    created_at = `${dataviewDateMatch[1]}T00:00:00Z`;
  }

  // Extract tags (anything that starts with # followed by non-whitespace characters, but not within parentheses)
  // Remove the repository reference part to avoid false matches, but keep everything else
  const repoRefRemoved = line.replace(/\([^)]+#\d+\)/, "");
  const tagsMatch = repoRefRemoved.match(/#([^\s#]+)/g);
  const tags = tagsMatch ? tagsMatch.map((tag) => tag.substring(1)) : [];

  return {
    id: parseInt(match[2], 10),
    state: match[1] === "x" ? "closed" : "open",
    title: title,
    html_url: url,
    repository_url: `https://api.github.com/repos/${repo}`,
    number: number,
    tags: tags,
    labels: [],
    fullLine: line,
    lineIndex: lineIndex,
    created_at: created_at || undefined,
  };
}
