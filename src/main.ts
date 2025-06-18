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
  refreshInterval: number | undefined;

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
    this.startAutoRefresh();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.startAutoRefresh();
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
    }

    if (this.settings.autoRefreshInterval > 0) {
      this.registerInterval(
        (this.refreshInterval = window.setInterval(
          () => this.refreshTasks(),
          this.settings.autoRefreshInterval * 60 * 1000,
        )),
      );
    }
  }

  async refreshTasks() {
    if (!this.settings.githubToken) {
      new Notice(
        "GitHub personal access token not found. Please define it in GitHub Tasks settings.",
      );
      return;
    }
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

    const newContent = await syncTasks(content, github, this.settings);
    await this.app.vault.modify(file, newContent || "");
  }
}

export default GitHubTasksPlugin;
