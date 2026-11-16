export const nav = (path) => {
  location.hash = '#/' + path;
  scrollTo({ top: 0 });
};

// "#/p/<id>/team?q=yossi" → "yossi". Lets search results open an app already filtered.
export const routeQuery = () => {
  const m = location.hash.match(/\?q=(.*)$/);
  try {
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
};
