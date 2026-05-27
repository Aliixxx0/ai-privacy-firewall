module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        target: "18",
        runtimeModule: "react-compiler-runtime",
      },
    ], // must run first
  ],
};

