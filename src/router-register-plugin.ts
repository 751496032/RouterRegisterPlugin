/**
 * @author: HZWei
 * @date: 2024/7/16
 * @desc:
 */
import {HvigorNode, HvigorPlugin} from '@ohos/hvigor';
import * as path from "path";
import Handlebars from "handlebars";
import * as fs from "fs"
import {readdirSync, readFileSync, writeFileSync} from "fs"
import {
    AnalyzerParam,
    AnalyzerResult,
    AnnotationType,
    PageInfo,
    PluginConfig,
    RouteInfo,
    RouteMap,
    RouteMetadata
} from "./model";
import {LogConfig, logger, loggerNode} from "./utils/logger";
import {isEmpty} from "./utils/text"
import JSON5 from "json5";
import {Analyzer} from "./analyzer";
import Constants from "./utils/constants";
import FileUtils from "./utils/file-util";


const builderRegisterFunFileName: string = Constants.BUILDER_REGISTER_FUN_FILE_NAME
const prefixZR: string = Constants.PREFIX_ZR
export function routerRegisterPlugin(config: PluginConfig): HvigorPlugin {

    return {
        pluginId: Constants.ROUTER_PLUGIN_ID,
        apply(node: HvigorNode) {
            LogConfig.init(config)
            logger('apply', 'hello routerRegisterPlugin!');
            logger('apply', `dirname: ${__dirname} `)
            logger('apply cwd: ', process.cwd()) // 应用项目的根目录
            logger('apply nodeName: ', node.getNodeName()) //模块名 ，比如entry，harA
            logger('apply nodePath: ', node.getNodePath()) //模块路径  这里和nodeDir是一样的
            initConfig(config, node);
            executePlugin(config, node)
        }
    }
}


function initConfig(config: PluginConfig, node: HvigorNode) {
    const modDir = node.getNodePath()
    if (!config) {
        config = new PluginConfig()
    }
    if (isEmpty(config.indexDir)) {
        config.indexDir = `${modDir}/`
    }

    if (config.scanDirs && config.scanDirs.length > 0) {
        if (!isEmpty(config.scanDir)){
            throw new Error("scanDirs 和 scanDir两个字段不能同时使用，建议使用scanDirs数组字段")
        }
        config.scanDirs.forEach((dir, index, array) => {
            config.scanDirs[index] = `${modDir}/${dir}/`
        })
    } else {
        if (isEmpty(config.scanDir)) {
            config.scanDir = `${modDir}/src/main/ets/`
        } else {
            config.scanDir = `${modDir}/${config.scanDir}/`
        }
        config.scanDirs = [config.scanDir]
    }
    logger("scanDirs: " + JSON.stringify(config.scanDirs));
    if (isEmpty(config.generatedDir)) {
        config.generatedDir = `${modDir}/src/main/ets/_generated/`
    }
    if (isEmpty(config.routerMapPath)) {
        const routeDir = `${modDir}/src/main/resources/base/profile/`
        if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, {recursive: true})
        }
        config.routerMapPath = `${routeDir}route_map.json`
    }
    if (isEmpty(config.moduleJsonPath)) {
        config.moduleJsonPath = `${modDir}/src/main/module.json5`
    }
}

