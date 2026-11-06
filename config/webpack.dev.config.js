const path = require('path');
const webpack = require('webpack');
const webpackBaseConfig = require('./webpack.base.config');
const { merge } = require('webpack-merge');

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
  plugins: [
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
    }),
  ],
};

module.exports = merge(webpackBaseConfig, webpackDevConfig);
