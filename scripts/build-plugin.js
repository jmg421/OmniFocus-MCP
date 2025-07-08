const fs = require('fs');
const path = require('path');

const pluginId = "com.jmg.exportmasterplan.v11.final";
const pluginName = "Export Master Plan v11 Final";
const pluginDescription = "Exports OmniFocus data to a structured JSON format for external processing.";
const authorName = "JMG"; // You can change this

const srcDir = path.resolve(__dirname, '..', 'src', 'omnijs-plugin');
const distDir = path.resolve(__dirname, '..', 'dist', 'omnijs-plugin');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const sourceCode = fs.readFileSync(path.join(srcDir, 'exportMasterPlan.js'), 'utf8');

const pluginJson = {
    "identifier": pluginId,
    "version": "1.0",
    "description": pluginDescription,
    "author": authorName,
    "actions": [
        {
            "title": pluginName,
            "script": "run-wrapper.js",
            "handler": "run",
            "argument": {
                "type": "string",
                "label": "JSON Criteria",
                "default": "{\\"type\\":\\"full_dump\\"}"
            }
        }
    ],
    "files": [
        {
            "name": "run-wrapper.js",
            "content": "const run = (argument) => { const mainLogic = (() => { " + sourceCode + " })(); return mainLogic(argument); };"
        }
    ]
};

const finalPluginContent = JSON.stringify(pluginJson, null, 2);
const finalFileName = `${pluginId}.omnijs`;

fs.writeFileSync(path.join(distDir, finalFileName), finalPluginContent, 'utf8');

console.log(`Successfully built plugin: ${path.join(distDir, finalFileName)}`); 