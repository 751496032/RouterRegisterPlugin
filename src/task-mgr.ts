/**
 * @author: HZWei
 * @date: 2025/5/25
 * @desc:
 */
import {PluginConfig} from "./models/model";
import {FileUtil, hvigor, HvigorNode} from "@ohos/hvigor";
import {logger} from "./utils/logger";
import {ConfigMgr} from "./config-mgr";
import {OhosUtil} from "./utils/ohos";
import Constants from "./models/constants";
import {RouteMap} from "./models/route-map";
import FileHelper from "./utils/file-helper";
import {Modules} from "./models/module";
import {isEmpty, isNotEmpty} from "./utils/string";


export class TaskMgr {

    private readonly originConfig: PluginConfig;
    private readonly node: HvigorNode;
    private readonly isRoot: boolean = false;
    private executePlugin: (config: PluginConfig, node: HvigorNode) => void = (config, node) => {

    }

    constructor(config: PluginConfig, node: HvigorNode) {
        this.originConfig = config;
        this.node = node;
        this.isRoot = node.getParentNode() === undefined;

        if (!this.isCacheRawFileRouterMapPath()){
            hvigor.getHvigorConfig().getAllNodeDescriptor().forEach((descriptor) => {
                logger("hvigor.descriptor -> ", descriptor.name)
            })
            hvigor.beforeNodeEvaluate((itemNode) => {
                const r = hvigor.getRootNode().getExtraOption(Constants.KEY_ROUTER_MAP)
                if (isNotEmpty(r)) {
                    itemNode.addExtraOption(Constants.KEY_ROUTER_MAP, r)
                    return
                }
                logger("hvigor.beforeNodeEvaluate ", node.getNodeName())
                const itemModulePath = itemNode.getNodePath()
                let {routerMapPath, isEntryModule} = this.readModules(itemModulePath)
                if (!isEntryModule) {
                    // 兜底查询
                    const r = this.readModules(node.getNodePath())
                    isEntryModule = r.isEntryModule
                    routerMapPath = r.routerMapPath
                }
                if (isEntryModule) {
                    logger("entry routerMapPath: ", routerMapPath)
                    itemNode.addExtraOption(Constants.KEY_ROUTER_MAP, routerMapPath)
                    hvigor.getRootNode().addExtraOption(Constants.KEY_ROUTER_MAP, routerMapPath)

                }
            })
        }


        // if (this.isRoot){
        //     this.node.registerTask({
        //         name: Constants.TASK_CLEAR_CACHE_Z,
        //         run: async () => {
        //             const pnpmDir = path.dirname(path.dirname(path.dirname(path.dirname(__dirname))));
        //             console.log("pnpmDir: ", pnpmDir)
        //             FileHelper.findFirstLevelDirs(pnpmDir,['ZRouter','zrouter','router-register-plugin']).forEach((dir) => {
        //                 console.log("delete dir: ", dir)
        //                 FileHelper.deleteDirFile(dir)
        //             })
        //         }
        //     })
        // }
    }


    private isCacheRawFileRouterMapPath() {
        const path = hvigor.getRootNode().getExtraOption(Constants.KEY_ROUTER_MAP) + ''
        logger('isCacheRawFileRouterMapPath: ', path)
        return FileHelper.isPath(path) ;
    }


    private readModules(modulePath: string) {
        const moduleFilePath = `${modulePath}${Constants.MODULE_RELATIVE_FILE_PATH}`;
        const r = FileHelper.isEntryModule(moduleFilePath)
        return {routerMapPath: r ? `${modulePath}${Constants.ROUTER_MAP_RELATIVE_FILE_PATH}` : '', isEntryModule: r}
    }

    private get config() {
        return this.originConfig;
    }

    start(executePlugin: (config: PluginConfig, node: HvigorNode) => void) {
        this.executePlugin = executePlugin;
        this.startInternal(this.isRoot, this.config, this.node);
    }

    private startInternal(isRoot: boolean, config: PluginConfig, node: HvigorNode) {
        if (isRoot) {
            // 工程级
            hvigor.nodesEvaluated((nodes) => {
                this.node.subNodes((currentNode) => {
                    if (this.config.ignoredModules && config.ignoredModules.length > 0) {
                        const r = config.ignoredModules.find((module) => {
                            return module === currentNode.getNodeName()
                        })
                        if (!r) {
                            logger('apply project nodeName: ', currentNode.getNodeName())
                            const conf = JSON.parse(JSON.stringify(config))
                            this.startTargets(conf, currentNode, isRoot)
                        }
                    } else {
                        // 默认扫描所有模块
                        logger('apply project nodeName: ', currentNode.getNodeName())
                        const conf = JSON.parse(JSON.stringify(config))
                        this.startTargets(conf, currentNode, isRoot)
                    }

                })
            })
        } else {
            // 模块级
            logger('apply module nodeName: ', node.getNodeName())
            this.startTargets(config, node)
        }
    }


    private startTargets(config: PluginConfig, node: HvigorNode, isRoot: boolean = false){
        logger('apply nodeName: ', node.getNodeName()) //模块名 ，比如entry，harA
        logger('apply nodePath: ', node.getNodePath()) //模块路径  这里和nodeDir是一样的
        ConfigMgr.init(config, node);
        const ohosContext = OhosUtil.getOhosContext(node)
        logger("apply ohosContext: ", ohosContext?.getModuleType(), ohosContext?.getModuleName())
        /**
         * 缓存路由映射表到Entry模块下：
         * 1. 把entry模块的rawfile 路径到本地
         *      a. 如何判断是否是entry模块 ？
         * 2. 将每个模块的路由表信息保存到rawfile 中 router_map.json文件中
         */


        ohosContext?.targets((target) => {
            const targetName = target.getTargetName()
            this.registerTask(config, node, targetName)
        })

    }

    private registerTask(config: PluginConfig, node: HvigorNode, targetName: string) {
        node.registerTask({
            name: Constants.TASK_CLEAN_Z,
            postDependencies: [Constants.TASK_CLEAN],
            run: async () => {
                logger(Constants.TASK_CLEAN_Z, "start")
                if (FileUtil.exist(config.routerMapPath)) {
                    FileUtil.writeFileSync(config.routerMapPath, JSON.stringify(new RouteMap(), null, 2))
                }
                const rawfileRouterMapPath = hvigor.getRootNode().getExtraOption(Constants.KEY_ROUTER_MAP)
                if (FileUtil.exist(rawfileRouterMapPath)){
                    FileUtil.writeFileSync(rawfileRouterMapPath, JSON.stringify(new RouteMap(), null, 2))
                }
                FileHelper.deleteDirFile(config.generatedDir, [Constants.ZR_SERVICE_NAME])

            }
        })
        node.registerTask({
            name: Constants.TASK_INIT_Z,
            postDependencies: [Constants.TASK_INIT],
            run: async () => {
                logger(Constants.TASK_INIT_Z, "start")
                this.executePlugin(config, node)
            }
        })
        node.registerTask({
            name: Constants.TASK_BUILD_Z,
            postDependencies: [`${targetName}${Constants.TASK_DO_NATIVE_STRIP}`],
            run: async () => {
                logger( Constants.TASK_BUILD_Z, "start")
                this.executePlugin(config, node)
            }
        })

        if (config.enableUiPreviewBuild){
            node.registerTask({
                name: Constants.TASK_PREVIEW_BUILD_Z,
                postDependencies: [Constants.TASK_PREVIEW_BUILD],
                run: async () => {
                    logger(Constants.TASK_PREVIEW_BUILD_Z, "start")
                    this.executePlugin(config, node)
                }
            })
        }
    }



}
