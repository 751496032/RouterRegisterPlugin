
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
    others?:string // 其他路由配置参数
}


export class MetadataOthers {
    moduleName?: string
    useTemplate?: boolean
    title?: string
    hideTitleBar?: boolean
    useV2?: boolean
    loAttributeName?: string
    param?: string
}
