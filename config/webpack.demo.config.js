const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpackBaseConfig = require('./webpack.base.config');
const { mergeWithRules, CustomizeRule } = require('webpack-merge');

// 示例页生产构建：输出到 dist/，与 public/index.html 一起部署到 GitHub Pages
const webpackDemoConfig = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, '../dist'),
    publicPath: 'auto',
    filename: 'build.js',
    clean: true,
  },
  resolve: {
    // 示例页同时使用 Vue 2 与 Vue 3：vue2 指向已安装的 2.x，vue 指向 3.x
    alias: {
      'vue$': 'vue3',
      'vue2$': path.resolve(__dirname, '../node_modules/vue'),
    },
  },
  devtool: false,
  module: {
    // 抽离成独立 CSS 文件，由 index.html 直接引入，避免 JS 注入前的无样式闪烁
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /\.sass$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader?indentedSyntax'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
    }),
    new MiniCssExtractPlugin({ filename: 'build.css' }),
  ],
};

// 样式规则用 Replace 覆盖基础配置里的 style-loader
module.exports = mergeWithRules({
  module: {
    rules: {
      test: CustomizeRule.Match,
      use: CustomizeRule.Replace,
    },
  },
})(webpackBaseConfig, webpackDemoConfig);
