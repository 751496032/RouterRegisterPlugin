import Constants from "./utils/constants";

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
     */
    isAutoDeleteHistoryFiles: Boolean = false
}

export class PageInfo {
    pageName?: string;
    importPath?: string;
    buildFunctionName: string = ''
    isDefaultExport: boolean = false
    buildFileName: string = ''
    currentAnnotation: AnnotationType = AnnotationType.ROUTE
    zRouterPath: string = Constants.Z_ROUTER_PATHS[0]
    name: string = ""
}


export class RouteMap {
    routerMap: Array<RouteInfo> = []
}

export class RouteInfo {
    name?: string = ''
    /**
     * builder函数注册路径，是相对于模块的路径
     */
    pageSourceFile?: string = ''
    buildFunction?: string = ''
    data?: RouteMetadata
}

export class RouteMetadata {
    description?: string
    extra?: string
    needLogin?: string
}


export class AnalyzerResult {

    /**
     * 注解上的通用字段
     * 路由名称 (route/service)
     * @name/route、service注解名称或路径，在route注解上也对应了route_map路由表的name
     */
    name: string = ''
    /**
     * route注解上额外字段
     * @description 路由描述(route注解的description，也是对应route_map路由表的description)
     */
    description: string =''
    extra: string =''
    needLogin: boolean = false
    // 页面名称
    pageName: string ='';
    isDefaultExport: boolean = false
    currentAnnotation: AnnotationType = AnnotationType.ROUTE

    reset(){
        this.name = ""
        this.pageName = ""
        this.isDefaultExport = false
        this.currentAnnotation = AnnotationType.ROUTE
    }

}

export class Annotation {
    annotationNames: string[] = [AnnotationType.ROUTE, AnnotationType.SERVICE]
    name: string = 'name'
    description: string = 'description'
    extra: string = "extra"
    needLogin: string = "needLogin"
}

export class RouterParamWrap {
    // 将相对路径转换成绝对路径 ，然后查看目标文件
    importPath: string = '';
    absolutePath: string = ''
    className: string = '';
    attrName: string = '';
    attrValue: string = ''

    indexModuleName: string = ''
    moduleSrcPath: string = ""
    actionType: number =  -1
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
}
