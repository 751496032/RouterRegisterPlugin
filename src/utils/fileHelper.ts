import {logger} from "./logger";
import {AnalyzerParam, PageInfo, PluginConfig, ScanFileParam} from "../models/model";
import fs from "node:fs";
import JSON5 from "json5";
import path from "node:path";
import Constants from "../models/constants";
import {isNotEmpty} from "./string";
import {Analyzer} from "../analyzer";
import Handlebars from "handlebars";
import {HvigorNode} from "@ohos/hvigor";
import {readdirSync} from "fs";


/**
 * @author: HZWei
 * @date:  2024/12/5
 * @desc:
 */

class FileHelper {

    static deleteDirFile(directory: string) {
        if (!fs.existsSync(directory)) return
       try {
           const files = fs.readdirSync(directory)
           files.forEach(file => {
               const filePath = path.join(directory, file);
               if (fs.existsSync(filePath))  fs.unlinkSync(filePath);

           });
       }catch(err) {
           logger("删除异常：", err)
       }
    }

   static isModule(importPath: string) {
        try {
            const isRelativePath = importPath.startsWith('./') || importPath.startsWith('../');
            return !isRelativePath
        } catch (err) {
            logger("isModule err: ", err)
        }
        return false
    }

    static getImportAbsolutePathByOHPackage(pathOrModuleName: string, analyzerParam: AnalyzerParam, param: ScanFileParam) {
        logger("getImportAbsolutePathByOHPackage start: ", pathOrModuleName, analyzerParam);
       let absolutePath
        if (FileHelper.isModule(pathOrModuleName)) {
            const json = FileHelper.getOhPackageJSON5(analyzerParam.modDir)
            const dependencies = json.dependencies || {}

            const targetMod : {
                name: string,
                srcPath: string
            } | undefined = Object.keys(dependencies).map(key => {
                if (key.toLowerCase() == pathOrModuleName) {
                    let srcPath:string = dependencies[key].toString().split(':')[1].trim();
                    return {name : key,srcPath};
                }
            }).find(item => item !== undefined)
            if (targetMod != undefined && targetMod.srcPath != undefined) {

                const targetModAbsolutePath = path.resolve(analyzerParam.modDir, targetMod.srcPath)
                logger("getImportAbsolutePathByOHPackage module: ", targetMod.srcPath, targetModAbsolutePath)
                const indexPath = path.join(targetModAbsolutePath, "Index.ets")
                param.indexModuleName = targetMod.name
                param.moduleSrcPath = targetMod.srcPath
                param.actionType = Constants.TYPE_FIND_MODULE_INDEX_PATH
                let analyzer = new Analyzer(AnalyzerParam.create(indexPath, analyzerParam.modName, analyzerParam.modDir), param)
                analyzer.start()
                if (isNotEmpty(analyzer.fileParam?.absolutePath)) {
                    absolutePath = analyzer.fileParam?.absolutePath
                    logger("getImportAbsolutePathByOHPackage index: ", absolutePath)
                } else {
                    absolutePath = FileHelper.getImportAbsolutePathByBuildProfile(pathOrModuleName, analyzerParam, param)
                }
            } else  {
                absolutePath = FileHelper.getImportAbsolutePathByBuildProfile(pathOrModuleName, analyzerParam, param)
            }

        }else {
            const filePath = path.resolve(path.dirname(analyzerParam.scanFilePath), pathOrModuleName)
            logger("getImportAbsolutePathByOHPackage path: ", filePath)
            absolutePath = filePath
        }
        logger("getImportAbsolutePathByOHPackage end: ", absolutePath)
        return absolutePath

    }


