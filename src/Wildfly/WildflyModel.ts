'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import { Utility } from "../Utility";
import { WildflyServer } from "./WildflyServer";

export class WildflyModel {
    private _serverList: WildflyServer[] = [];
    private _serversJsonFile: string;

    constructor(public defaultStoragePath: string) {
        this._serversJsonFile = path.join(defaultStoragePath, 'servers.json');
        this.initServerListSync();
        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(Constants.DEBUG_SESSION_NAME)) {
                this.clearServerDebugInfo(session.name.split('_').pop());
            }
        });
    }

    public getServerSet(): WildflyServer[] {
        return this._serverList;
    }

    public getWildflyServer(serverName: string): WildflyServer | undefined {
        return this._serverList.find((item: WildflyServer) => item.getName() === serverName);
    }

    public async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList.map((s: WildflyServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
            vscode.commands.executeCommand('wildfly.tree.refresh');
        } catch (err) {
            console.error(err.toString());
        }
    }

    public async updateJVMOptions(serverName: string) : Promise<void> {
        const server: WildflyServer = this.getWildflyServer(serverName);
        let result: string[] = [];
        const filterFunction: (para: string) => boolean = (para: string): boolean => {
            if (!para.startsWith('-')) {
                return false;
            }
            let valid: boolean = true;
            Constants.JVM_DEFAULT_OPTIONS_KEYS.forEach((key: string) => {
                if (para.startsWith(key)) {
                    valid = false;
                    return;
                }
            });
            return valid;
        };
        result = result.concat(await Utility.readFileLineByLine(server.jvmOptionFile, filterFunction));
        server.jvmOptions = result;
    }
    public deleteServer(wildflyServer: WildflyServer): boolean {
        const index: number = this._serverList.findIndex((item: WildflyServer) => item.getName() === wildflyServer.getName());
        if (index > -1) {
            const oldServer: WildflyServer[] = this._serverList.splice(index, 1);
            if (!_.isEmpty(oldServer)) {
                fse.remove(wildflyServer.getStoragePath());
                this.saveServerList();
                return true;
            }
        }

        return false;
    }

    public addServer(wildflyServer: WildflyServer): void {
        const index: number = this._serverList.findIndex((item: WildflyServer) => item.getName() === wildflyServer.getName());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(wildflyServer);
        this.saveServerList();
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._serversJsonFile, this._serverList.map((s: WildflyServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (!_.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string }) => {
                            return new WildflyServer(obj._name, obj._installPath, obj._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    private clearServerDebugInfo(basePathName: string): void {
        const server: WildflyServer = this._serverList.find((s: WildflyServer) => { return s.basePathName === basePathName; });
        if (server) {
            server.clearDebugInfo();
        }
    }
}
