import {
  Plugin,
  App,
  PluginManifest,
  TFile,
  Notice,
  normalizePath,
} from "obsidian";

import { GitHubClient } from "@/github";
import { syncTasks } from "@/sync";

import "@/styles.css";

import {
  GitHubTasksSettings,
  DEFAULT_SETTINGS,
  GitHubTasksSettingsTab,
} from "@/settings";

export class GitHubTasksPlugin extends Plugin {
  settings: GitHubTasksSettings;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GitHubTasksSettingsTab(this.app, this));
    this.addCommand({
      id: "refresh-github-tasks",
      name: "Refresh GitHub Tasks",
      callback: () => this.refreshTasks(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async refreshTasks() {
    const github = new GitHubClient(this.settings.githubToken);
    const file = this.app.vault.getAbstractFileByPath(
      normalizePath(this.settings.githubTasksNote) + ".md",
    );
    if (!(file instanceof TFile)) {
      new Notice(
        "Tasks note not found. Makes sure the note defined in GitHub Tasks settings exists.",
      );
      console.error("Tasks note not found: ", this.settings.githubTasksNote);
      return;
    }
    const content = await this.app.vault.read(file);
    const newContent = await syncTasks(content, github);
    await this.app.vault.modify(file, newContent);
  }
}

export default GitHubTasksPlugin;
