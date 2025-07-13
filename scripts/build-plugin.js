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

// Create proper OmniFocus plugin format with embedded manifest
const pluginContent = `/*{
	"type": "action",
	"targets": ["omnifocus"],
	"author": "${authorName}",
	"identifier": "${pluginId}",
	"version": "1.0",
	"description": "${pluginDescription}",
	"label": "${pluginName}",
	"shortLabel": "Export Master Plan",
	"paletteLabel": "Export Master Plan",
	"image": "doc.text"
}*/
(() => {
	const action = new PlugIn.Action(function(selection, sender){
		// Wrap the source code in a function that gets the argument
		const argument = JSON.stringify({type: "flagged_analysis", hideCompleted: false});
		
		// Execute the main logic
		${sourceCode.replace(/^const run = \(argument\) => \{/, '').replace(/\};?\s*$/, '')}
	});

	action.validate = function(selection, sender){
		return true;
	};
	
	return action;
})();`;

const finalFileName = `${pluginId}.omnijs`;
fs.writeFileSync(path.join(distDir, finalFileName), pluginContent, 'utf8');

console.log(`Plugin built successfully: ${finalFileName}`);
console.log(`Output directory: ${distDir}`); 