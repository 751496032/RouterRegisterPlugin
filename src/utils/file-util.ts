import {logger} from "./logger";
import {AnalyzerParam, RouterParamWrap} from "../model";
import fs from "node:fs";
import JSON5 from "json5";
import path from "node:path";
import Constants from "./constants";
import {isNotEmpty} from "./text";
import {Analyzer} from "../analyzer";

class FileUtils {

    static deleteDirFile(directory: string) {
       try {
           const files = fs.readdirSync(directory)
           files.forEach(file => {
               const filePath = path.join(directory, file);
               fs.unlinkSync(filePath);
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

    static getImportAbsolutePathByOHPackage(pathOrModuleName: string, analyzerParam: AnalyzerParam, param: RouterParamWrap) {
        logger("getImportAbsolutePathByOHPackage start: ", pathOrModuleName, analyzerParam);
       let absolutePath
        if (FileUtils.isModule(pathOrModuleName)) {
            const data = fs.readFileSync(`${analyzerParam.modDir}/oh-package.json5`, {encoding: "utf8"})
            const json = JSON5.parse(data)
            const dependencies = json.dependencies || {}

            const targetMod : {
                name: string,
                srcPath: string
            } | undefined = Object.keys(dependencies).map(key => {
                if (key.toLowerCase() == pathOrModuleName || pathOrModuleName.startsWith(key)) {
                    let srcPath = dependencies[key].toString().split(':')[1];
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
                if (isNotEmpty(analyzer.routerParamWrap?.absolutePath)) {
                    absolutePath = analyzer.routerParamWrap?.absolutePath
                    logger("getImportAbsolutePathByOHPackage index: ", absolutePath)
                } else {
                    absolutePath = FileUtils.getImportAbsolutePathByBuildProfile(pathOrModuleName, analyzerParam, param)
                }
            } else  {
                absolutePath = FileUtils.getImportAbsolutePathByBuildProfile(pathOrModuleName, analyzerParam, param)
            }

        }else {
            const filePath = path.resolve(path.dirname(analyzerParam.scanFilePath), pathOrModuleName)
            logger("getImportAbsolutePathByOHPackage path: ", filePath)
            absolutePath = filePath
        }
        logger("getImportAbsolutePathByOHPackage end: ", absolutePath)
        return absolutePath

    }


    static getImportAbsolutePathByBuildProfile(pathOrModuleName: string, analyzerParam: AnalyzerParam, param: RouterParamWrap) {
        let absolutePath
        try {
            if (FileUtils.isModule(pathOrModuleName)) {
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
                    if (isNotEmpty(analyzer.routerParamWrap?.absolutePath)) {
                        absolutePath = analyzer.routerParamWrap?.absolutePath
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


}

export default FileUtils;