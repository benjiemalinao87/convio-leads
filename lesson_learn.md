# Lessons Learned - Convio Leads Project

## Navigation Design Fix (March 25, 2024)

### Problem
User requested to move navigation from sidebar to top to maximize real estate for main page content.

### Solution Applied
1. **Created TopNavbar component** instead of modifying existing sidebar
2. **Maintained responsive design** with desktop horizontal nav and mobile dropdown
3. **Updated Layout component** to remove sidebar constraints and use full width
4. **Preserved all functionality** including branding, user info, and active state highlighting

### Key Lessons
- ✅ **DO**: Create new components instead of heavily modifying existing ones when refactoring layout
- ✅ **DO**: Maintain responsive design patterns (horizontal nav + mobile dropdown)
- ✅ **DO**: Test both desktop and mobile layouts during development
- ✅ **DO**: Preserve existing styling patterns and brand identity
- ❌ **DON'T**: Remove existing components until new ones are fully tested
- ❌ **DON'T**: Break mobile responsiveness when moving to horizontal layouts

## Leads Page Development (March 25, 2024)

### Problem
Blank leads page needed comprehensive design with mock data and full functionality.

### Solution Applied
1. **Created structured mock data** with realistic lead information and proper TypeScript types
2. **Built reusable components** (LeadsTable, LeadsFilters) in separate files
3. **Implemented sorting and filtering** with proper state management
4. **Added KPI calculations** derived from filtered data
5. **Fixed accessibility issues** by adding aria-labels to icon-only buttons

### Key Lessons
- ✅ **DO**: Create comprehensive mock data that represents real-world scenarios
- ✅ **DO**: Separate components into focused, reusable files (< 200 lines each)
- ✅ **DO**: Use proper TypeScript interfaces for data structures
- ✅ **DO**: Implement sorting and filtering at the data level, not just UI
- ✅ **DO**: Add accessibility attributes (aria-labels) for screen readers
- ✅ **DO**: Calculate KPIs dynamically from filtered data
- ✅ **DO**: Address linting errors immediately during development
- ❌ **DON'T**: Create monolithic components that handle multiple concerns
- ❌ **DON'T**: Ignore accessibility warnings from linters
- ❌ **DON'T**: Hard-code values that should be calculated dynamically

## Development Process Best Practices

### Planning and Execution
- ✅ **DO**: Use todo lists to track complex multi-step tasks
- ✅ **DO**: Update todos in real-time as work progresses
- ✅ **DO**: Test each component individually before integration
- ✅ **DO**: Check for linting errors after each significant change
- ✅ **DO**: Update progress documentation when features are completed

### Code Organization
- ✅ **DO**: Keep related data structures in dedicated files (`/data` folder)
- ✅ **DO**: Group related components in feature folders (`/components/leads`)
- ✅ **DO**: Use consistent naming conventions throughout the project
- ✅ **DO**: Import dependencies at the top of files in logical order

### Error Handling
- ✅ **DO**: Address linting errors immediately when they appear
- ✅ **DO**: Read error messages carefully before applying fixes
- ✅ **DO**: Use proper TypeScript types to catch errors early
- ❌ **DON'T**: Skip accessibility requirements to avoid linting errors

## Global Rename Operation (March 25, 2024)

### Problem
User requested to rename "Workspaces" to "Webhooks" throughout the entire application.

### Solution Applied
1. **Systematic approach**: Updated all references in a logical order (navigation → files → routes → content)
2. **Created new file first**: Built Webhooks.tsx before deleting Workspaces.tsx to avoid breaking state
3. **Updated navigation components**: Changed both active TopNavbar and legacy Sidebar
4. **Modified routing**: Updated both route paths and component imports in App.tsx
5. **Content updates**: Changed user-facing text to reflect new terminology
6. **Cleanup**: Removed old files after confirming new ones work

### Key Lessons
- ✅ **DO**: Follow a systematic approach for global renames (navigation → files → routes → content)
- ✅ **DO**: Create new files before deleting old ones to maintain working state
- ✅ **DO**: Update both active and legacy components that might be referenced
- ✅ **DO**: Use search tools to find all references before making changes
- ✅ **DO**: Update user-facing text consistently with technical changes
- ✅ **DO**: Test the application after global changes to ensure functionality
- ❌ **DON'T**: Delete files before confirming replacements work
- ❌ **DON'T**: Forget to update route paths when changing component names
- ❌ **DON'T**: Leave mixed terminology in user-facing content

