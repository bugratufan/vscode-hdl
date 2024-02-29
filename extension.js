const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
	console.log('Congratulations, your extension "vscode-hdl" is now active!');

	let analyzeModule = vscode.commands.registerCommand('vscode-hdl.analyzeModule', function () {
		// Get the active text editor

		let editor = vscode.window.activeTextEditor;
		let text = "";

		

		if (editor) {
			let document = editor.document;
			if (!editor.selection.isEmpty) {
				// There is a selection, get the selected text
				text = document.getText(editor.selection);
			} else {
				// There is no selection, get all text in the current tab
				text = document.getText();
			}
		}

		if (text !== "") {


			const componentRegex = /component\s+(\w+)\s+is[\s\S]*?end\s+component/gmi;
			const componentMatch = componentRegex.exec(text);
			const entityRegex = /entity\s+(\w+)\s+is[\s\S]*?end\s+entity/gmi;
			const entityMatch = entityRegex.exec(text);
			let match;
			if (entityMatch) {
				match = entityMatch;
			}
			else if (componentMatch){
				match = componentMatch;
			}


			if (match) {
				let clockIndex = 0;
				let clockPorts = [];
				const componentName = match[1];
				const portRegex = /(\w+)\s+:\s+(in|out)\s+(\w+)\s*(?:\((\d+)\s+(?:downto|to)\s+(\d+)\))?/gmi;
				let portMatch;
				this.instanceText = `u_${componentName} : ${componentName} port map (\n`;
				this.signalDeclarationsText = '';
				this.constraintText = '';

				while ((portMatch = portRegex.exec(match[0])) !== null) {
					const portName = portMatch[1];
					const portType = portMatch[2];
					const portDataType = portMatch[3];
					const rangeStart = portMatch[4];
					const rangeEnd = portMatch[5];

					let signalName;

					if (portType.toLowerCase() === 'out') {
						// if (portName.startsWith('i_')) {
						// signalName = 's_' + portName.substring(2);
						if (portName.startsWith('o_')) {
							signalName = 's_' + componentName + '_' + portName.substring(2);
						} else {
							signalName = 's_' + componentName + '_' + portName;
						}

						if (rangeStart && rangeEnd) {
							this.signalDeclarationsText += `signal ${signalName}: ${portDataType}(${rangeStart} ${rangeStart < rangeEnd ? 'to' : 'downto'} ${rangeEnd});\n`;
						} else {
							this.signalDeclarationsText += `signal ${signalName}: ${portDataType};\n`;
						}
					}


					if (portType.toLowerCase() === 'out') {
						this.instanceText += `  ${portName} => ${signalName},\n`;
					} else {
						this.instanceText += `  ${portName} => ,\n`;
					}

					// Check if the port name contains 'clk' or 'clock'
					if (portType.toLowerCase() === 'in' && portDataType.toLowerCase() === 'std_logic' && (portName.toLowerCase().includes('clk') || portName.toLowerCase().includes('clock'))) {
						const frequencyRegex = /(\d+)(?:MHz|KHz|Hz)?/i;
						const frequencyMatch = frequencyRegex.exec(portName);

						if (frequencyMatch) {
							let frequency = parseFloat(frequencyMatch[1]);
							const frequencyUnit = frequencyMatch[2];

							// Convert frequency to MHz if unit is missing or not MHz
							if (!frequencyUnit || frequencyUnit.toLowerCase() !== 'mhz') {
								if (frequencyUnit && frequencyUnit.toLowerCase() === 'khz') {
									frequency /= 1000;
								} else if (frequencyUnit && frequencyUnit.toLowerCase() === 'hz') {
									frequency /= 1000000;
								}
							}

							const period = 1000 / frequency; // Calculate period in nanoseconds
							clockPorts.push(portName);
							this.constraintText += `set_property -dict { PACKAGE_PIN ${portName} IOSTANDARD LVCMOS33 } [get_ports { ${portName} }]; # ${portName}\n`;
							this.constraintText += `create_clock -period ${period} -name clk${clockIndex} [get_ports ${portName}];\n\n`;
							clockIndex++;
						}
					}
				}

				this.instanceText = this.instanceText.slice(0, -2); // Remove the last comma
				this.instanceText += `\n);`;

			}

			if (this.instanceText !== '') {
				vscode.window.showInformationMessage("Instance is generated from the current component. Use 'Paste Instance' command to paste it.");
			}
			if (this.signalDeclarationsText !== '') {
				vscode.window.showInformationMessage("Signal declerations are generated from the current component. Use 'Paste Signals' command to paste it.");
			}
			if (this.constraintText !== '') {
				vscode.window.showInformationMessage("Constraints are generated from the current component. Use 'Paste Constraints' command to paste it.");
			}
			if (this.constraintText == '' && this.signalDeclarationsText == '' && this.instanceText == '') {
				vscode.window.showWarningMessage("No VHDL component found in the selected text.");
			}
			console.log(this.signalDeclarationsText)
			console.log(this.instanceText)
			console.log(this.constraintText)
			// Store the generated text for later use
			// context.globalState.update('instanceText', instanceText);
			// context.globalState.update('signalDeclarationsText', signalDeclarationsText);
			// context.globalState.update('constraints', constraints);
		}
	});


	let pasteInstance = vscode.commands.registerCommand('vscode-hdl.pasteInstance', function () {
		let editor = vscode.window.activeTextEditor;
		if (editor && this.instanceText !== '') {
			let position = editor.selection.start;
			editor.edit(editBuilder => {
				editBuilder.insert(position, this.instanceText);
			});
		} else {
			vscode.window.showWarningMessage("No instance text available in memory. Use 'Analyze Module' command first!");
		}
	});

	let pasteSignals = vscode.commands.registerCommand('vscode-hdl.pasteSignals', function () {
		let editor = vscode.window.activeTextEditor;
		if (editor && this.signalDeclarationsText !== '') {
			let position = editor.selection.start;
			editor.edit(editBuilder => {
				editBuilder.insert(position, this.signalDeclarationsText);
			});
		} else {
			vscode.window.showWarningMessage("No signal decleration available in memory. Use 'Analyze Module' command first!");
		}
	});

	let pasteConstraints = vscode.commands.registerCommand('vscode-hdl.pasteConstraints', function () {
		let editor = vscode.window.activeTextEditor;
		if (editor && this.constraintText !== '') {
			let position = editor.selection.start;
			editor.edit(editBuilder => {
				editBuilder.insert(position, this.constraintText);
			});
		} else {
			vscode.window.showWarningMessage("No constraint available in memory. Use 'Analyze Module' command first!");
		}
	});

	context.subscriptions.push(analyzeModule, pasteInstance, pasteSignals, pasteConstraints);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
