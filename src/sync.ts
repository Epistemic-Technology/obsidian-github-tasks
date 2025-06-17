import { GitHubClient } from "./github";
import {
  buildTaskLine,
  TaskItem,
  parseTaskLine,
  buildUpdatedTaskLine,
} from "./utils";

interface SectionInfo {
  startIndex: number;
  endIndex: number;
  tasks: TaskItem[];
}

function findSection(
  lines: string[],
  headerPattern: RegExp,
): SectionInfo | null {
  const headerIndex = lines.findIndex((line) => headerPattern.test(line));
  if (headerIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIndex = i;
      break;
    }
  }

  const tasks: TaskItem[] = [];
  for (let i = headerIndex + 1; i < endIndex; i++) {
    const parsed = parseTaskLine(lines[i], i);
    if (parsed) tasks.push(parsed);
  }

  return {
    startIndex: headerIndex,
    endIndex,
    tasks,
  };
}

export async function syncTasks(noteContent: string, github: GitHubClient) {
  const lines = noteContent.split("\n");
  const newLines = [...lines];

  const issuesSection = findSection(lines, /^## Issues assigned to me$/);
  const assignedPRsSection = findSection(lines, /^## PRs assigned to me$/);
  const openedPRsSection = findSection(lines, /^## PRs opened by me$/);

  const issues = await github.getAssignedIssues();
  const assignedPRs = await github.getAssignedPRs();
  const openedPRs = await github.getOpenedPRs();

  processSectionTasks(
    newLines,
    issuesSection,
    issues,
    "issue",
    "## Issues assigned to me",
  );
  processSectionTasks(
    newLines,
    assignedPRsSection,
    assignedPRs,
    "pr",
    "## PRs assigned to me",
  );
  processSectionTasks(
    newLines,
    openedPRsSection,
    openedPRs,
    "pr",
    "## PRs opened by me",
  );

  return newLines.join("\n");
}

function processSectionTasks(
  lines: string[],
  section: SectionInfo | null,
  items: TaskItem[],
  type: "issue" | "pr",
  headerText: string,
) {
  const itemsById = new Map(items.map((item) => [item.id.toString(), item]));

  if (!section) {
    if (items.length > 0) {
      lines.push("", headerText);
      items.forEach((item) => {
        if (item.state === "open") {
          lines.push(buildTaskLine(item, type));
        }
      });
    }
    return;
  }

  const existingTasksById = new Map(
    section.tasks.map((task) => [task.id.toString(), task]),
  );
  const processedIds = new Set<string>();

  const updatedTaskLines: string[] = [];

  section.tasks.forEach((existingTask) => {
    const item = itemsById.get(existingTask.id.toString());
    if (item) {
      updatedTaskLines.push(buildUpdatedTaskLine(item, type, existingTask));
      processedIds.add(existingTask.id.toString());
    } else {
      // Item no longer exists on GitHub, but keep it if it was manually checked off
      if (existingTask.state === "closed" && existingTask.fullLine) {
        updatedTaskLines.push(existingTask.fullLine);
      }
    }
  });

  // Add new items that weren't in the existing tasks (only if they're open)
  items.forEach((item) => {
    if (!processedIds.has(item.id.toString()) && item.state !== "closed") {
      updatedTaskLines.push(buildTaskLine(item, type));
    }
  });

  // Replace the section content
  const startIndex = section.startIndex + 1;
  const endIndex = section.endIndex;

  // Remove old task lines
  lines.splice(startIndex, endIndex - startIndex);

  // Insert updated task lines
  if (updatedTaskLines.length > 0) {
    lines.splice(startIndex, 0, ...updatedTaskLines);
  }
}