## Webhook Filter Implementation & Radix UI Select Error Fix (March 25, 2024)

### Problem
User requested webhook filtering capability, and encountered Radix UI Select error: "A <Select.Item /> must have a value prop that is not an empty string."

### Solution Applied
1. **Added webhook field to data structure**: Extended Lead interface and mock data with webhook information
2. **Implemented comprehensive filtering**: Added webhook filter to LeadsFilters component with proper state management
3. **Updated UI components**: Added webhook display to table and details dialog
4. **Fixed Radix UI error**: Replaced empty string values with "all" in Select components and added proper value mapping

### Key Lessons
- ✅ **DO**: Use non-empty string values for Radix UI Select items (use "all" instead of "")
- ✅ **DO**: Map select values properly when converting between "all" and empty string for filtering logic
- ✅ **DO**: Update all related components when adding new data fields (table, filters, details)
- ✅ **DO**: Add visual indicators (colored badges) to distinguish different webhook sources
- ✅ **DO**: Maintain consistency in filter patterns across all filter types
- ✅ **DO**: Test select components immediately after implementation to catch UI library constraints
- ❌ **DON'T**: Use empty strings as Select.Item values in Radix UI components
- ❌ **DON'T**: Forget to update the filter state interface when adding new filter fields
- ❌ **DON'T**: Add new data fields without updating all display components

## API Documentation Dialog Scrolling Fix (September 25, 2025)

### Problem
User reported that the API Documentation component dialog could not be scrolled down, preventing access to content below the fold.

### Solution Applied
1. **Simplified container structure**: Removed complex nested flex containers that were constraining scroll behavior
2. **Fixed height calculations**: Used specific height calculations (`h-[calc(90vh-120px)]`) instead of complex flex layouts
3. **Proper overflow handling**: Applied `overflow-y-auto` to the correct container level for scrolling
4. **Maintained responsive design**: Preserved dialog responsiveness while fixing scroll functionality

### Key Lessons
- ✅ **DO**: Use specific height calculations for scrollable containers instead of complex flex layouts
- ✅ **DO**: Apply `overflow-y-auto` at the correct container level in nested structures
- ✅ **DO**: Test scrolling behavior immediately after layout changes
- ✅ **DO**: Simplify container structures when dealing with scroll issues - complex nesting often causes problems
- ✅ **DO**: Use calc() for precise height calculations when dealing with fixed headers
- ❌ **DON'T**: Over-complicate flex container nesting for dialog content areas
- ❌ **DON'T**: Use `overflow-hidden` on containers that need to scroll
- ❌ **DON'T**: Rely on implicit height inheritance in deeply nested scroll containers

## Cloudflare Workers Package Manager Conflict Fix (September 25, 2025)

### Problem
Cloudflare Workers deployment failing with "lockfile had changes, but lockfile is frozen" error when trying to deploy webhook API. The build was attempting to use `bun install --frozen-lockfile` but the webhook API uses npm with `package-lock.json`.

### Root Cause
- Main project has `bun.lockb` file in root directory
- Webhook API subdirectory (`/webhook-api/webhook-api/`) uses npm with `package-lock.json`
- Cloudflare detected Bun lockfile and tried to use Bun for deployment
- Mismatch between package managers caused frozen lockfile error

### Solution Applied
1. **Added explicit build configuration** in `wrangler.jsonc` to force npm usage: `"build": { "command": "npm install && npm run build" }`
2. **Created `.npmrc` file** in webhook-api directory to explicitly specify npm as package manager
3. **Documented the fix** to prevent future confusion about mixed package managers

### Key Lessons
- ✅ **DO**: Use consistent package managers within subdirectories when deploying to Cloudflare
- ✅ **DO**: Add explicit build commands in `wrangler.jsonc` when package manager detection might fail
- ✅ **DO**: Create `.npmrc` files to explicitly specify package manager preferences
- ✅ **DO**: Check parent directories for conflicting lockfiles when deployment fails
- ✅ **DO**: Understand that Cloudflare Workers auto-detects package managers from lockfiles
- ❌ **DON'T**: Mix package managers (npm/bun) in parent/child directories without explicit configuration
- ❌ **DON'T**: Rely on automatic package manager detection when using monorepo structures
- ❌ **DON'T**: Ignore package manager conflicts in deployment logs
