const path = require('path');
const webpackBaseConfig = require('./webpack.base.config');
const { mergeWithRules, CustomizeRule } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const webpackProdConfig = {
  mode: 'production',
  entry: {
    pieChart3d: './src/plugin/index.js',
  },
  output: {
    path: path.resolve(__dirname, '../es'),
    publicPath: '/es/',
    filename: '[name].js',
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.sass$/,
        use: ['style-loader', 'css-loader', 'sass-loader?indentedSyntax'],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ extractComments: false }), new CssMinimizerWebpackPlugin()],
  },
  externals: [
    {
      three: true,
      gsap: true,
      'd3-shape': true,
      mitt: true,
    },
    /^lodash/,
  ],
  plugins: [new CleanWebpackPlugin(), new MiniCssExtractPlugin()],
};

module.exports = mergeWithRules({
  module: {
    rules: {
      test: CustomizeRule.Match,
      use: CustomizeRule.Replace,
    },
  },
})(webpackBaseConfig, webpackProdConfig);
