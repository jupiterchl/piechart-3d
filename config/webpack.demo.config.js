const path = require('path');
const webpack = require('webpack');
const webpackBaseConfig = require('./webpack.base.config');
const { merge } = require('webpack-merge');

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
  plugins: [
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
    }),
  ],
};

module.exports = merge(webpackBaseConfig, webpackDemoConfig);
