(async () => {
  const includeTargets = document.querySelectorAll('[data-include]');
  for (const el of includeTargets) {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url, {cache: 'no-cache'});
      el.outerHTML = await res.text();
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }
})();
