export default {
  plugins: [require.resolve('@bymejs/plugin-bundler')],
  bundler: {
    path: require.resolve('./bundle'),
  },
};
