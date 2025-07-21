# AGENTS.md

## Build/Test Commands
- `npm run dev` - Build with watch mode for development
- `npm run build` - Production build
- No testing, linting, or formatting commands configured

## Code Style Guidelines
- Use TypeScript with strict mode enabled
- Use `@/` imports for src directory (not relative imports)
- Favor native HTML elements (e.g., dialog for modals)
- Use CSS classes in styles.css over inline styles
- Use Obsidian CSS variables for styling
- Use Lucide icons over emoji icons
- Avoid keeping unnecessary state - prefer stateless components
- Use CSS over JavaScript for animations/effects
- Comments sparingly - only for complex code or function/class docs
- No NodeJS APIs (breaks Obsidian mobile compatibility)

## Obsidian Plugin Patterns
- Extend Plugin class in main.ts for plugin lifecycle
- Use Obsidian's requestUrl instead of fetch for CORS handling
- Settings stored via loadData()/saveData() methods
- Use normalizePath() for file paths
- Use Notice class for user notifications
- Track GitHub items with `^gh-#######` tags (never modify this format)