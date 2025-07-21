# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an Obsidian plugin that syncs GitHub issues and pull requests to Obsidian tasks. It provides one-way synchronization from GitHub to Obsidian, allowing users to track their GitHub work items within their Obsidian vault.

## Development Commands

Build and development:
- `npm run dev` - Build with watch mode for development
- `npm run build` - Production build

No testing, linting, or formatting commands are currently configured.

## Architecture

The codebase is organized into distinct modules:

- `src/main.ts`: Plugin entry point, extends Obsidian's Plugin class, manages lifecycle
- `src/settings.ts`: Settings UI and configuration management  
- `src/github.ts`: GitHub API client using Octokit with custom fetch for CORS handling
- `src/sync.ts`: Core synchronization logic between GitHub and Obsidian
- `src/utils.ts`: Task parsing and formatting utilities

Key architectural decisions:
- Uses Obsidian's `requestUrl` instead of fetch to handle CORS
- One-way sync only (GitHub → Obsidian)
- Preserves user edits while updating completion status
- Supports both Tasks emoji format and Dataview format
- Uses `^gh-#######` tags to track GitHub items

## Important Development Notes

1. **Obsidian API**: This plugin uses Obsidian's plugin API. Always check Obsidian's API documentation for available methods.

2. **CORS Handling**: The plugin uses a custom fetch implementation in `github.ts` that wraps Obsidian's `requestUrl` to bypass CORS restrictions.

3. **Task Identification**: Tasks are tracked using `^gh-#######` tags. Never modify this format as it's crucial for sync functionality.

4. **Build Output**: Vite is configured to output a CommonJS module compatible with Obsidian's plugin system.

5. **Version Compatibility**: Check `versions.json` for minimum Obsidian version requirements when adding new API features.

6. **Settings Storage**: Plugin settings are automatically persisted by Obsidian using the `loadData()` and `saveData()` methods.

## Common Tasks

When modifying sync behavior:
1. Check `src/sync.ts` for the main sync logic
2. Review `src/utils.ts` for task formatting
3. Test with both Tasks and Dataview formats

When adding new settings:
1. Update the `GitHubTasksSettings` interface in `src/settings.ts`
2. Add UI controls in `GitHubTasksSettingTab`
3. Update default settings in `DEFAULT_SETTINGS`

When working with GitHub API:
1. All GitHub API calls go through `src/github.ts`
2. The custom fetch implementation is critical for Obsidian compatibility
3. Check rate limits and handle errors appropriately