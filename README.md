
## ZRouter

- github：https://github.com/751496032/ZRouter
- gitee：https://gitee.com/common-apps/ZRouter
- 掘金：https://juejin.cn/post/7394094789287067685


## 基本使用

### 安装

**在鸿蒙项目根目录的hvigor目录下的`hvigor-config.json5`文件中配置安装**


```
"dependencies": {
  "router-register-plugin":"x.x.x"
},
```

最后记得Sync Now或重新build让插件安装生效。

### 配置

支持两种配置方式：

- **工程级配置**: 即在工程根目录下的hvigorfile.ts文件中全局配置；
- **模块级配置**：即在每个模块目录下的hvigorfile.ts文件中单独配置；

> 不建议一个项目同时使用两种配置方式，虽然是这种混合方式也是支持的，但容易出现配置冲突。模块级配置相对繁琐些，但配置项会更精细化些。

步骤：
```
// 1、导入
import { routerRegisterPlugin, PluginConfig } from 'router-register-plugin'

// 2、初始化配置
const config: PluginConfig = {
    scanDirs: ['src/main/ets/pages', 'src/main/ets/views'], // 扫描的目录，如果不设置，默认是扫描src/main/ets目录
    logEnabled: true, // 查看日志
    viewNodeInfo: false, // 查看节点信息
}
export default {
    // 3、添加插件
    plugins:[routerRegisterPlugin(config)] 
}

```

> **注意：hvigorfile.ts文件中默认配置不要删除了。**

配置参数说明：


| 参数名                              | 类型       | 默认值               | 描述                                                                           |
|----------------------------------|----------|-------------------|------------------------------------------------------------------------------|
| `scanDirs`                       | string[] | ['src/main/ets']  | 扫描的目录，如果不设置，默认是扫描src/main/ets目录。建议配置该字段，避免扫描所有目录，影响工程编译效率**                  |                                           |
| `logEnabled`                     | boolean  | true              | 是否打印日志                                                                       |                                 |
| `viewNodeInfo`                   | boolean  | false             | 查看节点信息，只有与logEnable同时为true才会打印输出                                             |
| ~~`isAutoDeleteHistoryFiles`~~   | boolean  | false             | 是否在构建时删除编译产物，已弃用，在项目`clean`自动删除无用编译产物，请不要设置此参数。                              |              |
| `lifecycleObserverAttributeName` | string   | lifecycleObserver | 如果使用了NavDest页面模板化功能，该配置字段会生效，默认属性名是lifecycleObserver，也可以在@Route注解上单独设置这个属性   |
| **`ignoredModules`**             | string[] | []                | 忽略需要扫描的模块，填写模块名称，默认是全部模块；**插件在工程级时使用**，该字段才会生效。**建议配置该字段，避免扫描所有模块，影响工程编译效率** |
| `enableUiPreviewBuild`           | boolean  | false             | 是否在ui预览构建时生成，默认不启用, 会降低ui预览构建效率                                              |


>  **注意：** 以上配置参数都是可选的，建议配置`scanDirs`和`ignoredModules`字段，避免扫描所有目录和模块，影响工程编译效率。

## 更新记录

### 1.5.0 / 2025-5-25

- 同时支持工程级和模块级两种方式配置；
- 支持项目`clean`时自动删除编译产物；
- 优化构建效率，新增配置项`ignoredModules`，工程级配置可设置忽略模块，避免扫描所有模块；新增配置项`enableUiPreviewBuild`，避免在ui预览构建时生成, 影响ui预览效率。


### 1.3.2 / 2025-4-20

- 当`@Route`注解不设置任何属性时，默认生成的路由名称为当前页面的类名；
- 修复一些已知问题。

### 1.3.0 / 2024-12-24

- `NavDestination`页面模板化的生命周期实现类属性支持全局和单个页面自定义命名。

### 1.2.1 / 2024-12-19

- 修复NavDestination页面模板化的问题；
- NavDestination页面模板化lifecycleObserver属性支持自定义名称，可在插件的lifecycleObserverAttributeName字段设置；

### 1.2.0 / 2024-12-8

- 支持`NavDestination`页面模板化；
- 修复`dependencies`依赖路径存在空格而导致常量查找失败的问题。

### 1.1.1

- 修复删除历史编译产物问题

### 1.1.0

- 对扫码的目录进行安全校验
- 优化路由表的生成

### 1.0.9

- 支持服务路由。

### 1.0.8 

- 优化`@Route`装饰器上的常量查找逻辑；
- 配置新增`scanDirs`字段，支持配置多个扫描目录，`~~scanDir~~`字段已设过期状态；
- 配置新增`isAutoDeleteHistoryFiles`字段，用于是否自动删除无用编译产物。

### 1.0.7

- `@Route`装饰器上的`name`属性支持常量设置，支持跨模块定义。

### 1.0.6
- 修改生成文件的名称，统一加前缀ZR，适配混淆；
- 支持自动删除历史残余文件。

### 1.0.5

- 修复部分`windows`系统下编译报错问题
- 删除模块下`Index.ets`导出
- 修改`Builder`函数生成的文件路径，避免加载所有的组件；
- 如果插件不生效，关闭IDE并清缓存重启。

## 其他

大家使用中有疑问或者建议，可以扫码或加v(751496032)进群交流，备注鸿蒙ZRouter

![在这里插入图片描述](https://private-user-images.githubusercontent.com/13871838/365167290-4b9bcc87-1202-45c4-97f9-4506f36d6801.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjU2NDEzMzMsIm5iZiI6MTcyNTY0MTAzMywicGF0aCI6Ii8xMzg3MTgzOC8zNjUxNjcyOTAtNGI5YmNjODctMTIwMi00NWM0LTk3ZjktNDUwNmYzNmQ2ODAxLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA5MDYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwOTA2VDE2NDM1M1omWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTllNDRmMDNjN2JmMmQyNWYwMGM0YjRkMmZiZjk5NGQxNTNiMzU4NzJiZDhkMDZiY2FmMGM3NzMzNjVhNzFjYzgmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.28T2tMEunN4e3Mef_Z6HfIVEjP_XgLbmfOjl9zoOQbQ)


