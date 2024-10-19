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
    if (config.isAutoDeleteHistoryFiles){
        FileUtils.deleteDirFile(config.generatedDir)
    }

    function assemble(result: AnalyzerResult, filePath: string) {
        const fileName = `${prefixZR}${path.basename(filePath)}`

        if (!isEmpty(result.name) && !isEmpty(result.pageName)) {
            const type = result.currentAnnotation
            let buildFunction = ''
            if (type == AnnotationType.ROUTE){
                // 页面路由 路由表信息
                const routeInfo = new RouteInfo()
                routeInfo.name = result.name
                routeInfo.buildFunction = `${modName}${result.pageName}Builder`
                routeInfo.pageSourceFile = getRelativeModPath(getBuilderRegisterEtsAbsolutePath(config, fileName), modDir)

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
            } else if (type == AnnotationType.SERVICE){
                // 服务路由

            }

            // Builder函数注册信息
            const pageInfo = new PageInfo()
            pageInfo.buildFileName = fileName
            pageInfo.pageName = result.pageName
            pageInfo.importPath = getImportPath(config.generatedDir, filePath)
            pageInfo.buildFunctionName = buildFunction
            pageInfo.isDefaultExport = result.isDefaultExport
            pageList.push(pageInfo)

        }
    }

    config.scanDirs.forEach(scanDir => {
        const files = getFilesInDir(scanDir)
        files.forEach((filePath) => {
            if (fs.existsSync(filePath)) {
                const fileName = `${prefixZR}${path.basename(filePath)}`
                let analyzer = new Analyzer(AnalyzerParam.create(filePath, modName, modDir))
                analyzer.start()
                analyzer.results.forEach((result) => {
                    assemble(result, filePath);
                })
                generateRouterRegisterFile(config, pageList)
                pageList.length = 0
            }
        })
    })


    try {
        generateRouterMap(config, routeMap)
        checkIfModuleRouterMapConfig(config)
        // 删除历史产物
        deleteIndexImport(config)
        deleteGeneratedFiles(config)
    } catch (e) {
        console.error('executePlugin error: ', e)
    }

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
        logger('deleteGeneratedFiles: ', value.path)
        logger('deleteGeneratedFiles: ', value.parentPath)
        if (value.isFile() && value.name.endsWith('.ets') && !value.name.startsWith(prefixZR)) {
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
    return importPath.replace('.ets', '')
}


function generateRouterRegisterFile(config: PluginConfig, pageList: PageInfo[]) {

    pageList.forEach((item) => {
        generate(item.buildFileName)
    })

    function generate(fileName: string) {
        const generatedDir = config.generatedDir
        const registerBuilderFilePath = `${generatedDir}${fileName}`
        const registerBuilderFilePathOld = `${generatedDir}${builderRegisterFunFileName}`
        logger('registerBuilderFilePathOld ', registerBuilderFilePathOld)
        if (fs.existsSync(registerBuilderFilePathOld)) {
            logger('registerBuilderFilePathOld exists')
            fs.unlinkSync(registerBuilderFilePathOld)
        }

        if (fs.existsSync(registerBuilderFilePath) && pageList.length <= 0) {
            fs.unlinkSync(registerBuilderFilePath)
            return
        }

        // 模板路径是在离线包内的，因此路径也是相对离线包而言的
        const templatePath = path.resolve(__dirname, Constants.ROUTER_REGISTER_TEMPLATE_RELATIVE_PATH);
        logger('generateBuilderRegister template path: ', templatePath)
        const source = fs.readFileSync(templatePath, 'utf8')
        const template = Handlebars.compile(source)
        const content = {pageList: pageList}
        const ts = template(content)
        loggerNode(ts)
        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, {recursive: true});
        }
        writeFileSync(registerBuilderFilePath, ts)
    }

}

function generateRouterMap(config: PluginConfig, routeMap: RouteMap) {
    logger('generateRouterMap: ', JSON.stringify(routeMap))
    writeFileSync(config.routerMapPath, JSON.stringify(routeMap, null, 2), {encoding: "utf8"})

}

function getBuilderRegisterEtsAbsolutePath(config: PluginConfig, fileName: string): string {
    return path.join(config.generatedDir, fileName)
}

/**
 * 历史问题，删除index.ets的导出
 * @param config
 */
function deleteIndexImport(config: PluginConfig) {
    // logger('generateIndex page length: ', pageList.length)
    const indexPath = `${config.indexDir}/Index.ets`
    const importPath = getImportPath(config.indexDir, getBuilderRegisterEtsAbsolutePath(config, builderRegisterFunFileName))
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
        logger('generateIndex splice ')
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


function getFilesInDir(...dirPaths: string[]) {
    let files = new Array<string>()

    function find(currentDir: string) {
        const contents = readdirSync(currentDir, {withFileTypes: true})
        contents.forEach((value, index) => {
            // 文件目录路径 + 文件名称  = 文件路径
            const filePath = path.join(currentDir, value.name)
            if (value.isDirectory()) {
                find(filePath)
            } else if (value.isFile() && value.name.endsWith('.ets')) {
                files.push(filePath)
            }
        })
    }

    dirPaths.forEach((path) => {
        find(path)
    })
    logger(files)
    return files
}




