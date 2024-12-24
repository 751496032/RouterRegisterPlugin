
具体使用，可参考以下链接

> https://github.com/751496032/ZRouter
> 
> https://juejin.cn/post/7394094789287067685

## 版本更新记录

### 1.3.0 / 2024-12-24

- NavDestination页面模板化的生命周期实现类属性支持全局和单个页面自定义命名。

### 1.2.1 / 2024-12-19

- 修复生成NavDest页面模板化的问题；
- NavDest模板页面中的lifecycleObserver属性名称支持自定义，在编译插件的lifecycleObserverAttributeName字段设置自定义名称；

### 1.2.0 / 2024-12-8

- 支持NavDestination页面模板化；
- 修复dependencies依赖路径存在空格而导致常量查找失败的问题。

### 1.1.1

- 修复删除历史编译产物问题

### 1.1.0

- 对扫码的目录进行安全校验
- 优化路由表的生成

### 1.0.9

- 支持服务路由。

### 1.0.8 

- 优化@Route装饰器上的常量查找逻辑；
- config配置新增scanDirs字段，支持配置多个扫描目录，scanDir字段已设过期状态；
- config配置新增isAutoDeleteHistoryFiles字段，用于是否自动删除无用编译产物。

### 1.0.7

- @Route装饰器上的name属性支持常量设置，常量可在当前模块或跨模块定义。

### 1.0.6
- 修改生成文件的名称，统一加前缀ZR，适配混淆；
- 自动删除历史残余文件

### 1.0.5

- 修复部分windows系统下编译报错问题
- 删除模块下Index.ets导出
- 修改Builder函数生成的文件路径，避免加载所有的组件
- 如果插件不生效，关闭IDE并清缓存重启

## 其他

大家使用中有疑问或者建议，可以扫码或加v(751496032)进群交流，备注鸿蒙ZRouter

![在这里插入图片描述](https://private-user-images.githubusercontent.com/13871838/365167290-4b9bcc87-1202-45c4-97f9-4506f36d6801.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjU2NDEzMzMsIm5iZiI6MTcyNTY0MTAzMywicGF0aCI6Ii8xMzg3MTgzOC8zNjUxNjcyOTAtNGI5YmNjODctMTIwMi00NWM0LTk3ZjktNDUwNmYzNmQ2ODAxLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA5MDYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwOTA2VDE2NDM1M1omWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTllNDRmMDNjN2JmMmQyNWYwMGM0YjRkMmZiZjk5NGQxNTNiMzU4NzJiZDhkMDZiY2FmMGM3NzMzNjVhNzFjYzgmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.28T2tMEunN4e3Mef_Z6HfIVEjP_XgLbmfOjl9zoOQbQ)


