# Settings UI Design

## Overview

Add a settings UI to the TUI client so users can manage their server connection without environment variables.

## Decisions

| Decision | Choice |
|----------|--------|
| Config location | `~/.config/downtime/config.json` (XDG compliant) |
| File format | JSON |
| First run | Setup wizard (must complete before dashboard) |
| Settings scope | Connection settings only (serverUrl, wsUrl, apiKey) |
| Env var behavior | Override config file values |
| Keyboard shortcut | `,` to open settings from dashboard |
| UI pattern | Reuse existing Modal + FormField components |

## Config File

**Location:** `~/.config/downtime/config.json`

**Schema:**
```json
{
  "serverUrl": "http://localhost:3000",
  "wsUrl": "ws://localhost:3001",
  "apiKey": "your-api-key-here"
}
```

**Loading priority (highest to lowest):**
1. Environment variables (`SERVER_URL`, `WS_URL`, `API_KEY`)
2. Config file values
3. Defaults for URLs only (no default for API key)

## Components

### Config Module (`src/lib/config.ts`)

```typescript
import { z } from 'zod'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_DIR = join(homedir(), '.config', 'downtime')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const configSchema = z.object({
  serverUrl: z.string().url().default('http://localhost:3000'),
  wsUrl: z.string().url().default('ws://localhost:3001'),
  apiKey: z.string().min(1),
})

export type Config = z.infer<typeof configSchema>

export function configExists(): boolean
export function loadConfig(): Config | null
export function saveConfig(config: Config): void
```

### Setup Wizard (`src/components/SetupWizard.tsx`)

Shown on first launch when no valid config exists.

- Welcome message explaining what the app needs
- Three fields: Server URL, WebSocket URL, API Key
- URLs pre-filled with defaults, API key empty
- No escape/cancel option (must complete setup)
- On save: writes config, transitions to dashboard

### Settings View (`src/components/SettingsView.tsx`)

Accessed via `,` key from dashboard.

- Same Modal + FormField pattern as other forms
- Fields pre-populated from current config
- Tab/Arrows to navigate, Enter to save, Esc to cancel
- After save: shows "Settings saved. Restart to apply connection changes." then returns to dashboard

## File Changes

**New files:**
- `src/lib/config.ts` - Config load/save/exists functions
- `src/components/SetupWizard.tsx` - First-run setup
- `src/components/SettingsView.tsx` - Settings editor

**Modified files:**
- `src/index.tsx` - Load config before render
- `src/App.tsx` - Conditional wizard rendering, add settings view route
- `src/stores/app.ts` - Add `'settings'` to view union type
- `src/hooks/useKeyboard.ts` - Add `,` shortcut handler
- `src/components/HelpModal.tsx` - Document `,` shortcut
- `src/lib/env.ts` - Remove or make optional (replaced by config module)

## User Flows

### First Run
1. User launches app
2. `loadConfig()` returns null (no config, no env vars)
3. App renders `<SetupWizard>`
4. User fills in server URL, WS URL, API key
5. User presses Enter on last field
6. Config saved to `~/.config/downtime/config.json`
7. App transitions to dashboard

### Editing Settings
1. User presses `,` from dashboard
2. App renders `<SettingsView>` with current values
3. User edits fields
4. User presses Enter on last field (or Esc to cancel)
5. If saved: config written, success message shown, return to dashboard
6. User restarts app to apply connection changes

### Env Var Override
1. User has config file with serverUrl=X
2. User sets `SERVER_URL=Y` environment variable
3. App uses Y for serverUrl (env var wins)
4. Settings view shows Y (the effective value)
