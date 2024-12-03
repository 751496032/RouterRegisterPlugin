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
     */
    isAutoDeleteHistoryFiles: Boolean = false
}

export class AnnotationMgr {
    currentAnnotation: AnnotationType  = AnnotationType.UNKNOWN

    getAnnotation(text: string): AnnotationType {
        if (text == AnnotationType.ROUTE) {
            return AnnotationType.ROUTE
        } else if (text == AnnotationType.Z_ROUTE) {
            return AnnotationType.Z_ROUTE
        } else if (text == AnnotationType.SERVICE) {
            return AnnotationType.SERVICE
        } else if (text == AnnotationType.Z_SERVICE) {
            return AnnotationType.Z_SERVICE
        } else if (text == AnnotationType.Z_ATTRIBUTE) {
            return AnnotationType.Z_ATTRIBUTE
        } else if (text == AnnotationType.Z_LIFECYCLE) {
            return AnnotationType.Z_LIFECYCLE
        } else {
            return AnnotationType.Z_ROUTE
        }
    }

    isRouteAnnotation() {
        return [AnnotationType.ROUTE, AnnotationType.Z_ROUTE].includes(this.currentAnnotation)
    }


    isServiceAnnotation() {
        return [AnnotationType.SERVICE, AnnotationType.Z_SERVICE].includes(this.currentAnnotation)
    }

    isAttrAnnotation() {
        return [AnnotationType.Z_ATTRIBUTE].includes(this.currentAnnotation)
    }

    isLifecycleAnnotation() {
        return [AnnotationType.Z_LIFECYCLE].includes(this.currentAnnotation)
    }

}


export class PageInfo extends AnnotationMgr{
    pageName?: string;
    importPath?: string;
    buildFunctionName: string = ''
    isDefaultExport: boolean = false
    buildFileName: string = ''
    zRouterPath: string = Constants.Z_ROUTER_PATHS[0]
    name: string = ""

}




export class AnalyzerResult extends AnnotationMgr {

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

    useTemplate: boolean = false

    extra: string =''
    needLogin: boolean = false
    // 页面名称
    pageName: string ='';
    isDefaultExport: boolean = false


    reset(){
        this.name = ""
        this.pageName = ""
        this.isDefaultExport = false
        this.currentAnnotation = AnnotationType.ROUTE
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
    Z_ROUTE = "ZRoute",
    Z_SERVICE = "ZService",
    Z_ATTRIBUTE = "ZAttribute",
    Z_LIFECYCLE = "ZLifecycle",

    UNKNOWN = 'unknown'
}


