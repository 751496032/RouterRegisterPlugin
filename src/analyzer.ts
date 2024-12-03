import {AnalyzerParam, AnalyzerResult, Annotation, AnnotationType, RouterParamWrap} from "./models/model";
import {logger, loggerE, loggerNode} from "./utils/logger";
import {readFileSync} from "fs";
import ts, {
    isDecorator,
    isExportSpecifier,
    isIdentifier,
    isImportSpecifier,
    isNamespaceImport,
    isPropertyAccessExpression, isPropertyDeclaration,
    isStringLiteral, PropertyAccessExpression
} from "typescript";
import {isEmpty, isNotEmpty} from "./utils/string";
import * as path from "node:path";
import * as fs from "node:fs";
import JSON5 from "json5";
import Constants from "./models/constants";
import FileHelper from "./utils/fileHelper";

const annotation = new Annotation()

/**
 * 扫描一个ets文件，获取路由相关信息
 */
class Analyzer {
    // 扫描的ets文件路径
    private readonly filePath: string = ""
    // 一个文件可能存在多个组件
    results: Array<AnalyzerResult> = []
    result: AnalyzerResult = new AnalyzerResult()
    // 导入的所有文件
    importedFiles: Map<string[], string> = new Map<string[], string>()
    // 模块名称
    modName: string = ""
    // 路由上常量的相关参数
    routerParamWrap?: RouterParamWrap | undefined
    // 模块的绝对路径
    modDir: string = ""


    constructor(analyzerParam: AnalyzerParam, wrap?: RouterParamWrap) {
        this.filePath = analyzerParam.scanFilePath;
        this.modName = analyzerParam.modName
        this.modDir = analyzerParam.modDir
        this.routerParamWrap = wrap
    }

