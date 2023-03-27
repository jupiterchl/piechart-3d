const path = require('path');
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
  devServer: {
    historyApiFallback: true,
    open: true,
    compress: true,
    hot: true,
    port: 8080,
  },
  devtool: 'source-map',
};

module.exports = merge(webpackBaseConfig, webpackDevConfig);
