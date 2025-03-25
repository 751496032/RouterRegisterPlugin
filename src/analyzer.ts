import {AnalyzerParam, AnalyzerResult, Annotation, AnnotationType, ScanFileParam} from "./models/model";
import {logger, loggerE, loggerNode} from "./utils/logger";
import {readFileSync} from "fs";
import ts, {
    isClassDeclaration,
    isDecorator,
    isExportSpecifier,
    isIdentifier,
    isImportSpecifier,
    isNamespaceImport,
    isPropertyAccessExpression, isPropertyDeclaration,
    isStringLiteral, PropertyAccessExpression
} from "ohos-typescript";
import {isEmpty, isNotEmpty} from "./utils/string";
import * as path from "node:path";
import * as fs from "node:fs";
import Constants from "./models/constants";
import FileHelper from "./utils/fileHelper";
import AnnotationMgr from "./utils/annotation-mgr";
import NodeHelper from "./utils/nodes";

type TempAnalyzerResult = Omit<AnalyzerResult, 'name'> & { name: keyof any }

const annotation = new Annotation()
const IDENTIFIER_AS_ANNOTATION = Symbol('IDENTIFIER_AS_ANNOTATION')

/**
 * 扫描一个ets文件，获取路由相关信息
 */
class Analyzer {
    // 扫描的ets文件路径
    private readonly filePath: string = ""
    // 一个文件可能存在多个组件
    results: Array<AnalyzerResult> = []
    result: TempAnalyzerResult = new AnalyzerResult()
    // 导入的所有文件
    importedFiles: Map<string[], string> = new Map<string[], string>()
    // 模块名称
    modName: string = ""
    // 路由上常量的相关参数
    fileParam?: ScanFileParam | undefined
    // 模块的绝对路径
    modDir: string = ""


    constructor(analyzerParam: AnalyzerParam, fileParam?: ScanFileParam) {
        this.filePath = analyzerParam.scanFilePath;
        this.modName = analyzerParam.modName
        this.modDir = analyzerParam.modDir
        this.fileParam = fileParam
    }

