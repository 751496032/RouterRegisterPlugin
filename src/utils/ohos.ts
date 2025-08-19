/**
 * @author: HZWei
 * @date: 2025/5/25
 * @desc:
 */

import {OhosAppContext, OhosHapContext, OhosHarContext, OhosHspContext, OhosPluginId} from "@ohos/hvigor-ohos-plugin";
import {HvigorNode} from "@ohos/hvigor";
import Constants from "../models/constants";


export type OhosContext = OhosHapContext | OhosHarContext | OhosHspContext;

export class OhosUtil {
    static getOhosContext(node: HvigorNode): OhosContext | undefined {
        const ids = node.getAllPluginIds()
        for (const id of ids) {
            if (id === OhosPluginId.OHOS_HAP_PLUGIN) {
                return node.getContext(id) as OhosHapContext
            }
            if (id === OhosPluginId.OHOS_HAR_PLUGIN) {
                return node.getContext(id) as OhosHarContext
            }
            if (id === OhosPluginId.OHOS_HSP_PLUGIN) {
                return node.getContext(id) as OhosHspContext
            }
        }
        return undefined
    }

    static isHasOhosPluginId(node: HvigorNode, pluginId: string): boolean {
        return node.getAllPluginIds().find((id) => {
            return id == pluginId
        }) !== undefined
    }

    static isEntryModule(node: HvigorNode, entryName: string = Constants.ENTRY_NAME): boolean {
        const ohosContext = OhosUtil.getOhosContext(node)
        return ohosContext?.getModuleName() == entryName
    }

    static isAppModule(node: HvigorNode): boolean {
        const appContext = node.getContext(OhosPluginId.OHOS_APP_PLUGIN)
        return appContext !== undefined
    }

}




