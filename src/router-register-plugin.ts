/**
 * @author: HZWei
 * @date: 2024/7/16
 * @desc:
 */
import {HvigorNode, HvigorPlugin} from '@ohos/hvigor';
import * as path from "path";
import Handlebars from "handlebars";
import {writeFileSync, readFileSync, readdirSync} from "fs"
import * as fs from "fs";
import ts, {isExportAssignment} from "typescript";
import {AnalyzerResult, PageInfo, PluginConfig, RouteInfo, RouteMap, Annotation, RouteMetadata} from "./model";
import {logger ,loggerNode,LogConfig} from "./utils/logger";
import {isEmpty, isNotEmpty} from "./utils/text"
import JSON5 from "json5";


const PLUGIN_ID = "routerRegisterPlugin"
const builderRegisterFunFileName: string = 'builderRegister.ets'
const builderRegisterRelativePath: string = '../builderRegister.txt'
const prefixZR:string  = 'ZR'
const annotation = new Annotation()
// let logEnabled: boolean = false
// let viewNodeInfo: boolean = false


export function routerRegisterPlugin(config: PluginConfig): HvigorPlugin {

    return {
        pluginId: PLUGIN_ID,
        apply(node: HvigorNode) {
            LogConfig.init(config)
            logger('apply', 'hello routerRegisterPlugin!');
            logger('apply', PLUGIN_ID)
            logger('apply', `dirname: ${__dirname} `)
            logger('apply cwd: ', process.cwd()) // 应用项目的根目录
            logger('apply nodeName: ', node.getNodeName()) //模块名 ，比如entry，harA
            logger('apply nodePath: ', node.getNodePath()) //模块路径  这里和nodeDir是一样的
            initConfig(config, node);
            executePlugin(config, node)
        }
    }
}

// function initLogger(config: PluginConfig) {
//     if ('logEnabled' in config) {
//         LogConfig.logEnabled = config.logEnabled
//     }
//     if ('viewNodeInfo' in config) {
//         LogConfig.viewNodeInfo = config.viewNodeInfo
//     }
//
// }

