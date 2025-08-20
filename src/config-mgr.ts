/**
 * @author: HZWei
 * @date: 2025/5/25
 * @desc:
 */
import {PluginConfig} from "./models/model";
import {FileUtil, HvigorNode} from "@ohos/hvigor";
import {isEmpty} from "./utils/string";
import FileHelper from "./utils/file-helper";
import {logger} from "./utils/logger";
import fs from "fs";
import Constants from "./models/constants";

export class ConfigMgr {
    static init(config: PluginConfig, node: HvigorNode): PluginConfig {
        const modDir = node.getNodePath()
        if (!config) {
            config = new PluginConfig()
        }
        if (isEmpty(config.indexDir)) {
            config.indexDir = `${modDir}/`
        }

        if (config.scanDirs && config.scanDirs.length > 0) {
            // if (!isEmpty(config.scanDir)) {
            //     throw new Error("scanDirs 和 scanDir两个字段不能同时使用，建议使用scanDirs数组字段")
            // }
            config.scanDirs.forEach((dir, index, array) => {
                config.scanDirs[index] = `${modDir}/${dir}/`
            })
            // 兼容老版本
            if (!isEmpty(config.scanDir)) {
                const dir = `${modDir}/${config.scanDir}/`
                if (!config.scanDirs.includes(dir) && FileUtil.isDictionary(dir)) {
                    config.scanDirs.push(dir)
                }

            }
        } else {
            if (isEmpty(config.scanDir)) {
                config.scanDir = `${modDir}${Constants.ETS_RELATIVE_PATH}`
            } else {
                config.scanDir = `${modDir}/${config.scanDir}/`
            }
            config.scanDirs = [config.scanDir]
        }
        config.scanDirs = FileHelper.getAllValidPaths(config.scanDirs)
        logger("scanDirs: " + JSON.stringify(config.scanDirs));
        if (isEmpty(config.generatedDir)) {
            config.generatedDir = `${modDir}${Constants._GENERATED_RELATIVE_PATH}`
        }
        if (isEmpty(config.routerMapPath)) {
            const routeDir = `${modDir}${Constants.PROFILE_RELATIVE_PATH}`
            if (!fs.existsSync(routeDir)) {
                fs.mkdirSync(routeDir, {recursive: true})
            }
            config.routerMapPath = `${routeDir}${Constants.ROUTE_MAP_FILE_NAME}`
        }
        if (isEmpty(config.moduleJsonPath)) {
            config.moduleJsonPath = `${modDir}${Constants.MODULE_RELATIVE_FILE_PATH}`
        }
        if (isEmpty(config.lifecycleObserverAttributeName)) {
            config.lifecycleObserverAttributeName = Constants.DEF_OBSERVER_ATTRIBUTE_NAME
        }
        if (isEmpty(config.entryName)) {
            config.entryName = Constants.ENTRY_NAME
        }
        return config
    }
}
