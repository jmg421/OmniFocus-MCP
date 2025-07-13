#!/bin/bash
# Auto-deploy OmniFocus plugin
# Usage: ./deploy-plugin.sh [--watch]

set -e

PLUGIN_SOURCE="src/omnijs-plugin/exportMasterPlan.omnijs"
PLUGIN_TARGET="/Users/johnmuirhead-gould/Library/Containers/com.omnigroup.OmniFocus3/Data/Library/Application Support/Plug-Ins/com.jmg.exportmasterplan.v11.final.omnijs"

cd "$(dirname "$0")"

deploy_plugin() {
    echo "Deploying plugin to OmniFocus..."
    cp "$PLUGIN_SOURCE" "$PLUGIN_TARGET"
    echo "✅ Plugin deployed: $(basename "$PLUGIN_TARGET")"
    
    # Extract version from plugin for confirmation
    VERSION=$(grep '"version"' "$PLUGIN_SOURCE" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    echo "📦 Version: $VERSION"
    echo "📁 Target: $PLUGIN_TARGET"
}

if [ "$1" = "--watch" ]; then
    echo "👀 Watching for changes to $PLUGIN_SOURCE..."
    echo "Press Ctrl+C to stop watching"
    
    # Deploy initially
    deploy_plugin
    
    # Watch for changes (requires fswatch: brew install fswatch)
    if command -v fswatch >/dev/null 2>&1; then
        fswatch -o "$PLUGIN_SOURCE" | while read; do
            echo ""
            echo "🔄 Change detected..."
            deploy_plugin
        done
    else
        echo "⚠️  fswatch not found. Install with: brew install fswatch"
        echo "Falling back to manual deployment..."
        deploy_plugin
    fi
else
    deploy_plugin
fi 