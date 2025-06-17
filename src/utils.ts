export interface TaskItem {
  state: string;
  title: string;
  html_url: string;
  repository_url: string;
  id: number;
  number: number;
}

export function buildTaskLine(item: TaskItem, type: "issue" | "pr") {
  const checked = item.state === "closed" ? "x" : " ";
  const url = item.html_url;
  const repo = item.repository_url.split("/").slice(-2).join("/");
  const id = item.id;
  const prefix = type === "pr" ? "PR:" : "";
  return `- [${checked}] ${prefix} [${item.title}](${url}) (${repo}#${item.number}) ^gh-${id}`;
}
