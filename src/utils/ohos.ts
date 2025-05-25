/**
 * @author: HZWei
 * @date: 2025/5/25
 * @desc:
 */

import {OhosHapContext, OhosHarContext, OhosHspContext, OhosPluginId} from "@ohos/hvigor-ohos-plugin";
import {HvigorNode} from "@ohos/hvigor";


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

}