function executePlugin(config: PluginConfig, node: HvigorNode) {
    logger('executePlugin config: ', config)
    const modName = node.getNodeName()
    const modDir = node.getNodePath()
    logger(modName, modDir)
    const routeMap = new RouteMap()
    const pageList = new Array<PageInfo>()
    const serviceList = new Array<PageInfo>()
    const zRouterPath = FileUtils.findZRouterModuleName(node)
    if (config.isAutoDeleteHistoryFiles){
        FileUtils.deleteDirFile(config.generatedDir)
    }

    function assembleFileContent(result: AnalyzerResult, filePath: string) {
        const fileName = `${prefixZR}${path.basename(filePath)}`

        if (!isEmpty(result.name) && !isEmpty(result.pageName)) {
            const type = result.currentAnnotation
            const pageInfo = new PageInfo()
            let buildFunction = ''
            if (type == AnnotationType.ROUTE){
                // 页面路由 路由表信息
                const routeInfo = new RouteInfo()
                routeInfo.name = result.name
                routeInfo.buildFunction = `${modName}${result.pageName}Builder`
                routeInfo.pageSourceFile = getRelativeModPath(getEtsRelativePathByGeneratedDir(config, fileName), modDir)

                const routeMetadata = new RouteMetadata()
                routeMetadata.description = result.description
                routeMetadata.needLogin = `${result.needLogin}`
                routeMetadata.extra = result.extra

                if (isEmpty(routeMetadata.description)) {
                    delete routeMetadata.description
                }
                if (isEmpty(routeMetadata.extra)) {
                    delete routeMetadata.extra
                }
                routeInfo.data = routeMetadata
                routeMap.routerMap.push(routeInfo)
                buildFunction = routeInfo.buildFunction
                // Builder函数注册信息

                pageInfo.buildFileName = fileName
                pageInfo.pageName = result.pageName
                pageInfo.importPath = getImportPath(config.generatedDir, filePath)
                pageInfo.buildFunctionName = buildFunction
                pageInfo.isDefaultExport = result.isDefaultExport
                pageInfo.currentAnnotation = type
                pageList.push(pageInfo)

            } else if (type == AnnotationType.SERVICE){
                // 服务路由
                logger('服务路由: ', result)
                pageInfo.name = result.name
                pageInfo.buildFileName = `${prefixZR}Service`
                pageInfo.pageName = result.pageName
                pageInfo.importPath = getImportPath(config.generatedDir, filePath)
                pageInfo.currentAnnotation = type
                pageInfo.zRouterPath = zRouterPath
                pageList.push(pageInfo)

            }


        }
    }

    config.scanDirs.forEach(scanDir => {
        const files = FileUtils.getFilesInDir(scanDir)
        files.forEach((filePath) => {
            if (fs.existsSync(filePath)) {
                let analyzer = new Analyzer(AnalyzerParam.create(filePath, modName, modDir))
                analyzer.start()
                analyzer.results.forEach((result) => {
                    assembleFileContent(result, filePath);
                })
                const routerPageList = pageList.filter(pageInfo => pageInfo.currentAnnotation == AnnotationType.ROUTE)
                const servicePageList = pageList.filter(pageInfo => pageInfo.currentAnnotation == AnnotationType.SERVICE)
                generateRouterRegisterFile(config, routerPageList)
                serviceList.push(...servicePageList)
                pageList.length = 0
            }
        })
    })


    try {
        generateRouterMap(config, routeMap)
        checkIfModuleRouterMapConfig(config)
        generateServiceFile(config, serviceList, modName)
        // 删除历史产物
        deleteIndexImport(config)
        deleteGeneratedFiles(config)
    } catch (e) {
        console.error('executePlugin error: ', e)
    }

}

function generateServiceFile(config: PluginConfig, pageList: Array<PageInfo>, modName: string) {
    if (pageList.length === 0) return
    /**
     * 分两步
     * 1、根据模版生成文件
     * 2、将文件在Index.ets文件中导出
     */
    // 1
    const generatedDir = config.generatedDir
    const ts = FileUtils.getTemplateContent(Constants.SERVICE_REGISTER_TEMPLATE_RELATIVE_PATH, pageList)
    loggerNode(ts)
    if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, {recursive: true});
    }
    const zServiceFileName = pageList[0].buildFileName
    const zServiceFilePath = `${generatedDir}${zServiceFileName}${Constants.ETS_SUFFIX}`
    writeFileSync(zServiceFilePath, ts)

    // 2
    const etsIndexPath = `${config.indexDir}/Index.ets`
    const importPath = getImportPath(config.indexDir, getEtsRelativePathByGeneratedDir(config, zServiceFileName))
    const fileContent: string = `export * from './${importPath}'`
    if (modName != Constants.DEF_MODULE_NAME) FileUtils.insertContentToFile(etsIndexPath, fileContent)



}

/**
 * 删除旧的生成文件
 * @param config
 */
function deleteGeneratedFiles(config: PluginConfig) {
    const generatedDir = config.generatedDir
    const contents = readdirSync(generatedDir, {withFileTypes: true})
    contents.forEach((value, index) => {
        const filePath = path.join(generatedDir, value.name)
        // logger('deleteGeneratedFiles: ', value.path)
        // logger('deleteGeneratedFiles: ', value.parentPath)
        if (value.isFile() && value.name.endsWith(Constants.ETS_SUFFIX) && !value.name.startsWith(prefixZR)) {
            fs.unlinkSync(filePath)
        }
    })
}

