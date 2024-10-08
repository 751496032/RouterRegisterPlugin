import {PluginConfig} from "../model";

class LogConfig {
  public static logEnabled: boolean = false
  public static viewNodeInfo: boolean = false

    static init(config: PluginConfig) {
        if ('logEnabled' in config) {
            LogConfig.logEnabled = config.logEnabled
        }
        if ('viewNodeInfo' in config) {
            LogConfig.viewNodeInfo = config.viewNodeInfo
        }
        console.log("LogConfig", LogConfig.logEnabled, LogConfig.viewNodeInfo)
    }
}

function loggerNode(...args: any[]) {
    try {
        if (LogConfig.viewNodeInfo) logger(...args)
    } catch (e) {

    }
}

function logger(...args: any[]) {
    if (LogConfig.logEnabled) console.log('logger-> ', ...args)
}

function loggerE(...args: any[]) {
    if (LogConfig.logEnabled) console.error('logger err-> ', ...args)
}

export {logger, loggerE, loggerNode, LogConfig}
