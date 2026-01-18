const webpack = require('webpack');

module.exports = {
  babel: {
    plugins: ['@babel/plugin-transform-class-static-block'],
  },
  webpack: {
    configure: (webpackConfig) => {
      // Provide process polyfill for React and dependencies that need process.env
      // Webpack's ProvidePlugin provides process via 'process/browser' package
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
        })
      );
      
      // Also add process to resolve.fallback to ensure it resolves correctly
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        process: require.resolve('process/browser'),
      };
      
      // Define process.env.NODE_ENV for React (REACT_APP_* vars are handled by CRA automatically)
      webpackConfig.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        })
      );
      
      // Handle node: protocol imports (strip "node:" prefix)
      // This is required for modules that use "node:worker_threads" etc.
      webpackConfig.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, '');
          }
        )
      );
      
      // Add minimal fallbacks for Node.js-only modules
      // These should be false in browser (not available)
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: false,
        worker_threads: false,
        child_process: false,
        net: false,
        tls: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
      };
      
      // Fix ajv/dist/compile/context module resolution for ajv-formats compatibility
      // This resolves the "Cannot find module 'ajv/dist/compile/context'" error
      // by ensuring webpack can find the module even when ajv versions are mixed
      // Use alias instead of fallback since this is a Node.js module path, not a browser polyfill
      try {
        const ajvContextPath = require.resolve('ajv/dist/compile/context');
        webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
        webpackConfig.resolve.alias['ajv/dist/compile/context'] = ajvContextPath;
      } catch (e) {
        // If direct resolution fails, try resolving from ajv package root
        try {
          const ajvPath = require.resolve('ajv/package.json');
          const ajvRoot = require('path').dirname(ajvPath);
          webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
          webpackConfig.resolve.alias['ajv/dist/compile/context'] = require('path').join(ajvRoot, 'dist/compile/context.js');
        } catch (err) {
          // Silently fail - webpack will handle it or error will surface during build
          console.warn('Could not resolve ajv/dist/compile/context:', err.message);
        }
      }
      
      return webpackConfig;
    },
  },
};
