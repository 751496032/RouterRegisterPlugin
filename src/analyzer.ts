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
    isStringLiteral, PropertyAccessExpression,
    isBinaryExpression,
    isTemplateExpression
} from "ohos-typescript";
import {isEmpty, isNotEmpty} from "./utils/string";
import * as path from "node:path";
import * as fs from "node:fs";
import Constants from "./models/constants";
import FileHelper from "./utils/file-helper";
import AnnotationMgr from "./utils/annotation-mgr";
import NodeHelper from "./utils/ats-node";

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
            // namespace
            case ts.SyntaxKind.ModuleDeclaration:
                this.resolveModuleDeclaration(node as ts.ModuleDeclaration)
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
                        if (member.name.escapedText == this.fileParam?.attrName && member.initializer) {
                            if (isStringLiteral(member.initializer)) {
                                this.fileParam.attrValue = member.initializer.text
                            } else if (isBinaryExpression(member.initializer)) {
                                logger("resolveClassDeclaration 处理二元表达式，如字符串拼接: ")
                                this.fileParam.attrValue = this.resolveBinaryExpression(member.initializer as ts.BinaryExpression);
                            }
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

    /**
     * 解析模块声明，处理命名空间（namespace）中的常量值
     * 特别支持嵌套命名空间的解析
     */
    private resolveModuleDeclaration(node: ts.ModuleDeclaration) {
        this.logNode(node);
        if (!node.name || !this.fileParam) return;
        let moduleName
        if (isIdentifier(node.name)) {
            moduleName = node.name.escapedText
        }
        if (isStringLiteral(node.name)) {
            moduleName = node.name.text
        }

        // 获取模块名称
        logger(`resolveModuleDeclaration: 模块名称 ${moduleName}`);

        // 检查是否是在查找常量值
        if (!this.fileParam.isFindAnnotationConst()) {
            logger('resolveModuleDeclaration: 不需要查找常量值，跳过处理');
            return;
        }

        // 构建当前命名空间路径
        let currentNamespacePath = moduleName;

        // 检查父级命名空间
        let parent = node.parent;
        while (parent && parent.kind === ts.SyntaxKind.ModuleDeclaration) {
            const parentModule = parent as ts.ModuleDeclaration;
            if (parentModule.name && isIdentifier(parentModule.name)) {
                currentNamespacePath = `${parentModule.name.escapedText}.${currentNamespacePath}`;
            }
            parent = parent.parent;
        }

        logger(`resolveModuleDeclaration: 当前完整命名空间路径 ${currentNamespacePath}`);

        const fullTargetPath = this.fileParam.className + '.' + this.fileParam.attrName;
        logger(`resolveModuleDeclaration: 目标路径 ${fullTargetPath}`);

        // 处理模块主体
        if (node.body && node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const moduleBlock = node.body as ts.ModuleBlock;

            // 遍历模块内的所有声明
            moduleBlock.statements.forEach((statement:ts.Statement) => {
                logger(`resolveModuleDeclaration: 处理声明类型 ${ts.SyntaxKind[statement.kind]}`);
                // 处理嵌套的模块声明（嵌套命名空间）
                if (statement.kind === ts.SyntaxKind.ModuleDeclaration) {
                    this.resolveModuleDeclaration(statement as ts.ModuleDeclaration);
                }
                // 处理常量声明
                else if (statement.kind === ts.SyntaxKind.VariableStatement) {
                    const varStatement = statement as ts.VariableStatement;

                    varStatement.declarationList.declarations.forEach(declaration => {
                        if (!declaration.name || !isIdentifier(declaration.name)) return;

                        const constName = declaration.name.escapedText;
                        const fullConstPath = `${currentNamespacePath}.${constName}`;

                        logger(`resolveModuleDeclaration: 检查常量 ${fullConstPath}`);

                        // 检查是否是目标常量
                        if (fullConstPath === fullTargetPath ||
                            this.fileParam?.attrName === `${currentNamespacePath}.${constName}` ||
                            this.fileParam?.attrName === constName) {

                            logger(`resolveModuleDeclaration: 找到匹配的常量 ${fullConstPath}`);

                            // 解析常量值
                            if (declaration.initializer) {
                                if (isStringLiteral(declaration.initializer)) {
                                    this.fileParam!.attrValue = declaration.initializer.text;
                                    logger(`resolveModuleDeclaration: 提取到字符串常量值 ${this.fileParam?.attrValue}`);
                                }
                                else if (isBinaryExpression(declaration.initializer)) {
                                    logger(`resolveModuleDeclaration: 处理二元表达式`, declaration);
                                    this.fileParam!.attrValue = this.resolveBinaryExpression(declaration.initializer);
                                }
                                else if (isPropertyAccessExpression(declaration.initializer)) {
                                    logger(`resolveModuleDeclaration: 处理属性访问表达式`);
                                    this.fileParam!.attrValue = this.resolvePropertyAccessExpression(declaration.initializer);
                                }
                                else if (isIdentifier(declaration.initializer)) {
                                    logger(`resolveModuleDeclaration: 处理标识符引用`);
                                    this.fileParam!.attrValue = this.resolveIdentifier(declaration.initializer);
                                }
                            }
                        }
                    });
                }
            });
        }

        logger(`resolveModuleDeclaration: 解析完成，当前文件参数 ${JSON.stringify(this.fileParam)}`);
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
            } else if (this.fileParam.importPath.startsWith('@') || !this.fileParam.importPath.includes('/')) {
                logger('resolveExportDeclaration current modDir: ', this.modDir)
                logger("resolveExportDeclaration fileParam: ", this.fileParam)
                this.fileParam.absolutePath = path.resolve(path.dirname(this.fileParam.absolutePath), importPath) + Constants.ETS_SUFFIX
                logger("resolveExportDeclaration this.fileParam.absolutePath: ", this.fileParam.absolutePath)
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
                                // 解析路由参数
                                if (text === annotation.param){
                                    this.resolveAnnotationArgs(propertie, result);
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


    private resolveAnnotationArgs(propertie: ts.PropertyAssignment, result: TempAnalyzerResult) {
        // 路由参数是一个对象
        if (propertie.initializer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            const paramObject = propertie.initializer as ts.ObjectLiteralExpression;
            const params: Record<string, { default: any }> = {};
            const paramStrings: string[] = [];

            // 遍历参数对象中的所有属性
            paramObject.properties.forEach(paramProp => {
                if (paramProp.kind === ts.SyntaxKind.PropertyAssignment) {
                    const paramProperty = paramProp as ts.PropertyAssignment;
                    const paramName = (paramProperty.name as ts.StringLiteral | ts.Identifier).text ||
                    (paramProperty.name as ts.Identifier).escapedText?.toString();

                    if (paramProperty.initializer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                        const defaultObj = paramProperty.initializer as ts.ObjectLiteralExpression;

                        defaultObj.properties.forEach(defaultProp => {
                            if (defaultProp.kind === ts.SyntaxKind.PropertyAssignment) {
                                const defaultProperty = defaultProp as ts.PropertyAssignment;
                                const propName = (defaultProperty.name as ts.Identifier).escapedText?.toString();

                                if (propName === 'default') {
                                    let defaultValue: any;

                                    // 根据类型解析默认值
                                    if (defaultProperty.initializer.kind === ts.SyntaxKind.NumericLiteral) {
                                        defaultValue = Number((defaultProperty.initializer as ts.NumericLiteral).text);
                                        paramStrings.push(`${paramName}: param?.${paramName} as number || ${defaultValue}`);
                                    } else if (defaultProperty.initializer.kind === ts.SyntaxKind.StringLiteral) {
                                        defaultValue = (defaultProperty.initializer as ts.StringLiteral).text;
                                        paramStrings.push(`${paramName}: param?.${paramName} as string || ${defaultValue}`);
                                    } else if (defaultProperty.initializer.kind === ts.SyntaxKind.TrueKeyword ||
                                        defaultProperty.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                                        defaultValue = defaultProperty.initializer.kind === ts.SyntaxKind.TrueKeyword;
                                        paramStrings.push(`${paramName}: param?.${paramName} as boolean || ${defaultValue}`);
                                    } else {
                                        defaultValue = null;
                                        paramStrings.push(`${paramName}: param?.${paramName} || null`);
                                    }

                                    // 保存参数信息
                                    if (paramName) params[paramName] = {default: defaultValue};
                                }
                            }
                        });
                    }
                }
            });

            // 保存参数对象和字符串形式
            result.param = params;
            result.paramStr = paramStrings.join(',\n\t\t');
            logger(`Parsed param: ${JSON.stringify(params)}`);
            logger(`Param string: ${result.paramStr}`);
        }
    }

    private logNode(node: ts.Node) {
        logger("节点结构: ", JSON.stringify(node, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                return Object.keys(value).reduce((obj, k) => {
                    if (k !== 'parent') { // 避免循环引用
                        obj[k] = value[k];
                    }
                    return obj;
                }, {} as any);
            }
            return value;
        }));
    }

    private resolveConstantOnAnnotations(initializer: ts.Node): string {
        // 装饰器上的值是表达式，尝试解析其真实值
        logger("正在解析表达式类型: ", initializer.kind, ts.SyntaxKind[initializer.kind], JSON.stringify(this.fileParam));

        this.logNode(initializer);

        // 检查是否为字符串字面量
        if (isStringLiteral(initializer)) {
            // 字符串字面量直接返回
            return initializer.text;
        }

        // 检查是否为二元表达式（如字符串拼接）
        else if (isBinaryExpression(initializer)) {
            // 处理二元表达式，如 RouterName.Group + 'HelloPage'
            logger("处理二元表达式，如字符串拼接: ")
            return this.resolveBinaryExpression(initializer as ts.BinaryExpression);
        }

        // 检查是否为属性访问表达式
        else if (isPropertyAccessExpression(initializer)) {
            // 处理简单的属性访问表达式，如 Constants.ROUTE_NAME
            logger("处理简单的属性访问表达式，如 Constants.ROUTE_NAME: ", initializer.kind, initializer.name.escapedText, JSON.stringify(initializer))
            return this.resolvePropertyAccessExpression(initializer);
        }

        // 检查是否为模板表达式
        else if (isTemplateExpression(initializer)) {
            // 处理模板字符串，如 `${Constants.BASE_PATH}/detail`
            logger("处理模板字符串，如 `${Constants.BASE_PATH}/detail`: ")
            return this.resolveTemplateExpression(initializer as ts.TemplateExpression);
        }

        // 检查是否为标识符
        else if (isIdentifier(initializer)) {
            const identifierName = initializer.escapedText.toString();
            logger(`尝试解析标识符: ${identifierName}`, this.fileParam?.className);

            // 检查是否在当前文件的导入中
            for (const [importNames, importPath] of this.importedFiles.entries()) {
                if (importNames.includes(identifierName)) {
                    logger(`找到导入的标识符: ${identifierName} 来自 ${importPath}`);
                    return this.resolveImportedIdentifier(identifierName, importPath);
                }
            }
            // 尝试解析为常量
            return this.resolveIdentifier(initializer);
        }

        // 无法解析的表达式类型，记录警告并返回空字符串
        loggerE(`无法解析的表达式类型: ${ts.SyntaxKind[initializer.kind]}`, initializer.kind);
        return "";
    }

    private resolvePropertyAccessExpression(initializer: PropertyAccessExpression): string {
        // 装饰器上的值是常量
        const fileParam = new ScanFileParam()
        let constValue = ""

        logger(`开始解析属性访问表达式0:`, JSON.stringify(initializer));
        // 构建完整的命名空间路径
        const fullPath = this.buildNamespacePath(initializer);
        logger(`开始解析属性访问表达式: ${fullPath}`);

        // 处理嵌套命名空间的情况
        // 首先尝试查找最外层的命名空间或类
        let currentExpression = initializer.expression;
        let namespaceChain = [];

        // 递归收集命名空间链
        while (isPropertyAccessExpression(currentExpression)) {
            namespaceChain.unshift((currentExpression as PropertyAccessExpression).name.escapedText);
            currentExpression = (currentExpression as PropertyAccessExpression).expression;
        }

        // 添加最外层的标识符
        if (isIdentifier(currentExpression)) {
            namespaceChain.unshift(currentExpression.escapedText);
        }

        // 添加最后的属性名
        if (isIdentifier(initializer.name)) {
            namespaceChain.push(initializer.name.escapedText);
        }

        logger(`解析到的命名空间链: ${namespaceChain.join('.')}`);

        // 设置最外层的命名空间或类名
        fileParam.className = namespaceChain[0] || "";

        // 构建用于在文件中查找的完整路径
        fileParam.attrName = namespaceChain.length > 1 ? namespaceChain.slice(1).join('.') : "";

        // 遍历导入的文件，查找匹配的包
        let importPath = "";
        for (const [importNames, importPathValue] of this.importedFiles.entries()) {
            if (importNames.includes(fileParam.className)) {
                importPath = importPathValue;
                fileParam.importPath = importPath;

                // 特殊处理ohpm包（如@hisign/baselib）
                if (importPath.startsWith('@') || !importPath.includes('/')) {
                    logger(`检测到ohpm包导入: ${importPath}`);
                    // 尝试从oh_modules目录解析
                    const nodeModulesPath = this.resolveNodeModulesPath(importPath);
                    if (nodeModulesPath && fs.existsSync(nodeModulesPath)) {
                        fileParam.absolutePath = nodeModulesPath;
                    } else {
                        // 使用FileHelper的方法尝试解析
                        fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                            importPath,
                            AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                            fileParam
                        ) + Constants.ETS_SUFFIX;
                    }
                } else {
                    // 常规路径处理
                    fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                        importPath,
                        AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                        fileParam
                    ) + Constants.ETS_SUFFIX;
                }
                break;
            }
        }

        // 如果没有找到导入文件，使用当前文件路径
        if(isEmpty(fileParam.absolutePath)) {
            logger("路径不存在，尝试使用当前文件路径：", this.filePath)
            fileParam.absolutePath = this.filePath;
        }

        // 尝试从文件中获取常量值
        if (isNotEmpty(fileParam.absolutePath) && fs.existsSync(fileParam.absolutePath)) {
            const absolutePathBefore = fileParam.absolutePath
            fileParam.actionType = Constants.TYPE_FIND_ANNOTATION_CONST_VALUE
            let analyzer = new Analyzer(AnalyzerParam.create(fileParam.absolutePath, this.modName, this.modDir), fileParam)
            analyzer.start()
            constValue = analyzer?.fileParam?.attrValue || ""
            // 解析目标文件绝对路径由Index.ets变更为真实路径，再次尝试解析
            if (isEmpty(constValue) && absolutePathBefore != fileParam.absolutePath) {
                let analyzer = new Analyzer(AnalyzerParam.create(fileParam.absolutePath, this.modName, this.modDir), fileParam)
                logger(`再次查找 begin ${JSON.stringify(fileParam)}`);
                analyzer.start()
                logger(`再次查找 end`);

                constValue = analyzer?.fileParam?.attrValue || ""
            }
            logger(`从文件中解析到的值: ${constValue}`);

            // 如果直接解析失败，尝试使用嵌套命名空间的方式查找
            if (isEmpty(constValue) && namespaceChain.length > 2) {
                logger(`尝试使用嵌套命名空间方式查找: ${namespaceChain.join('.')}`);

                // 对于嵌套命名空间，我们可以尝试从已加载的内容中直接查找
                try {
                    // 构建嵌套路径，用于直接查找
                    const nestedPath = namespaceChain.slice(1).join('.');
                    logger(`尝试直接查找嵌套路径: ${nestedPath}`);

                    // 在文件内容中搜索完整的命名空间路径定义
                    const fileContent = fs.readFileSync(fileParam.absolutePath, 'utf8');

                    // 尝试使用正则表达式匹配嵌套命名空间中的常量定义
                    // 匹配多种可能的定义格式，包括从ohpm包导入的情况
                    const patterns = [
                        // 直接常量定义格式
                        `${nestedPath}\s*=\s*['"]([^'"]+)['"]`,
                        // export const 格式
                        `export\s+(const|let|var)\s+${namespaceChain[namespaceChain.length-1]}\s*=\s*['"]([^'"]+)['"]`,
                        // 模块导出格式
                        `module\.exports\.${namespaceChain[namespaceChain.length-1]}\s*=\s*['"]([^'"]+)['"]`,
                        // 对象属性格式
                        `${namespaceChain[0]}\.${nestedPath}\s*=\s*['"]([^'"]+)['"]`,
                        // 导出对象格式
                        `export\s+default\s+\{[^}]*${nestedPath}\s*:\s*['"]([^'"]+)['"][^}]*\}`
                    ];

                    // 尝试所有匹配模式
                    for (const pattern of patterns) {
                        const regex = new RegExp(pattern, 's');
                        const match = fileContent.match(regex);

                        if (match && match[1]) {
                            constValue = match[1];
                            logger(`从文件内容中匹配到的值: ${constValue}`);
                            break;
                        }
                    }
                } catch (error) {
                    loggerE(`尝试解析嵌套命名空间时出错: ${error}`);
                }
            }
        } else {
            loggerE("解析失败：文件不存在或无法访问", fileParam.absolutePath)

            // 对于ohpm包，如果文件不存在，尝试从oh_modules中查找index文件
            if (importPath && (importPath.startsWith('@') || !importPath.includes('/'))) {
                const indexPath = this.resolveNodeModulesIndexPath(importPath);
                if (indexPath && fs.existsSync(indexPath)) {
                    logger(`尝试使用ohpm包的index文件: ${indexPath}`);
                    // 这里可以尝试直接读取和解析index文件
                    try {
                        const fileContent = fs.readFileSync(indexPath, 'utf8');
                        // 使用正则表达式直接查找常量定义
                        const fullConstPath = namespaceChain.join('.');
                        const regex = new RegExp(`${fullConstPath}\s*=\s*['"]([^'"]+)['"]`, 's');
                        const match = fileContent.match(regex);

                        if (match && match[1]) {
                            constValue = match[1];
                            logger(`从ohpm包index文件中匹配到的值: ${constValue}`);
                        }
                    } catch (error) {
                        loggerE(`尝试解析ohpm包index文件时出错: ${error}`);
                    }
                }
            }
        }

        logger("常量解析结果: ", JSON.stringify(fileParam))
        if (isEmpty(constValue)) {
            loggerE("常量解析失败：", fileParam.className, fileParam.attrName)
        }

        return constValue;
    }

    /**
     * 解析oh_modules中的包路径
     * 用于处理从ohpm包（如@hisign/baselib）中导入的常量
     */
    private resolveNodeModulesPath(packagePath: string): string | null {
        logger("resolveNodeModulesPath this.filePath: ", this.filePath)
        // 构建可能的oh_modules路径
        let currentDir = path.dirname(this.filePath);

        // 向上查找oh_modules目录
        while (currentDir !== path.parse(currentDir).root) {
            const nodeModulesDir = path.join(currentDir, 'oh_modules');
            if (fs.existsSync(nodeModulesDir)) {
                const fullPackagePath = path.join(nodeModulesDir, packagePath);
                if (fs.existsSync(fullPackagePath)) {
                    // 尝试查找入口文件
                    return this.findPackageEntry(fullPackagePath);
                }
            }
            currentDir = path.dirname(currentDir);
        }

        // 尝试使用项目根目录的oh_modules
        const projectRootNodeModules = path.join(process.cwd(), 'oh_modules', packagePath);
        if (fs.existsSync(projectRootNodeModules)) {
            return this.findPackageEntry(projectRootNodeModules);
        }

        return null;
    }

    /**
     * 查找包的入口文件
     */
    private findPackageEntry(packageDir: string): string | null {
        try {
            // 检查oh-package.json5中的main或exports字段
            const packageJsonPath = path.join(packageDir, 'oh-package.json5');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.main) {
                    return path.join(packageDir, packageJson.main);
                }
                if (packageJson.exports && typeof packageJson.exports === 'string') {
                    return path.join(packageDir, packageJson.exports);
                }
            }

            // 尝试查找常见的入口文件
            const possibleEntries = ['Index.ets'];
            for (const entry of possibleEntries) {
                const entryPath = path.join(packageDir, entry);
                if (fs.existsSync(entryPath)) {
                    return entryPath;
                }
            }
        } catch (error) {
            loggerE(`查找包入口文件时出错: ${error}`);
        }

        return null;
    }

    /**
     * 解析oh_modules中的index文件路径
     */
    private resolveNodeModulesIndexPath(packagePath: string): string | null {
        const packageDir = this.resolveNodeModulesPath(packagePath);
        if (packageDir) {
            const dir = path.dirname(packageDir);
            const possibleIndexes = ['Index.ets'];

            for (const indexFile of possibleIndexes) {
                const indexPath = path.join(dir, indexFile);
                if (fs.existsSync(indexPath)) {
                    return indexPath;
                }
            }
        }

        return null;
    }

    /**
     * 构建完整的命名空间路径字符串
     */
    private buildNamespacePath(initializer: PropertyAccessExpression): string {
        if (isPropertyAccessExpression(initializer.expression)) {
            logger(`buildNamespacePath: ${JSON.stringify(initializer.expression)}`);
            return `${this.buildNamespacePath(initializer.expression)}.${initializer.name.escapedText}`;
        } else if (isIdentifier(initializer.expression)) {
            return `${initializer.expression.escapedText}.${initializer.name.escapedText}`;
        }
        return "";
    }


    private resolveBinaryExpression(node: ts.BinaryExpression): string {
        // 主要处理字符串拼接操作
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            const leftValue = this.resolveConstantOnAnnotations(node.left);
            const rightValue = this.resolveConstantOnAnnotations(node.right);

            // 如果左右两边都能解析，则返回拼接结果
            if (leftValue !== "" && rightValue !== "") {
                logger("解析的二元表达式: ", (leftValue + rightValue));
                return leftValue + rightValue;
            }
        }

        loggerE("无法解析的二元表达式: ", ts.SyntaxKind[node.operatorToken.kind]);
        return "";
    }

    private resolveTemplateExpression(node: ts.TemplateExpression): string {
        let result = "";
        const head = node.head.text;
        const spans = node.templateSpans;

        result += head;

        // 处理模板字符串中的表达式部分
        spans.forEach(span => {
            const exprValue = this.resolveConstantOnAnnotations(span.expression);
            result += exprValue;
            result += span.literal.text;
        });

        return result;
    }

    private resolveImportedIdentifier(identifierName: string, importPath?: string): string {
        // 支持旧的调用方式（只有一个参数）
        let targetImportPath = importPath;
        if (!importPath) {
            // 查找对应的导入路径
            for (const [importNames, path] of this.importedFiles.entries()) {
                if (importNames.includes(identifierName)) {
                    targetImportPath = path;
                    break;
                }
            }
        }

        logger(`开始解析导入的标识符: ${identifierName} 来自 ${targetImportPath || '未知'}`);

        // 如果是ohpm包导入，使用特殊处理
        if (targetImportPath && (targetImportPath.startsWith('@') || !targetImportPath.includes('/'))) {
            logger(`检测到ohpm包导入，尝试使用ohpm解析: ${targetImportPath}`);
            const ohpmValue = this.resolveConstantFromOhpmPackage(targetImportPath, identifierName);
            if (ohpmValue) {
                return ohpmValue;
            }
        }

        // 创建一个参数对象来查找常量值
        const fileParam = new ScanFileParam();
        fileParam.className = identifierName;
        fileParam.attrName = identifierName;
        fileParam.importPath = targetImportPath || "";

        // 计算导入文件的绝对路径
        if (targetImportPath) {
            // 处理ohpm包路径
            if (targetImportPath.startsWith('@') || !targetImportPath.includes('/')) {
                const nodeModulesPath = this.resolveNodeModulesPath(targetImportPath);
                if (nodeModulesPath && fs.existsSync(nodeModulesPath)) {
                    fileParam.absolutePath = nodeModulesPath;
                } else {
                    fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                        targetImportPath,
                        AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                        fileParam) + Constants.ETS_SUFFIX;
                }
            } else {
                // 常规路径处理
                fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                    targetImportPath,
                    AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                    fileParam) + Constants.ETS_SUFFIX;
            }
        }

        // 如果文件存在，尝试从中解析常量值
        if (isNotEmpty(fileParam.absolutePath) && fs.existsSync(fileParam.absolutePath)) {
            logger(`找到文件: ${fileParam.absolutePath}，开始解析常量`);
            fileParam.actionType = Constants.TYPE_FIND_ANNOTATION_CONST_VALUE;

            try {
                const analyzer = new Analyzer(
                    AnalyzerParam.create(fileParam.absolutePath, this.modName, this.modDir),
                    fileParam);
                analyzer.start();

                const result = analyzer?.fileParam?.attrValue || "";
                logger(`解析结果: ${result}`);
                return result;
            } catch (error) {
                loggerE(`解析导入的标识符时出错: ${error}`);
            }
        } else {
            loggerE(`文件不存在: ${fileParam.absolutePath}`);

            // 对于ohpm包，如果文件不存在，尝试直接读取oh_modules中的文件
            if (targetImportPath && (targetImportPath.startsWith('@') || !targetImportPath.includes('/'))) {
                logger(`尝试直接读取ohpm包文件内容`);
                const ohpmValue = this.resolveConstantFromOhpmPackage(targetImportPath, identifierName);
                if (ohpmValue) {
                    return ohpmValue;
                }
            }
        }

        // 解析失败，返回空字符串
        loggerE(`无法解析导入的标识符: ${identifierName}`);
        return "";
    }

    private resolveIdentifier(node: ts.Identifier): string {
        // 尝试解析标识符作为常量
        const identifierName = node.escapedText.toString();

        // 1. 检查是否是导入的常量
        const fileParam = new ScanFileParam();

        if(identifierName.includes('.')) {
            fileParam.className = identifierName.split('.')[0];
            fileParam.attrName = identifierName.split('.')[1];
        } else {
            fileParam.className = identifierName;
            fileParam.attrName = identifierName;
        }

        logger(`resolveIdentifier 查找导入文件: ${JSON.stringify(Array.from(this.importedFiles.keys()))}`);

        // 查找对应的导入文件
        let foundImportPath = "";
        for (const [importNames, importPath] of this.importedFiles.entries()) {
            if (importNames.includes(identifierName)) {
                foundImportPath = importPath;
                fileParam.importPath = importPath;

                // 特殊处理ohpm包（如@hisign/baselib）
                if (importPath.startsWith('@') || !importPath.includes('/')) {
                    logger(`检测到ohpm包导入: ${importPath}`);
                    // 尝试从oh_modules目录解析
                    const nodeModulesPath = this.resolveNodeModulesPath(importPath);
                    if (nodeModulesPath && fs.existsSync(nodeModulesPath)) {
                        fileParam.absolutePath = nodeModulesPath;
                    } else {
                        // 使用常规方法解析
                        fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                            importPath,
                            AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                            fileParam) + Constants.ETS_SUFFIX;
                    }
                } else {
                    // 常规路径处理
                    fileParam.absolutePath = FileHelper.getImportAbsolutePathByOHPackage(
                        importPath,
                        AnalyzerParam.create(this.filePath, this.modName, this.modDir),
                        fileParam) + Constants.ETS_SUFFIX;
                }
                break;
            }
        }

        if(isEmpty(fileParam.absolutePath)) {
            loggerE(`resolveIdentifier 未找到导入文件: ${identifierName} 尝试使用当前文件: ${this.filePath}`);
            fileParam.absolutePath = this.filePath;
            if(this.fileParam) {
                fileParam.className = this.fileParam.className;
                if(this.fileParam.attrName.includes('.')) {
                    fileParam.attrName = this.fileParam.attrName.split('.')[0] + '.' + fileParam.attrName
                }
            }
        }

        // 如果找到对应的文件，尝试从中解析常量值
        let constValue = "";
        if (isNotEmpty(fileParam.absolutePath) && fs.existsSync(fileParam.absolutePath)) {
            fileParam.actionType = Constants.TYPE_FIND_ANNOTATION_CONST_VALUE;
            const analyzer = new Analyzer(
                AnalyzerParam.create(fileParam.absolutePath, this.modName, this.modDir),
                fileParam);
            analyzer.start();
            constValue = analyzer?.fileParam?.attrValue || "";
        }

        // 2. 如果常规解析失败且是ohpm包导入，尝试特殊处理
        if (isEmpty(constValue) && foundImportPath && (foundImportPath.startsWith('@') || !foundImportPath.includes('/'))) {
            logger(`常规解析失败，尝试使用ohpm包特殊处理: ${foundImportPath}`);
            constValue = this.resolveConstantFromOhpmPackage(foundImportPath, identifierName);
        }

        // 3. 如果仍然失败，尝试直接使用resolveImportedIdentifier
        if (isEmpty(constValue) && foundImportPath) {
            logger(`尝试使用resolveImportedIdentifier: ${identifierName} from ${foundImportPath}`);
            constValue = this.resolveImportedIdentifier(identifierName, foundImportPath);
        }

        logger(`标识符解析结果: ${identifierName} -> ${constValue || '无法解析'}`);
        return constValue;
    }

    /**
     * 从ohpm包中解析常量值
     */
    private resolveConstantFromOhpmPackage(packagePath: string, constantName: string): string {
        try {
            // 解析ohpm包路径
            const packageEntryPath = this.resolveNodeModulesPath(packagePath);
            if (!packageEntryPath || !fs.existsSync(packageEntryPath)) {
                return '';
            }

            logger(`尝试从ohpm包文件解析常量: ${packageEntryPath}`);
            const fileContent = fs.readFileSync(packageEntryPath, 'utf8');

            // 尝试匹配多种可能的常量导出格式
            const patterns = [
                // 直接导出常量
                `export\s+(const|let|var)\s+${constantName}\s*=\s*['"]([^'"]+)['"]`,
                // 对象属性格式导出
                `export\s+const\s+${constantName}\s*=\s*\{[^}]*\}`,
                // 默认导出中的常量
                `export\s+default\s+\{[^}]*${constantName}\s*:\s*['"]([^'"]+)['"][^}]*\}`,
                // 模块导出格式
                `module\.exports\.${constantName}\s*=\s*['"]([^'"]+)['"]`,
                // 作为常量对象的一部分导出
                `(const|let|var)\s+${constantName}\s*=\s*['"]([^'"]+)['"]`
            ];

            for (const pattern of patterns) {
                const regex = new RegExp(pattern, 's');
                const match = fileContent.match(regex);

                if (match) {
                    // 对于不同的模式，匹配组可能不同
                    if (match[2]) {
                        return match[2];
                    }
                }
            }

            // 如果在入口文件中找不到，尝试查找index文件
            const indexPath = this.resolveNodeModulesIndexPath(packagePath);
            if (indexPath && indexPath !== packageEntryPath && fs.existsSync(indexPath)) {
                logger(`尝试在ohpm包的index文件中查找: ${indexPath}`);
                const indexContent = fs.readFileSync(indexPath, 'utf8');

                // 对index文件应用相同的模式匹配
                for (const pattern of patterns) {
                    const regex = new RegExp(pattern, 's');
                    const match = indexContent.match(regex);

                    if (match && match[2]) {
                        return match[2];
                    }
                }
            }
        } catch (error) {
            loggerE(`从ohpm包解析常量时出错: ${error}`);
        }

        return '';
    }

}

export {Analyzer}
