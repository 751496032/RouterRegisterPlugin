
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
