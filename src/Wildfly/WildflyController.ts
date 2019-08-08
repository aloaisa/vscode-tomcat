'use strict';

import * as chokidar from "chokidar";
import * as fs from "fs";
import * as fse from "fs-extra";
import * as _ from "lodash";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import { URL } from "url";
import { MessageItem } from "vscode";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import * as Constants from "../Constants";
import { DialogMessage } from '../DialogMessage';
import { Utility } from "../Utility";
import { WildflyModel } from "./WildflyModel";
import { WildflyServer } from "./WildflyServer";
import { WarPackage } from "./WarPackage";

export class WildflyController {
    private _outputChannel: vscode.OutputChannel;
    constructor(private _wildflyModel: WildflyModel, private _extensionPath: string) {
        this._outputChannel = vscode.window.createOutputChannel('vscode-wildfly');
    }

    public async deleteServer(wildflyServer: WildflyServer): Promise<void> {
        const server: WildflyServer = await this.precheck(wildflyServer);
        if (server) {
            if (server.isStarted()) {
                const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
                if (confirmation !== DialogMessage.yes) {
                    Utility.trackTelemetryStep('cancel');
                    return;
                }
                await this.stopOrRestartServer(server);
            }
            this._wildflyModel.deleteServer(server);
        }
    }

    public async openServerConfig(wildflyServer: WildflyServer): Promise<void> {
        if (wildflyServer) {
            const configFile: string = wildflyServer.getServerConfigPath();
            if (!await fse.pathExists(configFile)) {
                Utility.trackTelemetryStep('no configuration');
                throw new Error(DialogMessage.noServerConfig);
            }
            Utility.trackTelemetryStep('open configuration');
            Utility.openFile(configFile);
        }
    }