    start() {
        logger('Analyzer start', this.modName, this.fileParam)
        logger('Analyzer filePath: ', this.filePath)
        // 读取文件内容
        const sourceCode = readFileSync(this.filePath, "utf-8");
        // loggerNode('Analyzer sourceCode: ', sourceCode)
        // 解析文件内容，生成节点树信息
        const sourceFile = ts.createSourceFile(this.filePath, sourceCode, ts.ScriptTarget.ES2021, false, ts.ScriptKind.ETS);
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
            case ts.SyntaxKind.StructDeclaration:
                this.resolveStructDeclaration(node as ts.StructDeclaration)
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
                            if (result.annotation !== AnnotationType.UNKNOWN) {
                                this.result = result
                            }

                        } catch (e) {
                            console.error('resolveNode error: ', e)
                        }

                    })
                }
                break;
            default:
                break
        }
        if (this.isNormalPage()) {
            const item = this.results.find((item) => item.name === this.result.name)
            if (!item) {
                let r: AnalyzerResult = JSON.parse(JSON.stringify(this.result))
                if (this.result.name === IDENTIFIER_AS_ANNOTATION) {
                    r.name = r.pageName
                }
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
        const absPath = this.fileParam?.absolutePath
        logger("resolveClassDeclaration result: ",  this.result)
        logger("resolveClassDeclaration absolutePath: ", absPath)
        if (isEmpty(this.result.name) && isEmpty(absPath)) {

            node.modifiers?.forEach((item) => {
                if (isDecorator(item)){
                    const result = this.resolveDecoration(item)
                    if (isNotEmpty(result.name)) this.result = result
                }
            })
            if (AnnotationMgr.isServiceAnnotation(this.result.annotation)){
                // 解析服务路由注解
                this.result.pageName = NodeHelper.getClassName(node)
                logger("解析服务路由注解结果: " , this.result)
            }
            if (AnnotationMgr.isLifecycleAnnotation(this.result.annotation)){
                // 解析生命周期注解
                this.result.pageName = NodeHelper.getClassName(node)
                logger("解析生命周期路由注解结果: " , this.result)
            }

            if (AnnotationMgr.isAttrAnnotation(this.result.annotation)){
                // 解析属性注解
                this.result.pageName = NodeHelper.getClassName(node)
                logger("解析属性注解结果: ", this.result)
            }

            return;
        }

        if (isEmpty(absPath) || !node.name || !isIdentifier(node.name)) return
        if (this.fileParam && node.name.escapedText == this.fileParam?.className) {
            node?.members?.forEach((member) => {
                if (isPropertyDeclaration(member) && member.name
                    && isIdentifier(member.name)) {
                    if (this.fileParam?.isFindAnnotationConst()){
                        if (member.name.escapedText
                            == this.fileParam?.attrName && member.initializer && isStringLiteral(member.initializer)) {
                            this.fileParam.attrValue = member.initializer.text
                        }
                    }
                }
            })
        }

        logger("resolveClassDeclaration: ", this.fileParam)

    }

    private resolveStructDeclaration(node: ts.StructDeclaration) {
        const absPath = this.fileParam?.absolutePath
        logger("resolveStructDeclaration result: ",  this.result)
        logger("resolveStructDeclaration absolutePath: ", absPath)
        if (isEmpty(this.result.name) && isEmpty(absPath)) {

            node.modifiers?.forEach((item) => {
                if (isDecorator(item)){
                    const result = this.resolveDecoration(item)
                    if (isNotEmpty(result.name)) this.result = result
                }
                if (item.kind === ts.SyntaxKind.DefaultKeyword) {
                    this.result.isDefaultExport = true
                }
            })
            if (AnnotationMgr.isRouteAnnotation(this.result.annotation)){
                // 解析路由注解
                this.result.pageName = NodeHelper.getClassName(node)
                logger("解析路由注解结果: " , this.result)
            }
        }
    }

    // 解析Export
    private resolveExportDeclaration(node: ts.ExportDeclaration) {
        if (!this.fileParam) return
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
            const has = value.includes(this.fileParam?.className || "")
            if (has) {
                importPath = key
            }
        })
        logger('resolveExportDeclaration importPath: ', importPath)
        if (isNotEmpty(importPath)) {
            if (this.fileParam.isFindModuleIndexPath()) {
                logger('resolveExportDeclaration current modDir: ', this.modDir)
                logger("resolveExportDeclaration fileParam: ", this.fileParam)
                this.fileParam.absolutePath =
                    path.resolve(this.modDir, this.fileParam.moduleSrcPath ||
                        this.fileParam.indexModuleName, importPath)
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

    private isExistAnnotation(): boolean {
        return isNotEmpty(this.result.name)
    }

    private isNormalPage() {
        return isNotEmpty(this.result.pageName) && this.isExistAnnotation()
    }


    // 解析装饰器
    private resolveDecoration(node: ts.Node, isDefaultExport: boolean = false, from?: number) {
        const result: TempAnalyzerResult = new AnalyzerResult()
        // 转换为装饰器节点类型
        let decorator = node as ts.Decorator;
        logger('resolveDecoration kind: ' + decorator?.kind, from)
        loggerNode(`resolveDecoration Decorator: `, JSON.stringify(decorator))
        logger(JSON.stringify(result))
        // 判断表达式是否是标识符
        if (decorator.expression && ts.isIdentifier(decorator.expression)) {
            const identifier = decorator.expression
            if (annotation.annotations.includes(identifier.text)) {
                logger(`resolveDecoration text: ${identifier.text}  ${identifier.escapedText}`)
                result.isDefaultExport = isDefaultExport
                result.annotation = AnnotationMgr.getAnnotation(identifier.text)
                result.name = IDENTIFIER_AS_ANNOTATION
            }
        }
        // 判断表达式是否是函数调用
        if (decorator.expression?.kind === ts.SyntaxKind.CallExpression) {
            const callExpression = decorator.expression as ts.CallExpression;
            // 表达式类型是否是标识符
            if (callExpression.expression?.kind === ts.SyntaxKind.Identifier) {
                const identifier = callExpression.expression as ts.Identifier;
                // 标识符是否是自定义的装饰器
                logger(`resolveDecoration text: ${identifier.text}  ${identifier.escapedText}`)
                const args = callExpression.arguments
                if (annotation.annotations.includes(identifier.text) && args) {
                    const arg = args[0];
                    result.isDefaultExport = isDefaultExport
                    result.annotation = AnnotationMgr.getAnnotation(identifier.text)
                    result.name = IDENTIFIER_AS_ANNOTATION
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
                                const text = (propertie.name as ts.Identifier).escapedText
                                if (text === annotation.name) {
                                    // 将装饰器中的变量的值赋值给解析结果中的变量
                                    if (isStringLiteral(propertie.initializer)) {
                                        // 装饰器上的值是字符串
                                        result.name = (propertie.initializer as ts.StringLiteral).text;
                                    }
                                    if (isPropertyAccessExpression(propertie.initializer)) {
                                        // 装饰器上的常量
                                        result.name = this.resolveConstantOnAnnotations(propertie.initializer)
                                    }

                                }

                                if (text === annotation.description) {
                                    result.description = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if (text === annotation.extra) {
                                    result.extra = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if (text === annotation.needLogin) {
                                    result.needLogin = NodeHelper.getBooleanByKind(propertie.initializer.kind)
                                }
                                if (text === annotation.useTemplate) {
                                    result.useTemplate = NodeHelper.getBooleanByKind(propertie.initializer.kind)
                                }
                                if (text === annotation.title) {
                                    result.title = (propertie.initializer as ts.StringLiteral).text;
                                }
                                if (text === annotation.useV2) {
                                    result.useV2 = NodeHelper.getBooleanByKind(propertie.initializer.kind)
                                }
                                if (text === annotation.hideTitleBar){
                                    result.hideTitleBar = NodeHelper.getBooleanByKind(propertie.initializer.kind)
                                }
                                if (text === annotation.lifecycleObserverAttributeName){
                                    result.loAttributeName = (propertie.initializer as ts.StringLiteral).text;
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


    private resolveConstantOnAnnotations(initializer: PropertyAccessExpression) {
        // 装饰器上的值是常量
        const fileParam = new ScanFileParam()
        let constValue = ""
        if (isIdentifier(initializer.expression)) {
            fileParam.className = initializer.expression.escapedText ?? ""
        }
        if (isIdentifier(initializer.name)) {
            fileParam.attrName = initializer.name.escapedText ?? ""
        }
        this.importedFiles.forEach((value, key) => {
            const target = key.find((item) => item == fileParam.className)
            if (isNotEmpty(target)) {
                fileParam.importPath = value
                fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(value,
                    AnalyzerParam.create(this.filePath, this.modName, this.modDir), fileParam) + Constants.ETS_SUFFIX
            }
        })
        if (isNotEmpty(fileParam.absolutePath) && fs.existsSync(fileParam.absolutePath)) {
            fileParam.actionType = Constants.TYPE_FIND_ANNOTATION_CONST_VALUE
            let analyzer = new Analyzer(AnalyzerParam.create(fileParam.absolutePath, this.modName, this.modDir), fileParam)
            analyzer.start()
            constValue = analyzer?.fileParam?.attrValue || ""
        } else {
            loggerE("路径不存在：", fileParam.absolutePath)
        }
        logger("常量解析结果: ", JSON.stringify(fileParam))
        if (isEmpty(constValue)) {
            loggerE("常量解析失败：", fileParam.className, fileParam.attrName)
        }

        return constValue

    }


}

export {Analyzer}
