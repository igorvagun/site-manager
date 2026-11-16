export const nav = (path) => {
  location.hash = '#/' + path;
  scrollTo({ top: 0 });
};
