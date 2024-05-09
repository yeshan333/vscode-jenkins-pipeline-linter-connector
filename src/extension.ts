'use strict';

import * as vscode from 'vscode';
import axios from 'axios';

let FormData = require('form-data');
let fs = require('fs');

function requestWithCrumb(fs: any, url: string, crumbUrl: string, user: string|undefined, pass: string|undefined, token: string|undefined, output: vscode.OutputChannel) {

    let options: any = {
        method: 'get',
        url: crumbUrl,
        headers: {}
    };

    if (user !== undefined && user.length > 0) {
        if(pass !== undefined && pass.length > 0) {
            let authToken = Buffer.from(user + ':' + pass).toString('base64');
            options.headers = Object.assign(options.headers, { Authorization: 'Basic ' + authToken });
        } else if ( token !== undefined && token.length > 0) {
            let authToken = Buffer.from(user + ':' + token).toString('base64');
            options.headers = Object.assign(options.headers, { Authorization: 'Basic ' + authToken });
        }
    }

    console.log("=========== crumb options ==========>")
    console.log(options)
    console.log("=========== crumb options <==========")

    axios(options)
    .then((response: any) => {
        console.log(response)
        validateRequest(fs, url, user, pass, token, response.data, output);
    })
    .catch((err: any) => {
        console.log(err)
        output.appendLine(err);
    });
}

function validateRequest(fs: any, url: string, user: string|undefined, pass: string|undefined, token: string|undefined, crumb: string|undefined, output: vscode.OutputChannel) {
    output.clear();
    let activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor !== undefined) {
        let checkExts = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.checkextensions') as string[] | undefined;
        let path = activeTextEditor.document.uri.fsPath;
        let lastDot = path.lastIndexOf(".")
        let fileExt = path.substring(lastDot, path.length).toLocaleLowerCase()

        if (checkExts !== undefined && checkExts.indexOf(fileExt) == -1 && path.indexOf("Jenkinsfile") == -1)
            return;

        let filestream = fs.createReadStream(path);
        const chunks: any = [];
        filestream.on('data', (chunk: any) => {
            chunks.push(chunk.toString());
        });
        filestream.on('end', () => {
            let data = new FormData();
            data.append('jenkinsfile', chunks.join());

            let options: any = {
                method: 'POST',
                url: url,
                data : data,
                headers: {}
            };

            console.log("========== Pipeline Content ==========")
            console.log(chunks.join())
            console.log("========== Pipeline Content ==========")

            if(crumb !== undefined && crumb.length > 0) {
                let crumbSplit = crumb.split(':');
                options.headers = Object.assign(options.headers, {'Jenkins-Crumb': crumbSplit[1]});
            }

            if (user !== undefined && user.length > 0) {
                if(pass !== undefined && pass.length > 0) {
                    let authToken = Buffer.from(user + ':' + pass).toString('base64');
                    options.headers = Object.assign(options.headers, { Authorization: 'Basic ' + authToken });
                } else if ( token !== undefined && token.length > 0) {
                    let authToken = Buffer.from(user + ':' + token).toString('base64');
                    options.headers = Object.assign(options.headers, { Authorization: 'Basic ' + authToken });
                }
            } 

            console.log("======= start: Jenkinsfile validate options =======");
            console.log(options);
            console.log("=======  Jenkinsfile validate options :end  =======");

            axios(options)
            .then((response: any) => {
                console.log(options);
                console.log(response.data);
                output.appendLine(response.data);
            })
            .catch((err: any) => {
                console.log(options);
                console.log(err);
                output.appendLine(err);
            });
        });
    } else {
        output.appendLine('No active text editor. Open the jenkinsfile you want to validate.');
    }
}

export function activate(context: vscode.ExtensionContext) {
    let output : vscode.OutputChannel = vscode.window.createOutputChannel("Jenkins Pipeline Linter");

    let lastInput: string;

    let validate = vscode.commands.registerCommand('jenkins.pipeline.linter.connector.validate', async () => {

        let url = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.connector.url') as string | undefined;
        let user = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.connector.user') as string | undefined;
        let pass = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.connector.pass') as string | undefined;
        let token = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.connector.token') as string | undefined;
        let crumbUrl = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.connector.crumbUrl') as string | undefined;

        if (url === undefined || url.length === 0) {
            url = await vscode.window.showInputBox({ prompt: 'Enter Jenkins Pipeline Linter Url.', value: lastInput });
        }
        if ((user !== undefined && user.length > 0) && (pass === undefined || pass.length === 0) && (token === undefined || token.length === 0)) {
            pass = await vscode.window.showInputBox({ prompt: 'Enter password.', password: true });
            if(pass === undefined || pass.length === 0) {
                token = await vscode.window.showInputBox({ prompt: 'Enter token.', password: false });
            }
        }
        if (url !== undefined && url.length > 0) {
            lastInput = url;

            if(crumbUrl !== undefined && crumbUrl.length > 0) {
                requestWithCrumb(fs, url, crumbUrl, user, pass, token, output);
            } else {
                validateRequest(fs, url, user, pass, token, undefined, output);
            }
        } else {
            output.appendLine('Jenkins Pipeline Linter Url is not defined.');
        }
        output.show(true);
    });

    let onSave = vscode.workspace.onDidSaveTextDocument((_document: vscode.TextDocument) => {
        
        let onSave = vscode.workspace.getConfiguration().get('jenkins.pipeline.linter.onsave') as boolean;
        console.log(`User onSave ${onSave}`)
        if (!onSave)
            return;

        vscode.commands.executeCommand('jenkins.pipeline.linter.connector.validate');
    });

    context.subscriptions.push(validate);
    context.subscriptions.push(onSave);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
