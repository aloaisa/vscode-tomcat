'use strict';

export const HTTP: string = 'HTTP/';

export const CATALINA: string = 'Catalina';

export const INVALID_SERVER_DIRECTORY: string = 'Please make sure you select a valid Wildfly Directory.';

// tslint:disable-next-line:no-http-string
export const UNABLE_SHUTDOWN_URL: string = 'https://stackoverflow.com/questions/36566401/severe-could-not-contact-localhost8005-wildfly-may-not-be-running-error-while/48636631#48636631';

export const RESTART_CONFIG_ID: string = 'restart_when_http(s)_port_change';

// tslint:disable-next-line:no-http-string
export const LOCALHOST: string = 'http://0.0.0.0';

export const JVM_OPTION_FILE: string = 'jvm.options';

export const CLASS_PATH_KEY: string = '-classpath';

export const CATALINA_BASE_KEY: string = '-Dcatalina.base';

export const CATALINA_HOME_KEY: string = '-Dcatalina.home';

export const WAR_FILE_EXTENSION: string = '.war';

export const DEBUG_SESSION_NAME: string = 'Wildfly Debug (Attach)';

export const JVM_DEFAULT_OPTIONS_KEYS: string[] = [CLASS_PATH_KEY, CATALINA_BASE_KEY, CATALINA_HOME_KEY];

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export enum PortKind {
    Server = 'Server',
    Http = 'Http',
    Https = 'Https'
}
