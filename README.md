# OmniFocus MCP Integration

MCP (Model Context Protocol) integration for OmniFocus with TypeScript tooling and automation.

## Quick Start

### Plugin Development & Deployment

The OmniFocus plugin needs to be copied (not symlinked) to the OmniFocus plugins directory. We provide several convenient methods:

#### Method 1: Make Commands (Recommended)
```bash
# Deploy plugin once
make deploy-plugin

# Watch plugin file and auto-deploy on changes (requires fswatch)
make watch-plugin

# Test the automation pipeline
make test-automation

# Run fresh OmniFocus export
make export-omnifocus
```

#### Method 2: Direct Script
```bash
cd OmniFocus-MCP
./deploy-plugin.sh              # Deploy once
./deploy-plugin.sh --watch      # Watch for changes
```

#### Method 3: VS Code Tasks
- **Cmd+Shift+P** → "Tasks: Run Task"
- Select "Deploy OmniFocus Plugin" (or use **Cmd+Shift+B**)
- Other available tasks:
  - **Watch OmniFocus Plugin** - Auto-deploy on file changes
  - **Test OmniFocus Automation** - Test the pipeline
  - **Export OmniFocus Data** - Run fresh export

### Plugin Modes

The plugin supports two modes:

1. **Interactive Mode** (manual use)
   - Run from OmniFocus Automation menu
   - Shows export type dialog
   - Saves to chosen location

2. **Automatic Mode** (programmatic use)
   - Called via AppleScript with JSON arguments
   - Saves to predetermined location
   - No user interaction required

### Usage

#### Manual Export (Interactive)
```bash
# In OmniFocus: Automation → Export Master Plan
# Choose export type from dialog
```

#### Automated Export (Programmatic)
```bash
# Via the fresh CLI wrapper
./ofcli_fresh.sh

# Or directly
cd OmniFocus-MCP
npx ts-node src/dumpDatabaseCli.ts
```

## Development

### Plugin Structure
- **Source**: `src/omnijs-plugin/exportMasterPlan.omnijs`
- **Target**: OmniFocus plugins directory
- **ID**: `com.jmg.exportmasterplan.v11.final`

### Auto-deployment Setup
```bash
# Install fswatch for file watching (optional)
brew install fswatch

# Start watching plugin file
make watch-plugin
```

### Version Management
The plugin version is automatically extracted and displayed during deployment. Update the version in the plugin manifest when making changes.

## Architecture

- **TypeScript CLI** (`src/dumpDatabaseCli.ts`) - Calls AppleScript
- **AppleScript Template** (`scripts/omnifocus_plugin_runner.applescript`) - Executes plugin
- **OmniFocus Plugin** (`src/omnijs-plugin/exportMasterPlan.omnijs`) - Exports data
- **Output**: `data/omnifocus_export.json`

## Troubleshooting

### Plugin Not Found
```bash
# Redeploy the plugin
make deploy-plugin

# Check if OmniFocus plugins directory exists
ls -la "/Users/$USER/Library/Containers/com.omnigroup.OmniFocus3/Data/Library/Application Support/Plug-Ins/"
```

### Automation Fails
1. Ensure OmniFocus is running
2. Check plugin is deployed correctly
3. Verify plugin ID matches in AppleScript template

### Symbolic Links Not Supported
OmniFocus requires actual file copies, not symbolic links. Use the deployment scripts provided.