
/**
 * @author: HZWei
 * @date: 2024/7/16
 * @desc:
 */
import { HvigorNode, HvigorPlugin } from '@ohos/hvigor';
import * as path from "path";
import Handlebars from "handlebars";
import {writeFileSync, readFileSync, readdirSync} from "fs"
import * as fs from "fs";
import ts from "typescript";
import {AnalyzerResult, PageInfo, PluginConfig, RouteInfo, RouteMap, Annotation, RouteData} from "./model";
import JSON5 from "json5";


const PLUGIN_ID = "routerRegisterPlugin"
const builderRegisterFunFileName: string = 'builderRegister.ets'
const builderRegisterRelativePath: string = '../builderRegister.txt'
const annotation = new Annotation()
let logEnabled: boolean = false
let viewNodeInfo: boolean = false


export function routerRegisterPlugin(config: PluginConfig): HvigorPlugin {

    return {
        pluginId: PLUGIN_ID,
        apply(node: HvigorNode) {
            initLogger(config)
            logger('apply','hello routerRegisterPlugin!');
            logger('apply', PLUGIN_ID)
            logger('apply', `dirname: ${__dirname} `)
            logger('apply cwd: ',process.cwd()) // 应用项目的根目录
            logger('apply nodeName: ', node.getNodeName()) //模块名 ，比如entry，harA
            logger('apply nodePath: ', node.getNodePath()) //模块路径  这里和nodeDir是一样的
            initConfig(config, node);
            executePlugin(config, node)
        }
    }
}

function initLogger(config: PluginConfig) {
    if ('logEnabled' in config) {
        logEnabled = config.logEnabled
    }
    if ('viewNodeInfo' in config) {
        viewNodeInfo = config.viewNodeInfo
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
    const files  = getFilesInDir(config.scanDir)
    const routeMap = new RouteMap()
    const pageList = new Array<PageInfo>()
    files.forEach((filePath) => {

        let analyzer = new Analyzer(filePath)
        analyzer.start()
        analyzer.results.forEach((result)=>{
            if (!isEmpty(result.name) && !isEmpty(result.pageName)){
                // 路由表信息
                const routeInfo = new RouteInfo()
                routeInfo.name = result.name
                routeInfo.buildFunction = `${modName}${result.pageName}Builder`
                routeInfo.pageSourceFile = getRelativeModPath(getBuilderRegisterEtsAbsolutePath(config), modDir)
                const routeData = new RouteData()
                routeData.description = result.description
                routeData.needLogin = `${result.needLogin}`
                routeData.extra = result.extra

                if (isEmpty(routeData.description)){
                    delete routeData.description
                }
                if (isEmpty(routeData.extra)){
                    delete routeData.extra
                }
                // if (!analyzer.result.needLogin){
                //     delete routeData.needLogin
                // }
                routeInfo.data = routeData
                routeMap.routerMap.push(routeInfo)
                // Builder函数注册信息
                const pageInfo = new PageInfo()
                pageInfo.pageName = result.pageName
                pageInfo.importPath = getImportPath(config.generatedDir, filePath)
                pageInfo.buildFunctionName = routeInfo.buildFunction
                pageList.push(pageInfo)

            }
        })


    })
    try {
        generateBuilderRegister(config, pageList)
        generateRouterMap(config, routeMap)
        generateIndex(config)
        checkIfModuleRouterMapConfig(config)
    }catch (e) {
        console.error('executePlugin error: ', e)
    }

}

/**
 * 返回的格式：src/main/ets/....
 * @param fullPath
 * @param modDir
 */
function getRelativeModPath(fullPath: string, modDir: string): string {
    const relativePath = fullPath.replace(modDir, '')
    logger('===========================================')
    logger('fullPath: ',fullPath)
    logger('relativePath: ',relativePath)
    logger('===========================================')
    return relativePath.substring(1).replace(/\\/g, '/')
}

function getImportPath(from: string, to: string): string {
    let importPath = path.relative(from, to).replace(/\\/g, '/')
    logger('===========================================')
    logger('from: ',from)
    logger('to: ',to)
    logger('importPath: ',importPath)
    logger('===========================================')
    return importPath.replace('.ets', '')
}




function generateBuilderRegister(config: PluginConfig, pageList: PageInfo[]) {
    const fileName = builderRegisterFunFileName
    // 模板路径是在离线包内的，因此路径也是相对离线包而言的
    const templatePath = path.resolve(__dirname, builderRegisterRelativePath);
    const generatedDir = config.generatedDir
   logger('generateBuilderRegister template path: ',templatePath)
    const source = fs.readFileSync(templatePath, 'utf8')
    const template = Handlebars.compile(source)
    const content = {pageList: pageList}
    const ts = template(content)
    loggerNode(ts)
    if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, {recursive: true});
    }
    writeFileSync(`${generatedDir}${fileName}`, ts)

}

