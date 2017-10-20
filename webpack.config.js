var webConfig = {
  entry: './src/protocol-ui.js',
  output: {
    filename: 'protocol-ui.js',
    // use library + libraryTarget to expose module globally
    library: 'ProtocolUI',
    libraryTarget: 'var'
  }
};

module.exports = webConfig;
