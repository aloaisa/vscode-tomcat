'use strict';

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogMessage {
    export const yes: MessageItem = { title: localize('wildflyExt.yes', 'Yes') };
    export const no: MessageItem = { title: localize('wildflyExt.no', 'No'), isCloseAffordance: true };
    export const cancel: MessageItem = { title: localize('wildflyExt.cancel', 'Cancel'), isCloseAffordance: true };
    export const never: MessageItem = { title: localize('wildflyExt.never', 'Never') };
    export const moreInfo: MessageItem = { title: localize('wildflyExt.moreInfo', 'More Info') };
    export const selectServer: string = localize('wildflyExt.selectServer', 'Select Wildfly Server');
    export const addServer: string = localize('wildflyExt.addServer', 'Add New Server');
    export const noServer: string = localize('wildflyExt.noServer', 'There are no Wildfly Servers.');
    export const noPackage: string = localize('wildflyExt.noPackage', 'The selected package is not under current workspace.');
    export const noServerConfig: string = localize('wildflyExt.noServerConfig', 'The Wildfly Server is broken. It does not have server.xml');
    export const selectWarPackage: string = localize('wildflyExt.selectWarPackage', 'Select War Package');
    export const selectDirectory: string = localize('wildflyExt.selectDirectory', 'Select Wildfly Directory');
    export const deleteConfirm: string = localize('wildflyExt.deleteConfirm', 'This Wildfly Server is running, are you sure you want to delete it?');
    export const serverRunning: string = localize('wildflyExt.serverRunning', 'This Wildfly Server is already started.');
    export const serverStopped: string = localize('wildflyExt.serverStopped', 'This Wildfly Server was stopped.');
    export const startServer: string = localize('wildflyExt.startServer', 'The Wildfly server needs to be started before browsing. Would you like to start it now?');
    export const invalidWebappFolder: string = localize('wildflyExt.invalidWebappFolder', 'The folder is not a valid web app to run on Wildfly Server.');
    export const invalidWarFile: string = localize('wildflyExt.invalidWarFile', 'Please select a .war file.');
    export const pickFolderToGenerateWar: string = localize('wildflyExt.pickFolderToGenerateWar', 'Please select the folder(s) you want to generate war package');

    export function getServerPortChangeErrorMessage(serverName: string, serverPort: string): string {
        return localize('wildflyExt.serverPortChangeError', 'Changing the server port of a running server {0} will cause it unable to shutdown. Would you like to change it back to {1}?', serverName, serverPort);
    }
    export function getConfigChangedMessage(serverName: string): string {
        return localize('wildflyExt.configChanged', 'server.xml of running server {0} has been changed. Would you like to restart it?', serverName);
    }
    export function getWarGeneratedInfo(count: number): string {
        return localize('wildflyExt.warGenerated', '{0} war package(s) was generated.', count);
    }
}
