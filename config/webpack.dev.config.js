const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpackBaseConfig = require('./webpack.base.config');
const { mergeWithRules, CustomizeRule } = require('webpack-merge');

const webpackDevConfig = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, '../dist'),
    publicPath: '/dist/',
    filename: 'build.js',
  },
  resolve: {
    // 示例页同时使用 Vue 2 与 Vue 3：vue2 指向已安装的 2.x，vue 指向 3.x
    // vue2 必须指向绝对路径，否则别名会继续递归命中 vue$ -> vue3
    alias: {
      'vue$': 'vue3',
      'vue2$': path.resolve(__dirname, '../node_modules/vue'),
    },
  },
  devServer: {
    historyApiFallback: true,
    open: true,
    compress: true,
    hot: true,
    port: 8080,
  },
  devtool: 'source-map',
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
})(webpackBaseConfig, webpackDevConfig);
