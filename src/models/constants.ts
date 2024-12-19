/**
 * @author: HZWei
 * @date: 2024/10/8
 * @desc:
 */

export default class Constants {
    static readonly ROUTER_PLUGIN_ID = "routerRegisterPlugin"
    static readonly BUILDER_REGISTER_FUN_FILE_NAME: string = 'builderRegister.ets'
    static readonly ROUTER_TEMPLATE_PATH: string = '../../template/builderRegister.txt'
    static readonly SERVICE_TEMPLATE_PATH: string = '../../template/serviceRegister.txt'
    static readonly PREFIX_ZR: string = 'ZR'
    static readonly ETS_SUFFIX : string = '.ets'
    static readonly Z_ROUTER_PATHS: string[] = ['@hzw/zrouter', 'routerapi']
    static readonly DEF_MODULE_NAME: string = "entry"
    static readonly DEF_OBSERVER_ATTRIBUTE_NAME: string = "lifecycleObserver"

    /**
     * 未知类型
     */
    static readonly TYPE_UNKNOWN: number = -1

    /**
     * 查找模块的Index.ets文件类型
     */
    static readonly TYPE_FIND_MODULE_INDEX_PATH: number = 0
    /**
     * 查找注解常量
     */
    static readonly TYPE_FIND_ANNOTATION_CONST_VALUE: number = 1
}