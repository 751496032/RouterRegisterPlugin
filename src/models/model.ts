import Constants from "./constants";

/**
 * @author: HZWei
 * @date: 2024/7/16
 * @desc:
 */
export class PluginConfig {
    /**
     * 扫描的目录
     * 默认是src/main/ets/
     * @deprecated
     */
    scanDir: string = ''

    scanDirs: string[] = []

    /**
     * builder函数注册代码生成的目录
     * src/main/ets/_generated/
     */
    generatedDir: string = ''
    /**
     * Index.ets目录
     * 模块下目录下
     */
    indexDir: string = ''
    /**
     * module.json5文件路径
     * src/main/ets/module.json5
     */
    moduleJsonPath: string = ''
    /**
     * 路由表路径
     * src/main/ets/resources/base/profile/route_map.json
     */
    routerMapPath: string = ''
    /**
     * 是否打印日志
     */
    logEnabled: boolean = true

    /**
     * 查看节点信息，只有与logEnable同时为true才会打印输出
     */
    viewNodeInfo: boolean = false

    /**
     * 是否启用删除无用编译产物
     * @deprecated
     */
    isAutoDeleteHistoryFiles: Boolean = false

    /**
     *  如果使用了NavDest模板，该字段会生效，默认属性名是lifecycleObserver
     *  @Provide / @Consume
     */
    lifecycleObserverAttributeName: string = Constants.DEF_OBSERVER_ATTRIBUTE_NAME

    /**
     * 是否启用ui预览时构建，默认不启用, 会降低ui预览构建效率
     */
    enableUiPreviewBuild: boolean = false

    /**
     * 忽略需要扫描的模块，模块名称，可选，默认是全部模块
     * 插件在工程级时使用，该字段才会生效
     * 建议配置该字段，避免扫描所有模块，影响工程编译效率
     */
    ignoredModules: string[] = []



}



export class PageInfo  {
    pageName?: string;
    importPath?: string;
    buildFunctionName: string = ''
    isDefaultExport: boolean = false
    buildFileName: string = ''
    zRouterPath: string = Constants.Z_ROUTER_PATHS[0]
    name: string = ""
    annotation: AnnotationType  = AnnotationType.UNKNOWN

    // NavDest模版相关参数
    useTemplate: boolean = false
    title: string = ""
    lifecycleObserver?: PageInfo
    attributes?: PageInfo
    lifecycleObserverAttributeName: string = ""
    useV2: boolean = false
    hideTitleBar: boolean = true
    // 路由参数字符串
    paramStr: string = ""


}




export class AnalyzerResult {

    /**
     * 注解上的通用字段
     * 路由名称 (route/service/attribute/lifecycle)
     * @name/route、service注解名称或路径，在route注解上也对应了route_map路由表的name
     */
    name: string = ''
    /**
     * route注解上额外字段
     * @description 路由描述(route注解的description，也是对应route_map路由表的description)
     */
    description: string =''

    useTemplate: boolean = false

    extra: string =''
    needLogin: boolean = false
    // 页面名称
    pageName: string ='';
    isDefaultExport: boolean = false
    annotation: AnnotationType  = AnnotationType.UNKNOWN
    title: string = ""
    useV2: boolean = false
    hideTitleBar: boolean = true
    loAttributeName: string = ""
    // 路由参数
    param: Record<string, { default: any }> = {}
    // 路由参数字符串
    paramStr: string = ""


    reset(){
        this.name = ""
        this.pageName = ""
        this.isDefaultExport = false
        this.annotation = AnnotationType.UNKNOWN
        this.useTemplate = false
        this.title = ""
        this.useV2 = false
        this.hideTitleBar = true
        this.loAttributeName = ""
        this.param = {}
        this.paramStr = ""
    }



}

export class Annotation {
    annotations: string[] = [AnnotationType.ROUTE, AnnotationType.SERVICE,
        AnnotationType.Z_ROUTE, AnnotationType.Z_SERVICE,
        AnnotationType.Z_ATTRIBUTE, AnnotationType.Z_LIFECYCLE]
    name: string = 'name'
    description: string = 'description'
    extra: string = "extra"
    needLogin: string = "needLogin"
    useTemplate: string = "useTemplate"
    title: string = "title"
    hideTitleBar: string = "hideTitleBar"
    useV2: string = "useV2"
    lifecycleObserverAttributeName: string = "loAttributeName"
}

export class ScanFileParam {
    // 将相对路径转换成绝对路径 ，然后查看目标文件
    importPath: string = '';
    absolutePath: string = ''
    className: string = '';
    attrName: string = '';
    attrValue: string = ''

    indexModuleName: string = ''
    moduleSrcPath: string = ""
    actionType: number =  Constants.TYPE_UNKNOWN

    isFindAnnotationConst(){
        return this.actionType == Constants.TYPE_FIND_ANNOTATION_CONST_VALUE
    }

    isFindModuleIndexPath(){
        return this.actionType == Constants.TYPE_FIND_MODULE_INDEX_PATH
    }

}

export class AnalyzerParam {
    private readonly _scanFilePath: string = ''
    private readonly _modName: string = ''
    private readonly _modDir: string = ''


    constructor(filePath: string, modName: string, modDir?: string) {
        this._scanFilePath = filePath
        this._modName = modName
        this._modDir = modDir || ''
    }


    get scanFilePath(): string {
        return this._scanFilePath;
    }

    get modName(): string {
        return this._modName;
    }

    get modDir(): string {
        return this._modDir;
    }

    static create(filePath: string, modName: string, modDir?: string): AnalyzerParam {
        return new AnalyzerParam(filePath, modName, modDir)
    }
}

export enum AnnotationType {
    ROUTE = "Route",
    SERVICE = "Service",
    Z_ROUTE = "ZRoute",
    Z_SERVICE = "ZService",
    Z_ATTRIBUTE = "ZAttribute",
    Z_LIFECYCLE = "ZLifecycle",

    UNKNOWN = 'unknown'
}