function initConfig(config: PluginConfig, node: HvigorNode) {
    const modDir = node.getNodePath()
    if (!config) {
        config = new PluginConfig()
    }
    if (isEmpty(config.indexDir)) {
        config.indexDir = `${modDir}/`
    }
    if (isEmpty(config.scanDir)) {
        config.scanDir = `${modDir}/src/main/ets/`
    } else {
        config.scanDir = `${modDir}/${config.scanDir}/`
    }
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
    const files = getFilesInDir(config.scanDir)
    const routeMap = new RouteMap()
    const pageList = new Array<PageInfo>()
    files.forEach((filePath) => {
        const fileName = `${prefixZR}${path.basename(filePath)}`
        let analyzer = new Analyzer(filePath)
        analyzer.start()
        analyzer.results.forEach((result) => {
            if (!isEmpty(result.name) && !isEmpty(result.pageName)) {

                // 路由表信息
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
                // Builder函数注册信息
                const pageInfo = new PageInfo()
                pageInfo.buildFileName = fileName
                pageInfo.pageName = result.pageName
                pageInfo.importPath = getImportPath(config.generatedDir, filePath)
                pageInfo.buildFunctionName = routeInfo.buildFunction
                pageInfo.isDefaultExport = result.isDefaultExport
                pageList.push(pageInfo)

            }
        })
        generateRouterRegisterFile(config, pageList)
        pageList.length = 0

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
        logger('deleteGeneratedFiles: ',value.path)
        logger('deleteGeneratedFiles: ',value.parentPath)
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
        if (fs.existsSync(registerBuilderFilePathOld)){
            logger('registerBuilderFilePathOld exists')
            fs.unlinkSync(registerBuilderFilePathOld)
        }

        if (fs.existsSync(registerBuilderFilePath) && pageList.length <= 0) {
            fs.unlinkSync(registerBuilderFilePath)
            return
        }

        // 模板路径是在离线包内的，因此路径也是相对离线包而言的
        const templatePath = path.resolve(__dirname, builderRegisterRelativePath);
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


class Analyzer {
    //扫描到的ets文件路径
    private readonly filePath: string = ""
    results: Array<AnalyzerResult> = []
    result: AnalyzerResult = new AnalyzerResult()


    constructor(filePath: string) {
        this.filePath = filePath;
    }

    start() {
        logger('Analyzer filePath: ', this.filePath)
        // 读取文件内容
        const sourceCode = readFileSync(this.filePath, "utf-8");
        loggerNode('Analyzer sourceCode: ', sourceCode)
        // 解析文件内容，生成节点树信息
        const sourceFile = ts.createSourceFile(this.filePath, sourceCode, ts.ScriptTarget.ES2021, false);
        // logger('Analyzer sourceFile: ', sourceFile)
        // 遍历节点信息
        ts.forEachChild(sourceFile, (node: ts.Node) => {
            // 解析节点
            try {
                this.resolveNode(node);
            } catch (e) {
                console.error('forEachChild error: ', e);
            }

        });

    }

    private resolveNode(node: ts.Node) {
        logger('resolveNode: ', node.kind, ' ---start')
        loggerNode('resolveNode node: ', node)
        let isDefault = false
        switch (node.kind) {
            // import
            case ts.SyntaxKind.ImportDeclaration:
                this.resolveImportDeclaration(node as ts.ImportDeclaration)
                break
            // 装饰器节点
            case ts.SyntaxKind.ExportAssignment:
            case ts.SyntaxKind.MissingDeclaration:
                if (node.kind === ts.SyntaxKind.ExportAssignment) {
                    isDefault = true
                }
                logger("resolveNode progress....", node.kind)
                const child = node as ts.ParameterDeclaration
                const modifiers = child.modifiers
                loggerNode('resolveNode modifiers: ', modifiers)
                // @Component  + @Route
                if (modifiers && modifiers.length >= 2) {
                    modifiers.forEach((item) => {
                        try {
                            this.resolveDecoration(item, isDefault);
                        } catch (e) {
                            console.error('resolveNode error: ', e)
                        }

                    })
                }
                break;
            // 表达式节点 结构体内容
            case ts.SyntaxKind.ExpressionStatement:
                this.resolveExpression(node);
                break;
            default:
                break
        }
        if (isNotEmpty(this.result.pageName) && this.isExistAnnotation()) {
            const item = this.results.find((item) => item.name === this.result.name)
            if (!item) {
                let r = JSON.parse(JSON.stringify(this.result))
                this.results.push(r)
                this.result.reset()
                logger('analyzerResult: ', JSON.stringify(r), JSON.stringify(this.result))
                // logger('results: ', JSON.stringify(this.results))
            }

        }
        logger('resolveNode: ', node.kind, ' ---end')
    }

    // 解析导出体
    private resolveImportDeclaration(node: ts.ImportDeclaration) {
        node.importClause?.namedBindings?.forEachChild(child => {
            if (ts.isImportSpecifier(child)) {

            }
        });
    }


    // 解析结构体
    private resolveExpression(node: ts.Node) {
        let args = node as ts.ExpressionStatement;
        logger('resolveExpression identifier: ', args)
        if (args.expression?.kind == ts.SyntaxKind.Identifier) {
            const identifier = args.expression as ts.Identifier;
            logger('resolveExpression: ', identifier.escapedText)
            if (identifier.escapedText !== 'struct' && this.isExistAnnotation()) {
                this.result.pageName = identifier.escapedText.toString()
            }
        }
    }

    private isExistAnnotation(): boolean {
        return isNotEmpty(this.result.name)
    }


    // 解析装饰器
    private resolveDecoration(node: ts.Node, isDefaultExport: boolean = false) {
        // 转换为装饰器节点类型
        let decorator = node as ts.Decorator;
        logger('resolveDecoration kind: ' + decorator?.kind)
        // 判断表达式是否是函数调用
        if (decorator.expression?.kind === ts.SyntaxKind.CallExpression) {
            const callExpression = decorator.expression as ts.CallExpression;
            // 表达式类型是否是标识符
            if (callExpression.expression?.kind === ts.SyntaxKind.Identifier) {
                const identifier = callExpression.expression as ts.Identifier;
                // 标识符是否是自定义的装饰器
                logger(`resolveDecoration text: ${identifier.text}`)
                const args = callExpression.arguments
                if (identifier.text === annotation.annotationName && args && args.length > 0) {
                    const arg = args[0];
                    this.result = new AnalyzerResult()
                    this.result.isDefaultExport = isDefaultExport
                    loggerNode(`resolveDecoration arg: `, JSON.stringify(arg))
                    // 调用方法的第一个参数是否是表达式
                    if (arg?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                        const properties = (arg as ts.ObjectLiteralExpression).properties;
                        logger(`resolveDecoration properties length: ${properties.length}`)
                        // 遍历装饰器中的所有参数
                        properties?.forEach((propertie) => {
                            loggerNode(`resolveDecoration properties item: `, JSON.stringify(propertie))
                            if (propertie?.kind === ts.SyntaxKind.PropertyAssignment) {
                                // 参数是否是自定义装饰器中的变量名
                                if ((propertie.name as ts.Identifier).escapedText === annotation.name) {
                                    // 将装饰器中的变量的值赋值给解析结果中的变量
                                    this.result.name = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.description) {
                                    this.result.description = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.extra) {
                                    this.result.extra = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.needLogin) {
                                    const kind = propertie.initializer.kind
                                    if (kind && kind === ts.SyntaxKind.FalseKeyword) {
                                        this.result.needLogin = false
                                    } else if (kind && kind === ts.SyntaxKind.TrueKeyword) {
                                        this.result.needLogin = true
                                    }
                                }
                            }
                        })


                    }
                }
            }
        }

        // logger('resolveDecoration end')
    }


}

// function loggerNode(...args: any[]) {
//     try {
//         if (viewNodeInfo) logger(...args)
//     } catch (e) {
//
//     }
//
// }
//
// function logger(...args: any[]) {
//     if (logEnabled) console.log('logger-> ', ...args)
// }

// function isEmpty(obj: string | undefined | null) {
//     return obj === undefined || obj === null || obj.trim().length === 0
// }
//
// function isNotEmpty(obj: string | null | undefined) {
//     return !isEmpty(obj)
// }