    start() {
        logger('Analyzer start', this.modName, this.routerParamWrap)
        logger('Analyzer filePath: ', this.filePath)
        // 读取文件内容
        const sourceCode = readFileSync(this.filePath, "utf-8");
        // loggerNode('Analyzer sourceCode: ', sourceCode)
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
            // class
            case ts.SyntaxKind.ClassDeclaration:
                this.resolveClassDeclaration(node as ts.ClassDeclaration)
                break
            // export
            case ts.SyntaxKind.ExportDeclaration:
                this.resolveExportDeclaration(node as ts.ExportDeclaration)
                break
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
                // loggerNode('resolveNode modifiers: ', modifiers)
                // @Component  + @Route
                if (modifiers && modifiers.length >= 2) {
                    modifiers.forEach((item) => {
                        try {
                            const result = this.resolveDecoration(item, isDefault);
                            logger("modifier result: ", result)
                            if (isNotEmpty(result.name)) this.result = result

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
        if (this.isNormalPage()) {
            const item = this.results.find((item) => item.name === this.result.name)
            if (!item) {
                let r = JSON.parse(JSON.stringify(this.result))
                this.results.push(r)
                this.result.reset()
                logger('resolveNode AnalyzerResult: ', JSON.stringify(r), JSON.stringify(this.result))
                // logger('results: ', JSON.stringify(this.results))
            }

        }
        logger('resolveNode: ', node.kind, ' ---end')
    }

    // 解析class
    private resolveClassDeclaration(node: ts.ClassDeclaration) {
        const absPath = this.routerParamWrap?.absolutePath
        logger("resolveClassDeclaration result: ",  this.result)
        logger("resolveClassDeclaration absolutePath: ", absPath)
        if (isEmpty(this.result.name) && isEmpty(absPath)) {
           // 解析服务路由
            logger("解析服务注解 start: " , node.kind)
            node.modifiers?.forEach((item) => {
                if (isDecorator(item)){
                    const result = this.resolveDecoration(item)
                    if (isNotEmpty(result.name)) this.result = result
                }
            })
            if (this.result.currentAnnotation == AnnotationType.SERVICE && node.name){
               if (isIdentifier(node.name)){
                   this.result.pageName = node.name.escapedText!!
               }
            }
            logger("解析服务注解 end: " , this.result)
            return;
        }

        if (isEmpty(absPath) || !node.name || !isIdentifier(node.name)) return
        if (node.name.escapedText == this.routerParamWrap?.className) {
            node?.members?.forEach((member) => {
                if (isPropertyDeclaration(member) && member.name
                    && isIdentifier(member.name)) {
                    if (this.routerParamWrap?.actionType == Constants.TYPE_FIND_ROUTE_CONSTANT_VALUE){
                        if (member.name.escapedText
                            == this.routerParamWrap?.attrName && member.initializer && isStringLiteral(member.initializer)) {
                            this.routerParamWrap.attrValue = member.initializer.text
                        }
                    }
                }
            })
        }

        logger("resolveClassDeclaration: ", this.routerParamWrap)


    }

    // 解析Export
    private resolveExportDeclaration(node: ts.ExportDeclaration) {
        if (!this.routerParamWrap) return
        let importPath = ""
        const map = new Map<string, string[]>()
        const names: string[] = []
        if (node.exportClause === undefined && node.moduleSpecifier) {
            // export * from '../xxx'
            // 不支持使用这种方式导出路由常量
            if (isStringLiteral(node.moduleSpecifier)) {
                let path = node.moduleSpecifier.text
                names.push("*")
                map.set(path, names)
            }
        } else {
            node.exportClause?.forEachChild((child: ts.Node) => {
                if (isExportSpecifier(child)) {
                    if (isIdentifier(child.name)) {
                        names.push(child.name.escapedText ?? "")
                    }
                }
            })
            if (node.moduleSpecifier && isStringLiteral(node.moduleSpecifier)) {
                let path = node.moduleSpecifier.text
                if (names.length > 0) map.set(path, names)
            }
        }
        const mapArr = [...map]
        mapArr.forEach(([key, value]) => {
            const has = value.includes(this.routerParamWrap?.className || "")
            if (has) {
                importPath = key
            }
        })
        logger('resolveExportDeclaration importPath: ', importPath)
        if (isNotEmpty(importPath)) {
            if (this.routerParamWrap.actionType == Constants.TYPE_FIND_MODULE_INDEX_PATH) {
                logger('resolveExportDeclaration current modDir: ', this.modDir)
                logger("resolveExportDeclaration routerParamWrap: ", this.routerParamWrap)
                this.routerParamWrap.absolutePath =
                    path.resolve(this.modDir, this.routerParamWrap.moduleSrcPath ||
                        this.routerParamWrap.indexModuleName, importPath)
            }

        }


    }

    // 解析import导入的信息
    private resolveImportDeclaration(node: ts.ImportDeclaration) {
        const key: string[] = []
        if (node.importClause?.namedBindings == undefined && node.importClause?.name != undefined) {
            // import MyModule from './MyModule';
            if (isIdentifier(node.importClause.name)) {
                key.push(node.importClause.name.escapedText ?? "")
            }
        } else {
            node.importClause?.namedBindings?.forEachChild(child => {
                if (isImportSpecifier(child)) {
                    // import { ExportedItem1, ExportedItem2 } from './MyModule';
                    // import { ExportedItem as RenamedItem } from './MyModule';
                    if (isIdentifier(child.name)) {
                        key.push(child.name.escapedText ?? "")
                    }
                } else if (isNamespaceImport(child)) {
                    // import * as MyModule from './MyModule';
                    const node = child as ts.NamespaceImport
                    if (isIdentifier(node.name)) {
                        key.push(node.name.escapedText ?? "")
                    }
                }

            });
        }
        logger("resolveImportDeclaration moduleSpecifier: ", node.moduleSpecifier.kind, key)
        if (isStringLiteral(node.moduleSpecifier)) {
            if (key.length > 0) {
                this.importedFiles.set(key, node.moduleSpecifier.text)
            }
        }
        const mapArr = [...this.importedFiles]
        mapArr.forEach(([k, v]) => {
            logger(`resolveImportDeclaration importedFiles k-v: ${k} : ${v}`)
        })

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

    private isNormalPage() {
        return isNotEmpty(this.result.pageName) && this.isExistAnnotation()
    }


    // 解析装饰器
    private resolveDecoration(node: ts.Node, isDefaultExport: boolean = false, from?: number) {
        const result = new AnalyzerResult()
        // 转换为装饰器节点类型
        let decorator = node as ts.Decorator;
        logger('resolveDecoration kind: ' + decorator?.kind, from)
        // 判断表达式是否是函数调用
        if (decorator.expression?.kind === ts.SyntaxKind.CallExpression) {
            const callExpression = decorator.expression as ts.CallExpression;
            // 表达式类型是否是标识符
            if (callExpression.expression?.kind === ts.SyntaxKind.Identifier) {
                const identifier = callExpression.expression as ts.Identifier;
                // 标识符是否是自定义的装饰器
                logger(`resolveDecoration text: ${identifier.text}  ${identifier.escapedText}`)
                const args = callExpression.arguments
                if (annotation.annotationNames.includes(identifier.text) && args && args.length > 0) {
                    const arg = args[0];
                    // this.result = new AnalyzerResult()
                    result.isDefaultExport = isDefaultExport
                    result.currentAnnotation = identifier.text == AnnotationType.ROUTE ? AnnotationType.ROUTE : AnnotationType.SERVICE
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
                                    if (isStringLiteral(propertie.initializer)) {
                                        // 装饰器上的值是字符串
                                        result.name = (propertie.initializer as ts.StringLiteral).text;
                                    }
                                    if (isPropertyAccessExpression(propertie.initializer)) {
                                        // 装饰器上的常量
                                        this.resolveConstantOnAnnotations(propertie.initializer, result)
                                    }

                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.description) {
                                    result.description = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.extra) {
                                    result.extra = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if ((propertie.name as ts.Identifier).escapedText === annotation.needLogin) {
                                    const kind = propertie.initializer.kind
                                    if (kind && kind === ts.SyntaxKind.FalseKeyword) {
                                       result.needLogin = false
                                    } else if (kind && kind === ts.SyntaxKind.TrueKeyword) {
                                        result.needLogin = true
                                    }
                                }
                            }
                        })


                    }
                }
            }
        }
        return result
        // logger('resolveDecoration end')
    }


    private resolveConstantOnAnnotations(initializer: PropertyAccessExpression, result: AnalyzerResult) {
        // 装饰器上的值是常量
        const routerParam = new RouterParamWrap()
        if (isIdentifier(initializer.expression)) {
            routerParam.className = initializer.expression.escapedText ?? ""
        }
        if (isIdentifier(initializer.name)) {
            routerParam.attrName = initializer.name.escapedText ?? ""
        }
        this.importedFiles.forEach((value, key) => {
            const target = key.find((item) => item == routerParam.className)
            if (isNotEmpty(target)) {
                routerParam.importPath = value
                routerParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(value,
                    AnalyzerParam.create(this.filePath, this.modName, this.modDir), routerParam) + Constants.ETS_SUFFIX
            }
        })
        if (isNotEmpty(routerParam.absolutePath) && fs.existsSync(routerParam.absolutePath)) {
            routerParam.actionType = Constants.TYPE_FIND_ROUTE_CONSTANT_VALUE
            let analyzer = new Analyzer(AnalyzerParam.create(routerParam.absolutePath, this.modName, this.modDir), routerParam)
            analyzer.start()
           result.name = analyzer?.routerParamWrap?.attrValue || ""
        } else {
            loggerE("路径不存在：", routerParam.absolutePath)
        }
        logger("路由常量解析结果: ", JSON.stringify(routerParam))
        if (isEmpty(result.name)) {
            loggerE("路由名称查询失败：", routerParam.className, routerParam.attrName)
        }

    }


}

export {Analyzer}