const path = require('path');
const webpackBaseConfig = require('./webpack.base.config');
const { mergeWithRules, CustomizeRule } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const webpackProdConfig = {
  mode: 'production',
  target: ['web', 'es5'],
  entry: {
    demo: './src/plugin/index.js',
  },
  output: {
    path: path.resolve(__dirname, '../es'),
    publicPath: '/es/',
    filename: '[name].js',
    library: {
      name: '[name]',
      type: 'umd',
      umdNamedDefine: true,
    },
  },
  module: {
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
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin(), new CssMinimizerWebpackPlugin()],
  },
  externals: {},
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
