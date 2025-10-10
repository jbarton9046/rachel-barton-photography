// /assets/include.js  (drop-in replacement)
(async () => {
  const targets = document.querySelectorAll('[data-include]');
  for (const mount of targets) {
    const url = mount.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      const html = await res.text();

      // Parse the fetched HTML into a fragment
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;

      // Insert parsed nodes before the mount and remove the placeholder
      const parent = mount.parentNode;
      const nodes = Array.from(wrapper.childNodes);
      for (const n of nodes) parent.insertBefore(n, mount);
      parent.removeChild(mount);

      // Recreate any <script> tags so the browser executes them
      nodes.forEach(node => {
        if (node.querySelectorAll) {
          node.querySelectorAll('script').forEach(old => {
            const s = document.createElement('script');
            // copy attributes
            for (const { name, value } of Array.from(old.attributes)) {
              s.setAttribute(name, value);
            }
            // inline code
            if (!old.src) s.textContent = old.textContent || '';
            old.replaceWith(s);
          });
        }
      });
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }
})();
