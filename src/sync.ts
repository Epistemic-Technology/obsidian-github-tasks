import { GitHubClient } from "./github";
import { Notice } from "obsidian";
import {
  buildTaskLine,
  TaskItem,
  parseTaskLine,
  buildUpdatedTaskLine,
} from "@/utils";

import { GitHubTasksSettings } from "@/settings";

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

export async function syncTasks(
  noteContent: string,
  github: GitHubClient,
  settings: GitHubTasksSettings,
) {
  if (!settings.githubToken) {
    new Notice("GitHub personal access token is not set");
    return;
  }
  const lines = noteContent.split("\n");

  const issuesSection = findSection(lines, /^## Issues assigned to me$/);
  const assignedPRsSection = findSection(lines, /^## PRs assigned to me$/);
  const openedPRsSection = findSection(lines, /^## PRs opened by me$/);

  let autoTag = settings.taskTag;
  if (autoTag.startsWith("#")) {
    autoTag = autoTag.substring(1);
  }

  const initialTags = autoTag ? [autoTag] : [];

  const issues = (await github.getAssignedIssues()).map((item) => ({
    ...item,
    tags: initialTags,
    closed_at: item.closed_at || undefined,
  }));
  const assignedPRs = (await github.getAssignedPRs()).map((item) => ({
    ...item,
    tags: initialTags,
    closed_at: item.closed_at || undefined,
  }));
  const openedPRs = (await github.getOpenedPRs()).map((item) => ({
    ...item,
    tags: initialTags,
    closed_at: item.closed_at || undefined,
  }));

  const newLines: string[] = [];
  let currentLineIndex = 0;

  const sections = [
    {
      section: issuesSection,
      items: issues,
      type: "issue" as const,
      header: "## Issues assigned to me",
    },
    {
      section: assignedPRsSection,
      items: assignedPRs,
      type: "pr" as const,
      header: "## PRs assigned to me",
    },
    {
      section: openedPRsSection,
      items: openedPRs,
      type: "pr" as const,
      header: "## PRs opened by me",
    },
  ];

  // Process sections in order they appear in the file
  for (const { section, items, type, header } of sections) {
    if (section) {
      // Copy lines before this section
      while (currentLineIndex < section.startIndex) {
        newLines.push(lines[currentLineIndex]);
        currentLineIndex++;
      }

      // Add the section header
      newLines.push(lines[section.startIndex]);
      currentLineIndex = section.endIndex;

      // Add the section content
      addSectionContent(newLines, section, items, type, settings);
    } else if (items.length > 0) {
      // Section doesn't exist, add it at the end
      if (
        newLines.length === 0 ||
        newLines[newLines.length - 1].trim() !== ""
      ) {
        newLines.push("");
      }
      newLines.push(header);
      addSectionContent(newLines, null, items, type, settings);
    }
  }

  // Copy any remaining lines
  while (currentLineIndex < lines.length) {
    newLines.push(lines[currentLineIndex]);
    currentLineIndex++;
  }

  // Filter out excessive blank lines
  const filteredLines: string[] = [];
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];
    const isBlank = line.trim() === "";
    const prevIsBlank = i > 0 && newLines[i - 1].trim() === "";

    // Skip if this is a blank line and the previous was also blank
    if (isBlank && prevIsBlank) {
      continue;
    }

    filteredLines.push(line);
  }

  // Trim blank lines from end
  while (
    filteredLines.length > 0 &&
    filteredLines[filteredLines.length - 1].trim() === ""
  ) {
    filteredLines.pop();
  }

  return filteredLines.join("\n");
}

function addSectionContent(
  newLines: string[],
  section: SectionInfo | null,
  items: TaskItem[],
  type: "issue" | "pr",
  settings: GitHubTasksSettings,
) {
  const itemsById = new Map(items.map((item) => [item.id.toString(), item]));
  const processedIds = new Set<string>();
  const updatedTaskLines: string[] = [];

  // Process existing tasks if section exists
  if (section) {
    section.tasks.forEach((existingTask) => {
      const item = itemsById.get(existingTask.id.toString());
      if (item) {
        processedIds.add(existingTask.id.toString());
        if (settings.autoClearCompleted && item.state === "closed") {
          return;
        }
        updatedTaskLines.push(
          buildUpdatedTaskLine(item, type, settings, existingTask),
        );
      } else {
        // Item no longer exists on GitHub, but keep it if it was manually checked off
        if (
          existingTask.state === "closed" &&
          existingTask.fullLine &&
          !settings.autoClearCompleted
        ) {
          updatedTaskLines.push(existingTask.fullLine);
        }
      }
    });
  }

  // Add new items that weren't in the existing tasks (only if they're open)
  items.forEach((item) => {
    if (!processedIds.has(item.id.toString()) && item.state !== "closed") {
      updatedTaskLines.push(buildTaskLine(item, type, settings));
    }
  });

  // Add all task lines to the new content
  updatedTaskLines.forEach((line) => {
    newLines.push(line);
  });
}
