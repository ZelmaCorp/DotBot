const path = require('path');

module.exports = {
  babel: {
    plugins: ['@babel/plugin-transform-class-static-block'],
  },
  webpack: {
    alias: {
      '@dotbot/core': path.resolve(__dirname, '../lib/dotbot-core'),
    },
  },
};



