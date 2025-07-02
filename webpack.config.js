const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  // Build for standard web environment (good for service-worker, content script, popup)
  // Disable automatic chunk splitting so each entry emits a single file without dynamic loading.
  // This avoids Chrome MV3 restrictions on additional scripts that aren't declared in the manifest.
  target: 'web',
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts',
    options: './src/options/options.ts',
    'ai-worker': './src/ai/ai-worker.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ],
    parser: {
      javascript: {
        // Handle import.meta usage in transformers.js
        importMeta: false
      }
    }
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "path": false,
      "fs": false
    }
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: '.',
          transform(content, absoluteFrom) {
            const manifest = JSON.parse(content.toString());

            // 1. Background service worker
            if (manifest.background?.service_worker) {
              manifest.background.service_worker = manifest.background.service_worker.replace(/^dist\//, '');
            }

            // 2. Content scripts
            if (Array.isArray(manifest.content_scripts)) {
              manifest.content_scripts.forEach((cs) => {
                if (Array.isArray(cs.js)) {
                  cs.js = cs.js.map((p) => p.replace(/^dist\//, ''));
                }
              });
            }

            // 3. Web-accessible resources
            if (Array.isArray(manifest.web_accessible_resources)) {
              manifest.web_accessible_resources.forEach((war) => {
                if (Array.isArray(war.resources)) {
                  war.resources = war.resources.map((p) => p.replace(/^dist\//, ''));
                }
              });
            }

            return Buffer.from(JSON.stringify(manifest, null, 2));
          }
        },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/styles', to: 'styles' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      template: './src/options/options.html',
      filename: 'options.html',
      chunks: ['options']
    })
  ],
  optimization: {
    runtimeChunk: false,
    splitChunks: false
  },
  performance: {
    // Disable webpack performance warnings for Chrome extension
    // Extensions have different performance considerations than web apps
    hints: false,
    maxEntrypointSize: 2000000, // 2MB
    maxAssetSize: 2000000 // 2MB
  }
}; 