    public async browseWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            const server: WildflyServer = this._wildflyModel.getWildflyServer(warPackage.serverName);
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    Utility.trackTelemetryStep('start server');
                    this.startServer(server);
                }
            }

            this.openBrowserWithUrkContext(server);
        }
    }

    public async deleteWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            await fse.remove(warPackage.storagePath + '.war');
            vscode.commands.executeCommand('wildfly.tree.refresh');
        }
    }

    public revealWarPackage(warPackage: WarPackage): void {
        if (warPackage) {
            opn(warPackage.storagePath);
        }
    }

    public async addServer(): Promise<WildflyServer> {
        Utility.trackTelemetryStep('select install path');
        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
        if (_.isEmpty(pathPick) || !pathPick[0].fsPath) {
            return;
        }
        const wildflyInstallPath: string = pathPick[0].fsPath;
        if (!await Utility.validateInstallPath(wildflyInstallPath)) {
            vscode.window.showErrorMessage(Constants.INVALID_SERVER_DIRECTORY);
            Utility.trackTelemetryStep('install path invalid');
            return;
        }
        Utility.trackTelemetryStep('construct server name');
        const existingServerNames: string[] = this._wildflyModel.getServerSet().map((item: WildflyServer) => { return item.getName(); });
        const serverName: string = await Utility.getServerName(wildflyInstallPath, this._wildflyModel.defaultStoragePath, existingServerNames);
        const catalinaBasePath: string = await Utility.getServerStoragePath(this._wildflyModel.defaultStoragePath, serverName);
        await fse.remove(catalinaBasePath);
        Utility.trackTelemetryStep('copy files');
        await Promise.all([
            fse.copy(path.join(wildflyInstallPath, 'jboss-modules.jar'), path.join(catalinaBasePath, 'jboss-modules.jar')),
            fse.copy(path.join(wildflyInstallPath, 'bin'), path.join(catalinaBasePath, 'bin')),
            fse.copy(path.join(wildflyInstallPath, 'domain'), path.join(catalinaBasePath, 'domain')),
            fse.copy(path.join(wildflyInstallPath, 'modules'), path.join(catalinaBasePath, 'modules')),
            fse.copy(path.join(wildflyInstallPath, 'standalone'), path.join(catalinaBasePath, 'standalone')),
            fse.remove(path.join(catalinaBasePath, 'standalone/data')),
            fse.remove(path.join(catalinaBasePath, 'standalone/deployments')),
            fse.remove(path.join(catalinaBasePath, 'standalone/log')),
            fse.remove(path.join(catalinaBasePath, 'standalone/tmp')),

            fse.mkdirs(path.join(catalinaBasePath, 'standalone/data')),
            fse.mkdirs(path.join(catalinaBasePath, 'standalone/deployments')),
            fse.mkdirs(path.join(catalinaBasePath, 'standalone/log')),
            fse.mkdirs(path.join(catalinaBasePath, 'standalone/tmp')),

            fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(catalinaBasePath, 'jvm.options'))
        ]);
        // await Utility.copyServerConfig(path.join(wildflyInstallPath, 'conf', 'server.xml'), path.join(catalinaBasePath, 'conf', 'server.xml'));
        const wildflyServer: WildflyServer = new WildflyServer(serverName, wildflyInstallPath, catalinaBasePath);
        wildflyServer.setDebugPort(8787);
        Utility.trackTelemetryStep('add server');
        this._wildflyModel.addServer(wildflyServer);
        return wildflyServer;
    }

    public async customizeJVMOptions(wildflyServer: WildflyServer): Promise<void> {
        if (wildflyServer) {
            if (!await fse.pathExists(wildflyServer.jvmOptionFile)) {
                await fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(wildflyServer.getStoragePath(), 'jvm.options'));
            }
            Utility.openFile(wildflyServer.jvmOptionFile);
        }
    }

    public async renameServer(wildflyServer: WildflyServer): Promise<void> {
        const server: WildflyServer = await this.precheck(wildflyServer);
        if (server) {
            const newName: string = await vscode.window.showInputBox({
                prompt: 'input a new server name',
                validateInput: (name: string): string => {
                    if (name && !name.match(/^[\w.-]+$/)) {
                        return 'please input a valid server name';
                    } else if (this._wildflyModel.getWildflyServer(name)) {
                        return 'the name was already taken, please re-input';
                    }
                    return null;
                }
            });
            if (newName) {
                Utility.trackTelemetryStep('rename');
                server.rename(newName);
                await this._wildflyModel.saveServerList();
            }
        }
    }

    public async stopOrRestartServer(wildflyServer: WildflyServer, restart: boolean = false): Promise<void> {
        const server: WildflyServer = await this.precheck(wildflyServer);
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }
            Utility.trackTelemetryStep(restart ? 'restart' : 'stop');
            if (!restart) {
                server.clearDebugInfo();
            }
            server.needRestart = restart;
            const initScript = '\"' + path.join(server.getStoragePath(), '/bin/jboss-cli.sh\"');
            let stopParameters = ["--connect"];
            if (restart) {
                stopParameters.push("command=:reload");
            } else {
                stopParameters.push("command=:shutdown");
            }

            await Utility.executeCMD(this._outputChannel, server.getName(), initScript, { shell: true }, ...stopParameters);
        }
    }

    public async startServer(wildflyServer: WildflyServer): Promise<void> {
        const server: WildflyServer = wildflyServer ? wildflyServer : await this.selectServer(true);
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            await this.startWildfly(server);
        }
    }

    public async runOrDebugOnServer(uri: vscode.Uri, debug?: boolean, server?: WildflyServer): Promise<void> {
        if (!uri) {
            Utility.trackTelemetryStep('select war');
            const dialog: vscode.Uri[] = await vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: DialogMessage.selectWarPackage
            });
            if (_.isEmpty(dialog) || !dialog[0].fsPath) {
                return;
            }
            uri = dialog[0];
        }

        if (!await this.isWebappPathValid(uri.fsPath)) {
            return;
        }
        server = !server ? await this.selectServer(true) : server;
        if (!server) {
            return;
        }
        await this.deployWebapp(server, uri.fsPath);
        if (server.isStarted() && ((!server.isDebugging() && !debug) || server.isDebugging() === debug)) {
            return;
        }
        if (debug) {
            await this.prepareDebugInfo(server, uri);
        } else {
            server.clearDebugInfo();
        }
        if (server.isStarted()) {
            Utility.trackTelemetryStep('restart');
            await this.stopOrRestartServer(server, true);
        } else {
            Utility.trackTelemetryStep('start');
            await this.startWildfly(server);
        }
    }

    public async browseServer(wildflyServer: WildflyServer): Promise<void> {
        if (wildflyServer) {
            if (!wildflyServer.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(wildflyServer);
            }

            this.openBrowserWithUrkContext(wildflyServer);
        }
    }

    public async generateWarPackage(): Promise<void> {
        const folders: vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            let items: vscode.QuickPickItem[] = [];
            if (folders.length > 1) {
                items = await vscode.window.showQuickPick(
                    folders.map((w: vscode.WorkspaceFolder) => {
                        return { label: w.name, description: w.uri.fsPath };
                    }),
                    { placeHolder: DialogMessage.pickFolderToGenerateWar, canPickMany: true }
                );
            } else {
                items.push({
                    label: folders[0].name,
                    description: folders[0].uri.fsPath
                });
            }
            await Promise.all(items.map((i: vscode.QuickPickItem) => {
                return Utility.executeCMD(this._outputChannel, undefined, 'jar', { cwd: i.description, shell: true }, 'cvf', ...[`"${i.label}.war"`, '*']);
            }));
            vscode.window.showInformationMessage(DialogMessage.getWarGeneratedInfo(items.length));
        }
    }

    public dispose(): void {
        this._wildflyModel.getServerSet().forEach((element: WildflyServer) => {
            if (element.isStarted()) {
                this.stopOrRestartServer(element);
            }
            this._outputChannel.dispose();
        });
        this._wildflyModel.saveServerListSync();
    }

    private async isWebappPathValid(webappPath: string): Promise<boolean> {
        if (!await fse.pathExists(webappPath)) {
            return false;
        }
        const stat: fs.Stats = await new Promise((resolve: (r: fs.Stats) => void, reject: (E: Error) => void): void => {
            fs.lstat(webappPath, (err: Error, res: fs.Stats) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
        if (stat.isFile() && !this.isWarFile(webappPath)) {
            vscode.window.showErrorMessage(DialogMessage.invalidWarFile);
            return false;
        }
        if (stat.isDirectory() && !await fse.pathExists(path.join(webappPath, 'WEB-INF', 'web.xml'))) {
            vscode.window.showErrorMessage(DialogMessage.invalidWebappFolder);
            return false;
        }
        return true;
    }

    private async prepareDebugInfo(server: WildflyServer, uri: vscode.Uri): Promise<void> {
        if (!server || !uri) {
            return;
        }
        let workspaceFolder: vscode.WorkspaceFolder;
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                const relativePath: string = path.relative(f.uri.fsPath, uri.fsPath);
                return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== uri.fsPath);
            });
        }
        if (!workspaceFolder) {
            Utility.trackTelemetryStep('no proper workspace folder');
            vscode.window.showErrorMessage(DialogMessage.noPackage);
            return;
        }
        Utility.trackTelemetryStep('get debug port');
        const port: number = await server.getDebugPort();
        server.setDebugInfo(port, workspaceFolder);
    }

    private async selectServer(createIfNoneServer: boolean = false): Promise<WildflyServer> {
        let items: vscode.QuickPickItem[] = this._wildflyModel.getServerSet();
        if (_.isEmpty(items) && !createIfNoneServer) {
            return;
        }
        if (items.length === 1) {
            Utility.trackTelemetryStep('auto select the only server');
            return <WildflyServer>items[0];
        }
        items = createIfNoneServer ? items.concat({ label: `$(plus) ${DialogMessage.addServer}`, description: '' }) : items;
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            items,
            { placeHolder: createIfNoneServer && items.length === 1 ? DialogMessage.addServer : DialogMessage.selectServer }
        );

        if (pick) {
            if (pick instanceof WildflyServer) {
                Utility.trackTelemetryStep('select server');
                return pick;
            } else {
                Utility.trackTelemetryStep('add server');
                return await this.addServer();
            }
        }
    }

    private async deployWebapp(server: WildflyServer, webappPath: string): Promise<void> {
        if (!server || !await fse.pathExists(webappPath)) {
            return;
        }
        if (this.isWarFile(webappPath)) {
            Utility.trackTelemetryStep('deploy war');
            const deploymentsDirectory = path.join(this._wildflyModel.defaultStoragePath, '/wildfly/', server.basePathName, '/standalone/deployments/');
            await fse.remove(deploymentsDirectory);
            await fse.mkdirs(deploymentsDirectory);

            const warFile = path.basename(webappPath);
            await Utility.executeCMD(this._outputChannel, server.getName(), 'cp', { shell: true }, '\"' + webappPath + '\"', '\"' + deploymentsDirectory + warFile + '\"');
        } else {
            Utility.trackTelemetryStep('no war file');
            throw new Error(DialogMessage.invalidWarFile);
        }
        vscode.commands.executeCommand('wildfly.tree.refresh');
    }

    private isWarFile(filePath: string): boolean {
        return path.extname(filePath).toLocaleLowerCase() === '.war';
    }

    private startDebugSession(server: WildflyServer): void {
        if (!server || !server.getDebugPort() || !server.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: `${Constants.DEBUG_SESSION_NAME}_${server.basePathName}`,
            request: 'attach',
            hostName: 'localhost',
            port: server.getDebugPort(),
            timeout: 1000
        };
        Utility.trackTelemetryStep('start debug');
        setTimeout(() => vscode.debug.startDebugging(server.getDebugWorkspace(), config), 500);
    }

    private async startWildfly(serverInfo: WildflyServer): Promise<void> {
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);

        try {
            await this._wildflyModel.updateJVMOptions(serverName);
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    Utility.trackTelemetryStep('server port changed');
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );

                    if (result === DialogMessage.yes) {
                        Utility.trackTelemetryStep('revert');
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        Utility.trackTelemetryStep('more info clicked');
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                    Utility.trackTelemetryStep('http(s) port changed');
                    const item: MessageItem = await vscode.window.showWarningMessage(
                        DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                    );

                    if (item === DialogMessage.yes) {
                        await this.stopOrRestartServer(serverInfo, true);
                    } else if (item === DialogMessage.never) {
                        Utility.trackTelemetryStep('disable auto restart');
                        Utility.disableAutoRestart();
                    }
                }
            });

            let startArguments: string[] = serverInfo.jvmOptions.slice();

            const initScript = '\"' + path.join(serverInfo.getStoragePath(), '/bin/standalone.sh') + '\"';
            const javaProcess: Promise<void> = Utility.executeCMD(this._outputChannel, serverInfo.getName(), initScript, { shell: true }, ...startArguments);
            serverInfo.setStarted(true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startWildfly(serverInfo);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            if (watcher) { watcher.close(); }
            TelemetryWrapper.error(err);
            vscode.window.showErrorMessage(err.toString());
        }
    }
    private async precheck(wildflyServer: WildflyServer): Promise<WildflyServer> {
        if (_.isEmpty(this._wildflyModel.getServerSet())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        return wildflyServer ? wildflyServer : await this.selectServer();
    }

    private async openBrowserWithUrkContext(wildflyServer: WildflyServer): Promise<void> {
        if (!wildflyServer.getBaseUrlContext()) {
            let urlContext: string = await vscode.window.showInputBox({
                prompt: 'input the url context (example: suat/chebro)',
                validateInput: (name: string): string => {
                    if (name && !name.match(/^.*$/)) {
                        return 'please input a valid url context';
                    }
                    return null;
                }
            });
            if (!urlContext) {
                urlContext = '';
            }
            Utility.trackTelemetryStep('set url context');
            wildflyServer.setBaseUrlContext(urlContext);
            await this._wildflyModel.saveServerList();
        }

        Utility.trackTelemetryStep('get http port');
        const httpPort: string = await Utility.getPort(wildflyServer.getServerConfigPath(), Constants.PortKind.Http);
        Utility.trackTelemetryStep('browse server');
        const url = new URL(`${Constants.LOCALHOST}:${httpPort}`).toString() + wildflyServer.getBaseUrlContext();
        opn(url);
    }

}
