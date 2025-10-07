// Replace any <div data-include="/path.html"></div> with the file's contents
(async () => {
  const nodes = document.querySelectorAll('[data-include]');
  for (const el of nodes) {
    const url = el.getAttribute('data-include');
    try {
      const html = await fetch(url, { cache: 'no-cache' }).then(r => r.text());
      el.outerHTML = html;
    } catch (e) {
      console.error('Include failed for', url, e);
    }
  }
  // Set year if footer has the span
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
