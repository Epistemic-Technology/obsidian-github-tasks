export interface TaskItem {
  state: string;
  title: string;
  html_url: string;
  repository_url: string;
  id: number;
  number: number;
  fullLine?: string;
  lineIndex?: number;
}

export function buildTaskLine(item: TaskItem, type: "issue" | "pr") {
  const checked = item.state === "closed" ? "x" : " ";
  const url = item.html_url;
  const repo = item.repository_url.split("/").slice(-2).join("/");
  const id = item.id;
  const prefix = type === "pr" ? "PR:" : "";
  return `- [${checked}] ${prefix} [${item.title}](${url}) (${repo}#${item.number}) ^gh-${id}`;
}

export function buildUpdatedTaskLine(
  item: TaskItem,
  type: "issue" | "pr",
  existingTask?: TaskItem,
): string {
  if (!existingTask) {
    return buildTaskLine(item, type);
  }

  // If there is an existing task with the same URL, we want to leave it as is
  // in order to preserve any changes the user has made to it.
  if (existingTask.html_url == item.html_url && existingTask.fullLine) {
    if (item.state === "closed" && existingTask.state !== "closed") {
      existingTask.fullLine = existingTask.fullLine.replace(/\[ \]/, `[x]`);
    }
    return existingTask.fullLine;
  }

  if (existingTask.state === "closed") {
    item.state = "closed";
  }

  return buildTaskLine(item, type);
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
  const titleMatch = line.match(/\[(.*?)\]/);
  const title = titleMatch ? titleMatch[1] : "";

  // Extract repository info from parentheses like (owner/repo#123)
  const repoMatch = line.match(/\(([^)]+)#(\d+)\)/);
  const repo = repoMatch ? repoMatch[1] : "";
  const number = repoMatch ? parseInt(repoMatch[2], 10) : 0;

  return {
    id: parseInt(match[2], 10),
    state: match[1] === "x" ? "closed" : "open",
    title: title,
    html_url: url,
    repository_url: `https://api.github.com/repos/${repo}`,
    number: number,
    fullLine: line,
    lineIndex: lineIndex,
  };
}