function generateRouterMap(config: PluginConfig, routeMap: RouteMap) {
    logger('generateRouterMap: ', JSON.stringify(routeMap))
    writeFileSync(config.routerMapPath, JSON.stringify(routeMap, null, 2), {encoding: "utf8"})

}

function getBuilderRegisterEtsAbsolutePath(config: PluginConfig): string {
    return path.join(config.generatedDir, builderRegisterFunFileName)
}


function generateIndex(config: PluginConfig) {
    logger('generateIndex')
    const indexPath = `${config.indexDir}/Index.ets`
    const importPath = getImportPath(config.indexDir, getBuilderRegisterEtsAbsolutePath(config))
    const data: string = `export * from './${importPath}'`
    if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, data)
        return
    }
    const content = fs.readFileSync(indexPath, {encoding: "utf8"})
    const lines = content.split('\n')
    const target = lines.find((item) => item === data)
    if (!target) {
        lines.push(data)
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



function getFilesInDir(dirPath: string) {
    let files = new Array<string>()
    function find(currentDir:string){
        const contents = readdirSync(currentDir, {withFileTypes: true})
        contents.forEach((value, index) => {
            // 文件目录路径 + 文件名称  = 文件路径
            const filePath = path.join(currentDir, value.name)
            if (value.isDirectory()) {
                find(filePath)
            } else if (value.isFile()) {
                files.push(filePath)
            }
        })
    }
    find(dirPath)
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
            }catch (e) {
                console.error('forEachChild error: ', e);
            }

        });

    }

    private resolveNode(node: ts.Node) {
        logger('resolveNode: ', node.kind , ' ---start')
        loggerNode('resolveNode node: ', node)
        switch (node.kind) {
            // 未知节点和装饰器节点
            case ts.SyntaxKind.MissingDeclaration || ts.SyntaxKind.Decorator:
                const child = node as ts.ParameterDeclaration
                const modifiers = child.modifiers
                // @Component  + @Route
                if (modifiers && modifiers.length >= 2){
                    modifiers.forEach((item)=>{
                        try {
                            this.resolveDecoration(item);
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
        if (!isEmpty(this.result.pageName) && !isEmpty(this.result.name)){
            const item = this.results.find((item) => item.name === this.result.name)
            if (!item) {
                this.results.push(this.result)
                logger('analyzerResult: ', JSON.stringify(this.result))
                // logger('results: ', JSON.stringify(this.results))
            }

        }


        logger('resolveNode: ', node.kind , ' ---end')
    }


    // 解析结构体
    private resolveExpression(node: ts.Node) {
        let args = node as ts.ExpressionStatement;
        logger('resolveExpression identifier: ', JSON.stringify(args))
        if (args.expression?.kind == ts.SyntaxKind.Identifier){
            const identifier = args.expression as ts.Identifier;
            logger('resolveExpression: ', identifier.escapedText)
            if (identifier.escapedText !== 'struct') {
                this.result.pageName = identifier.escapedText.toString()
            }
        }
    }


    // 解析装饰器
    private resolveDecoration(node: ts.Node) {
        // 转换为装饰器节点类型
        let decorator = node as ts.Decorator;
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
                    loggerNode(`resolveDecoration arg: `,JSON.stringify(arg))
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
                                if ((propertie.name as ts.Identifier).escapedText === annotation.extra){
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

function loggerNode(...args: any[]){
    if (viewNodeInfo) logger(args)
}

function logger(...args: any[]) {
    if (logEnabled) console.log('logger-> ', ...args)
}

function isEmpty(obj: string) {
    return !obj || obj.trim().length === 0
}



