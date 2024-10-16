/**
 * @author: HZWei
 * @date: 2024/10/8
 * @desc:
 */

export default class Constants {
    static readonly PLUGIN_ID = "routerRegisterPlugin"
    static readonly BUILDER_REGISTER_FUN_FILE_NAME: string = 'builderRegister.ets'
    static readonly BUILDER_REGISTER_RELATIVE_PATH: string = '../builderRegister.txt'
    static readonly PREFIX_ZR: string = 'ZR'
    static readonly ETS_SUFFIX : string = '.ets'

    /**
     * 查找模块的Index.ets文件类型
     */
    static readonly TYPE_FIND_MODULE_INDEX_PATH: number = 0
    /**
     * 查找路由常量的类型
     */
    static readonly TYPE_FIND_ROUTE_CONSTANT_VALUE: number = 1
}