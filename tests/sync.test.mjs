import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../src/sync.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  plugins: [{
    name: "mock-obsidian",
    setup(build) {
      build.onResolve({ filter: /^obsidian$/ }, () => ({
        path: "obsidian",
        namespace: "mock",
      }));
      build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
        contents: "export class Notice {}",
      }));
    },
  }],
});
const { syncTasks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

const settings = {
  githubToken: "test-token",
  githubTasksNote: "GitHub Tasks",
  taskTag: "#github",
  taskFormat: "tasks",
  autoRefreshInterval: 0,
  importLabels: false,
  repositoryDescription: false,
  repositoryTags: false,
  autoClearCompleted: false,
  showCreatedAt: false,
  showCompletedAt: true,
};

function pr(id, overrides = {}) {
  return {
    id,
    number: id,
    title: `Pull request ${id}`,
    state: "open",
    html_url: `https://github.com/owner/repo/pull/${id}`,
    repository_url: "https://api.github.com/repos/owner/repo",
    labels: [],
    closed_at: null,
    ...overrides,
  };
}

function github({ assigned = [], reviews = [], opened = [], issues = [] } = {}) {
  return {
    getAssignedIssues: async () => issues,
    getAssignedPRs: async () => assigned,
    getReviewRequestedPRs: async () => reviews,
    getOpenedPRs: async () => opened,
  };
}

function taskIds(note) {
  return [...note.matchAll(/\^gh-(\d+)/g)].map((match) => Number(match[1]));
}

test("includes assigned and review-only PRs once, preserving assigned order and data", async () => {
  const client = github({
    assigned: [pr(2), pr(1)],
    reviews: [pr(1, { title: "Review query version" }), pr(3)],
  });
  const note = await syncTasks("", client, settings);

  assert.match(note, /## PRs assigned to me/);
  assert.deepEqual(taskIds(note), [2, 1, 3]);
  assert.doesNotMatch(note, /Review query version/);
  assert.equal(await syncTasks(note, client, settings), note);
});

test("creates the assigned PR section when there are only review requests", async () => {
  const note = await syncTasks("", github({ reviews: [pr(1)] }), settings);

  assert.match(note, /## PRs assigned to me/);
  assert.deepEqual(taskIds(note), [1]);
  assert.doesNotMatch(note, /## Issues assigned to me/);
});

test("keeps PRs with the same number in different repositories", async () => {
  const note = await syncTasks("", github({
    assigned: [pr(1, { number: 42 })],
    reviews: [pr(2, {
      number: 42,
      html_url: "https://github.com/owner/other/pull/42",
      repository_url: "https://api.github.com/repos/owner/other",
    })],
  }), settings);

  assert.deepEqual(taskIds(note), [1, 2]);
});

for (const taskFormat of ["tasks", "dataview"]) {
  test(`preserves edits when a review PR also becomes assigned (${taskFormat})`, async () => {
    const formatSettings = { ...settings, taskFormat };
    const initial = await syncTasks("", github({ reviews: [pr(1)] }), formatSettings);
    const dueDate = taskFormat === "tasks" ? "📅 2026-10-25" : "[due:: 2026-10-25]";
    const edited = initial.replace("^gh-1", `#personal ${dueDate} ^gh-1`);
    const client = github({ assigned: [pr(1)], reviews: [pr(1)] });
    const refreshed = await syncTasks(edited, client, formatSettings);

    assert.equal(refreshed, edited);
    assert.deepEqual(taskIds(refreshed), [1]);
    assert.equal(await syncTasks(refreshed, client, formatSettings), edited);
  });

  test(`completes closed review PRs and honors auto-clear (${taskFormat})`, async () => {
    const formatSettings = { ...settings, taskFormat };
    const initial = await syncTasks("", github({ reviews: [pr(1)] }), formatSettings);
    const closed = pr(1, { state: "closed", closed_at: "2026-10-21T12:00:00Z" });
    const client = github({ reviews: [closed] });
    const completed = await syncTasks(initial, client, formatSettings);

    assert.match(completed, /- \[x\] PR:/);
    assert.ok(completed.includes(taskFormat === "tasks"
      ? "✅ 2026-10-21"
      : "[completion:: 2026-10-21]"));
    assert.equal(await syncTasks(completed, client, formatSettings), completed);
    assert.equal(await syncTasks(completed, github(), formatSettings), completed);
    const cleared = await syncTasks(completed, client, {
      ...formatSettings,
      autoClearCompleted: true,
    });
    assert.deepEqual(taskIds(cleared), []);
    const fresh = await syncTasks("", client, formatSettings);
    assert.deepEqual(taskIds(fresh), []);
  });
}

test("removes withdrawn or satisfied review requests unless the PR is still assigned", async () => {
  const initial = await syncTasks("", github({ reviews: [pr(1), pr(2)] }), settings);
  assert.deepEqual(taskIds(initial), [1, 2]);
  const refreshed = await syncTasks(initial, github({ assigned: [pr(2)] }), settings);

  assert.deepEqual(taskIds(refreshed), [2]);
});

test("preserves the separate opened PR section", async () => {
  const client = github({ assigned: [pr(1)], reviews: [pr(1)], opened: [pr(1)] });
  const note = await syncTasks("", client, settings);

  assert.deepEqual(taskIds(note), [1, 1]);
  assert.match(note, /## PRs opened by me/);
  const refreshed = await syncTasks(note, client, settings);
  assert.deepEqual(taskIds(refreshed), [1, 1]);
  assert.match(refreshed, /## PRs opened by me/);
});

test("propagates review query failures instead of producing a partial note", async () => {
  const client = github({ assigned: [pr(1)] });
  client.getReviewRequestedPRs = async () => { throw new Error("Review query failed"); };

  await assert.rejects(syncTasks("", client, settings), /Review query failed/);
});
