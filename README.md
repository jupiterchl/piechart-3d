# template-plugin

> js 插件开发模板

## 使用说明

```bash
# 安装依赖
yarn

# 启动开发服务器
yarn dev

# 打包
yarn build
```

## 打包配置

```bash
# webpack.prod.config.js
1. 修改entry入口名为插件名称；

# package.json
1. 修改main为对应的入口文件；
2. 修改远程仓库链接（repository、bugs属性）；
3. 如果需要开启打包分析，可在build命令中添加 --analyze 参数；
```

## 配置

开发配置同模板项目，[点击查看](https://gitee.com/happychl/template)。