    static getImportAbsolutePathByBuildProfile(pathOrModuleName: string, analyzerParam: AnalyzerParam, param: ScanFileParam) {
        let absolutePath
        try {
            if (FileHelper.isModule(pathOrModuleName)) {
                // 在build-profile.json5文件中查找出模块的相对路径
                const data = fs.readFileSync(`${process.cwd()}/build-profile.json5`, {encoding: "utf8"})
                const json = JSON5.parse(data)
                const modules = json.modules || []
                const targetMod: {
                    name: string,
                    srcPath: string
                } = modules.find((item: {
                    name: string,
                    srcPath: string
                }) => item.name.toLowerCase() == pathOrModuleName || pathOrModuleName.startsWith(item.name.toLowerCase()))
                if (targetMod != null) {
                    const modPath = path.resolve(process.cwd(), targetMod.srcPath)
                    logger("getImportAbsolutePathByBuildProfile module: ", targetMod.name, targetMod.srcPath, modPath)
                    // 1、先在index.ets文件中查找出相对路径
                    const indexPath = path.join(modPath, "Index.ets")
                    param.indexModuleName = targetMod.name
                    param.moduleSrcPath = targetMod.srcPath
                    param.actionType = Constants.TYPE_FIND_MODULE_INDEX_PATH
                    let analyzer = new Analyzer(AnalyzerParam.create(indexPath, analyzerParam.modName, analyzerParam.modDir), param)
                    analyzer.start()
                    if (isNotEmpty(analyzer.fileParam?.absolutePath)) {
                        absolutePath = analyzer.fileParam?.absolutePath
                        logger("getImportAbsolutePathByBuildProfile index: ", absolutePath)
                    } else {
                        // 2、如果在Index.ets文件中没有命中，可能在Index文件中没有直接导出，是通过直接导入的方式
                        absolutePath = modPath + pathOrModuleName.replace(targetMod.name.toLowerCase(), "")
                        logger("getImportAbsolutePathByBuildProfile other: ", absolutePath)
                    }

                }
            } else {
                const filePath = path.resolve(path.dirname(analyzerParam.scanFilePath), pathOrModuleName)
                logger("getImportAbsolutePath path: ", filePath)
                absolutePath = filePath

            }

        } catch (e) {
            logger("getImportAbsolutePath err: ", e)
        } finally {
            absolutePath = absolutePath ?? path.resolve(path.dirname(analyzerParam.scanFilePath), pathOrModuleName)
        }
        return absolutePath

    }

    static getTemplateContent(templateRelativePath: string, pageList: Array<PageInfo>) {
        // 模板路径是在离线包内的，因此路径也是相对离线包而言的
        const templatePath = path.resolve(__dirname, templateRelativePath);
        logger('generateServiceFile template path: ', templatePath)
        const source = fs.readFileSync(templatePath, 'utf8')
        const template = Handlebars.compile(source)
        const content = {pageList: pageList, zRouterPath: pageList[0].zRouterPath}
        return template(content)
    }

    static findZRouterModuleName(node: HvigorNode){
        const modDir = node.getNodePath()
        let counter = 0
        function findZRouterPath(json: any) {
            const dependencies = json.dependencies || {}
            let path = ""
            Object.keys(dependencies).forEach((key)=>{
                if (Constants.Z_ROUTER_PATHS.includes(key.toLowerCase())) {
                    path = key
                }
            })
            if (isNotEmpty(path)) {
                return path
            } else {
                counter++
                if (counter > 3) return undefined
                return findZRouterPath(FileHelper.getOhPackageJSON5(modDir))
            }
        }
        return findZRouterPath(process.cwd()) || Constants.Z_ROUTER_PATHS[0]
    }


    static getOhPackageJSON5(ohAbsDirPath: string) {
        const data = fs.readFileSync(`${ohAbsDirPath}/oh-package.json5`, {encoding: "utf8"})
        return JSON5.parse(data)
    }

    static getAllValidPaths(dirs: string[]) {
        return dirs.filter((dir) => fs.existsSync(dir))
    }


    static getFilesInDir(...dirPaths: string[]) {
        let files = new Array<string>()
        function find(currentDir: string) {
            if (fs.existsSync(currentDir)){
                const contents = readdirSync(currentDir, {withFileTypes: true})
                contents.forEach((value, index) => {
                    // 文件目录路径 + 文件名称  = 文件路径
                    const filePath = path.join(currentDir, value.name)
                    if (value.isDirectory()) {
                        find(filePath)
                    } else if (value.isFile() && value.name.endsWith(Constants.ETS_SUFFIX)) {
                        files.push(filePath)
                    }
                })
            }
        }

        dirPaths.forEach((path) => {
            find(path)
        })
        logger(files)
        return files
    }

    static insertContentToFile(filePath: string, content: string) {
        if (!fs.existsSync(filePath)) return;
        const data = fs.readFileSync(filePath, {encoding: "utf8"})
        if (data.includes(content.trim())) {
            return;
        }
        const newData =  `${content}\n` + data;
        fs.writeFileSync(filePath, newData, {encoding: "utf8"})
    }




}

export default FileHelper;