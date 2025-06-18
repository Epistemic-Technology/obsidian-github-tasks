import { PluginSettingTab, Setting, App, normalizePath } from "obsidian";
import { GitHubTasksPlugin } from "@/main";

export interface GitHubTasksSettings {
  githubToken: string;
  githubTasksNote: string;
  taskTag: string;
  taskFormat: "tasks" | "dataview";
  autoRefreshInterval: number;
  importLabels: boolean;
  repositoryTags: boolean;
  autoClearCompleted: boolean;
  showCreatedAt: boolean;
  showCompletedAt: boolean;
}

export const DEFAULT_SETTINGS: GitHubTasksSettings = {
  githubToken: "",
  githubTasksNote: "GitHub Tasks",
  taskTag: "#github",
  taskFormat: "tasks",
  autoRefreshInterval: 0,
  importLabels: false,
  repositoryTags: false,
  autoClearCompleted: false,
  showCreatedAt: false,
  showCompletedAt: true,
};

export class GitHubTasksSettingsTab extends PluginSettingTab {
  plugin: GitHubTasksPlugin;

  constructor(app: App, plugin: GitHubTasksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Following pattern from https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/core/settings.ts
    const callToActionDiv = containerEl.createDiv("ght-settings-cta");
    const feedbackDiv = callToActionDiv.createDiv("ght-settings-feedback");
    const donateDiv = callToActionDiv.createDiv("ght-settings-donate");
    const kofiLink = donateDiv.createEl("a", {
      href: "https://ko-fi.com/epistemictechnology",
      cls: "ght-settings-donate-link",
    });
    const srOnlySpan = kofiLink.createEl("span", {
      text: "Support me on Ko-fi",
      cls: "sr-only",
    });
    kofiLink.createEl("img", {
      attr: {
        src: "https://cdn.ko-fi.com/cdn/kofi1.png?v=3",
        alt: "Buy me a coffee",
        cls: "ght-settings-donate-img",
      },
    });
    const feedbackLink = feedbackDiv.createEl("a", {
      href: "https://github.com/Epistemic-Technology/obsidian-github-tasks",
      attr: {
        "aria-label":
          "Report a bug, suggest a feature, offer feedback, or ask a question",
      },
    });
    const githubSVG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    githubSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    githubSVG.setAttribute("viewBox", "0 0 24 24");
    githubSVG.setAttribute("fill", "none");
    githubSVG.setAttribute("stroke", "currentColor");
    githubSVG.setAttribute("stroke-width", "2");
    githubSVG.setAttribute("stroke-linecap", "round");
    githubSVG.setAttribute("stroke-linejoin", "round");

    const path1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path1.setAttribute(
      "d",
      "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
    );

    const path2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path2.setAttribute("d", "M9 18c-4.51 2-5-2-7-2");

    githubSVG.appendChild(path1);
    githubSVG.appendChild(path2);

    const textDiv = document.createElement("div");
    textDiv.textContent = "Bugs, feedback, help";

    feedbackLink.appendChild(githubSVG);
    feedbackLink.appendChild(textDiv);
    containerEl.createEl("div", {
      text: "⚠️ Your GitHub PAT is stored unencrypted in your vault. Anyone with access to your vault can read it.",
      cls: "ght-settings-security-warning",
    });

    new Setting(containerEl)
      .setName("GitHub PAT")
      .setDesc(
        (() => {
          const fragment = document.createDocumentFragment();
          fragment.appendChild(
            document.createTextNode(
              "Enter your GitHub personal access token (",
            ),
          );
          const link = document.createElement("a");
          link.href = "https://github.com/settings/personal-access-tokens";
          link.textContent = "create one here";
          fragment.appendChild(link);
          fragment.appendChild(document.createTextNode(")"));
          return fragment;
        })(),
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter your GitHub token")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("GitHub Tasks Note")
      .setDesc("Path of the note for GitHub tasks")
      .addText((text) =>
        text
          .setPlaceholder("Enter a path to a note for GitHub tasks")
          .setValue(this.plugin.settings.githubTasksNote)
          .onChange(async (value) => {
            this.plugin.settings.githubTasksNote = normalizePath(value);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Tasks tag")
      .setDesc("Tag to append to GitHub tasks")
      .addText((text) =>
        text
          .setPlaceholder("Enter a #tag to append to tasks")
          .setValue(this.plugin.settings.taskTag)
          .onChange(async (value) => {
            this.plugin.settings.taskTag = value.startsWith("#")
              ? value
              : `#${value}`;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Task format")
      .setDesc(
        (() => {
          const fragment = document.createDocumentFragment();
          fragment.appendChild(
            document.createTextNode("Choose the format for tasks (see "),
          );
          const link = document.createElement("a");
          link.href =
            "https://publish.obsidian.md/tasks/Reference/Task+Formats/About+Task+Formats";
          link.textContent = "Tasks plugin documentation";
          fragment.appendChild(link);
          fragment.appendChild(document.createTextNode(")"));
          return fragment;
        })(),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("tasks", "Tasks Emoji format ")
          .addOption("dataview", "Dataview format")
          .setValue(this.plugin.settings.taskFormat)
          .onChange(async (value) => {
            this.plugin.settings.taskFormat = value as "tasks" | "dataview";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto refresh interval")
      .setDesc("Automatically refresh tasks every X minutes (0 to disable)")
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(this.plugin.settings.autoRefreshInterval.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value) || 0;
            this.plugin.settings.autoRefreshInterval = numValue;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Import labels")
      .setDesc("Import GitHub issue/PR labels as tags")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.importLabels)
          .onChange(async (value) => {
            this.plugin.settings.importLabels = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Repository tags")
      .setDesc("Add repository name as a tag to each task")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.repositoryTags)
          .onChange(async (value) => {
            this.plugin.settings.repositoryTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto clear completed")
      .setDesc("Automatically remove completed tasks from the note")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoClearCompleted)
          .onChange(async (value) => {
            this.plugin.settings.autoClearCompleted = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show created date")
      .setDesc("Include the creation date in task")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCreatedAt)
          .onChange(async (value) => {
            this.plugin.settings.showCreatedAt = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show completed date")
      .setDesc("Include the completion date in task")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCompletedAt)
          .onChange(async (value) => {
            this.plugin.settings.showCompletedAt = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  hide() {
    this.plugin.refreshTasks();
    super.hide();
  }
}