/**
 * 返回的格式：src/main/ets/....
 * @param fullPath
 * @param modDir
 */
function getRelativeModPath(fullPath: string, modDir: string): string {
    const relativePath = fullPath.replace(modDir, '')
    logger('===========================================')
    logger('fullPath: ', fullPath)
    logger('relativePath: ', relativePath)
    logger('===========================================')
    return relativePath.substring(1).replace(/\\/g, '/')
}

function getImportPath(from: string, to: string): string {
    let importPath = path.relative(from, to).replace(/\\/g, '/')
    logger('===========================================')
    logger('from: ', from)
    logger('to: ', to)
    logger('importPath: ', importPath)
    logger('===========================================')
    return importPath.replace(Constants.ETS_SUFFIX, '')
}


function generateRouterRegisterFile(config: PluginConfig, pageList: PageInfo[]) {

    pageList.forEach((item) => {
        generate(item.buildFileName)
    })

    function generate(fileName: string) {
        const generatedDir = config.generatedDir
        const registerBuilderFilePath = `${generatedDir}${fileName}`
        const registerBuilderFilePathOld = `${generatedDir}${builderRegisterFunFileName}`
        // logger('registerBuilderFilePathOld ', registerBuilderFilePathOld)
        if (fs.existsSync(registerBuilderFilePathOld)) {
            // logger('registerBuilderFilePathOld exists')
            fs.unlinkSync(registerBuilderFilePathOld)
        }

        if (fs.existsSync(registerBuilderFilePath) && pageList.length <= 0) {
            fs.unlinkSync(registerBuilderFilePath)
            return
        }
        const ts = FileUtils.getTemplateContent(Constants.ROUTER_REGISTER_TEMPLATE_RELATIVE_PATH, pageList)
        loggerNode(ts)
        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, {recursive: true});
        }
        writeFileSync(registerBuilderFilePath, ts)
    }

}

function generateRouterMap(config: PluginConfig, routeMap: RouteMap) {
    logger('generateRouterMap: ', JSON.stringify(routeMap))
    if (routeMap.routerMap.length <= 0) return
    writeFileSync(config.routerMapPath, JSON.stringify(routeMap, null, 2), {encoding: "utf8"})

}

/**
 * 获取生成文件的相对路径 ./src/main/ets/_generated/fileName
 * @param config
 * @param fileName
 * @returns {string} 返回的是相对路径
 */
function getEtsRelativePathByGeneratedDir(config: PluginConfig, fileName: string): string {
    return path.join(config.generatedDir, fileName)
}

/**
 * 历史问题，删除index.ets的导出
 * @param config
 */
function deleteIndexImport(config: PluginConfig) {
    // logger('generateIndex page length: ', pageList.length)
    const indexPath = `${config.indexDir}/Index.ets`
    const importPath = getImportPath(config.indexDir, getEtsRelativePathByGeneratedDir(config, builderRegisterFunFileName))
    const data: string = `export * from './${importPath}'`

    if (!fs.existsSync(indexPath)) {
        return
    }
    const content = fs.readFileSync(indexPath, {encoding: "utf8"})
    const lines = content.split('\n').filter((item) => {
        return item !== ''
    })
    const target = lines.find((item) => item === data)

    if (!isEmpty(target)) {
        // logger('generateIndex splice ')
        const index = lines.indexOf(target!)
        lines.splice(index, 1)
        fs.writeFileSync(indexPath, lines.join('\n'), {encoding: "utf8"})
    }

}

function checkIfModuleRouterMapConfig(config: PluginConfig) {
    logger("===========================================")
    logger('checkIfModuleRouterMapConfig')
    if (!fs.existsSync(config.moduleJsonPath)) return;
    const content = readFileSync(config.moduleJsonPath, "utf8")
    const module = JSON5.parse(content)
    if (module.module.routerMap) return;
    module.module.routerMap = "$profile:route_map"
    fs.writeFileSync(config.moduleJsonPath, JSON.stringify(module, null, 2), {encoding: "utf8"})
    logger('checkIfModuleRouterMapConfig ok')
    logger("===========================================")

}







