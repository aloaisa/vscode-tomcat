'use strict';

import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { WildflyController } from "./Wildfly/WildflyController";
import { WildflyModel } from "./Wildfly/WildflyModel";
import { WildflyServer } from "./Wildfly/WildflyServer";
import { WarPackage } from "./Wildfly/WarPackage";
import { WildflySeverTreeProvider } from "./WildflySeverTreeProvider";
import { Utility } from "./Utility";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    let storagePath: string = context.storagePath;
    await TelemetryWrapper.initilizeFromJsonFile(context.asAbsolutePath('package.json'));
    if (!storagePath) {
        storagePath = Utility.getTempStoragePath();
    }
    const wildflyModel: WildflyModel = new WildflyModel(storagePath);
    const wildflyServerTree: WildflySeverTreeProvider = new WildflySeverTreeProvider(context, wildflyModel);
    const wildflyController: WildflyController = new WildflyController(wildflyModel, context.extensionPath);

    context.subscriptions.push(wildflyController);
    context.subscriptions.push(wildflyServerTree);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('wildflyServerExplorer', wildflyServerTree));
    context.subscriptions.push(registerCommandWrapper('wildfly.tree.refresh', (server: WildflyServer) => wildflyServerTree.refresh(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.war.browse', (war: WarPackage) => wildflyController.browseWarPackage(war)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.rename', (server: WildflyServer) => wildflyController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.add', () => wildflyController.addServer()));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.start', (server: WildflyServer) => wildflyController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.restart', (server: WildflyServer) => wildflyController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.stop', (server: WildflyServer) => wildflyController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.delete', (server: WildflyServer) => wildflyController.deleteServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.browse', (server: WildflyServer) => wildflyController.browseServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.debug', (server: WildflyServer) => wildflyController.runOrDebugOnServer(undefined, true, server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.war.run', (uri: vscode.Uri) => wildflyController.runOrDebugOnServer(uri)));
    context.subscriptions.push(registerCommandWrapper('wildfly.war.debug', (uri: vscode.Uri) => wildflyController.runOrDebugOnServer(uri, true)));
    context.subscriptions.push(registerCommandWrapper('wildfly.webapp.run', (uri: vscode.Uri) => wildflyController.runOrDebugOnServer(uri)));
    context.subscriptions.push(registerCommandWrapper('wildfly.webapp.debug', (uri: vscode.Uri) => wildflyController.runOrDebugOnServer(uri, true)));
    context.subscriptions.push(registerCommandWrapper('wildfly.config.open', (server: WildflyServer) => wildflyController.openServerConfig(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.war.delete', (warPackage: WarPackage) => wildflyController.deleteWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('wildfly.war.reveal', (warPackage: WarPackage) => wildflyController.revealWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.customizejvmoptions', (server: WildflyServer) => wildflyController.customizeJVMOptions(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.package', () => wildflyController.generateWarPackage()));

    // .context commands are duplicate for better naming the context commands and make it more clear and elegant
    context.subscriptions.push(registerCommandWrapper('wildfly.server.rename.context', (server: WildflyServer) => wildflyController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.start.context', (server: WildflyServer) => wildflyController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.restart.context', (server: WildflyServer) => wildflyController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.stop.context', (server: WildflyServer) => wildflyController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('wildfly.server.delete.context', (server: WildflyServer) => wildflyController.deleteServer(server)));
}

// tslint:disable no-any
function registerCommandWrapper(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    return TelemetryWrapper.registerCommand(command, (param: any[]) => {
        Utility.initTelemetrySteps();
        callback(param);
    });
}// tslint:enable no-any

// tslint:disable-next-line:no-empty
export function deactivate(): void {}
