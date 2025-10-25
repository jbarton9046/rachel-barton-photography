// /assets/include.js
// Inject partials, execute any <script> tags inside them, and
// reliably mark the current page link in the navbar.

(async () => {
  // ---- Helper: mark current page in the primary nav (idempotent) ----
  const markCurrentNav = () => {
    // Normalize any href/path: remove /index.html, .html, trailing slash; collapse slashes
    const normalize = (href) => {
      const url = new URL(href, location.origin);
      let p = url.pathname
        .replace(/\/+/g, "/")
        .replace(/\/index\.html?$/i, "")
        .replace(/\.html?$/i, "")
        .replace(/\/$/, "");
      return p === "" ? "/" : p;
    };

    const here = normalize(location.pathname);
    const links = document.querySelectorAll('.topbar nav.primary a[href]');
    if (!links.length) return false;

    links.forEach(a => {
      const target = normalize(a.href);
      if (target === here) {
        a.setAttribute('aria-current', 'page'); // mobile drawer hook
        a.classList.add('is-current');          // desktop highlight hook (no underline)
      } else {
        a.removeAttribute('aria-current');
        a.classList.remove('is-current');
      }
    });
    return true;
  };

  // ---- Include all [data-include] mounts ----
  const targets = document.querySelectorAll('[data-include]');
  for (const mount of targets) {
    const url = mount.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      const html = await res.text();

      // Parse fetched HTML into a fragment
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

      // If this include was the navbar (or contains it), mark active link now
      const looksLikeNav =
        (typeof url === 'string' && url.includes('/partials/topnav.html')) ||
        nodes.some(n => n.querySelector && n.querySelector('.topbar nav.primary'));
      if (looksLikeNav) {
        // try now and again on the next frame for safety
        markCurrentNav();
        requestAnimationFrame(markCurrentNav);
      }
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }

  // Run once more after all includes are done (covers slow parses)
  markCurrentNav();
  // And once the page is fully loaded, as a final safety net
  window.addEventListener('load', markCurrentNav, { once: true });
})();

/* === Stabilize submenu link clicks on mobile: ensure navigation isn't swallowed === */
(function(){
  function wireStableSubmenuClicks(){
    try{
      var menu = document.querySelector('.topbar .is-galleries-dropdown');
      if(!menu) return;
      var links = menu.querySelectorAll('a[href]');

      function startFreeze(){
        // Freeze the pushed layout while finger is down so nothing slides left
        document.documentElement.classList.add('submenu-tap');
        // safety timeout in case navigation is delayed
        setTimeout(function(){ document.documentElement.classList.remove('submenu-tap'); }, 700);
      }
      function endFreeze(){
        document.documentElement.classList.remove('submenu-tap');
      }

      links.forEach(function(a){
        // Freeze layout for the duration of the tap
        a.addEventListener('touchstart', startFreeze, { passive:true, capture:true });
        a.addEventListener('mousedown',   startFreeze, { capture:true });
        a.addEventListener('touchend',    endFreeze,   { passive:true, capture:true });
        a.addEventListener('mouseup',     endFreeze,   { capture:true });

        // Let the browser navigate, but prevent global click-outside handlers
        // from closing/re-rendering the drawer first.
        a.addEventListener('click', function(e){
          e.stopPropagation();
          // Fallback: if some script prevented default navigation, force it.
          if (e.defaultPrevented) {
            try { window.location.assign(a.href); } catch(_) {}
          }
        }, {capture:true});
      });
    }catch(e){ /* no-op */ }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(wireStableSubmenuClicks, 0); });
  }else{
    setTimeout(wireStableSubmenuClicks, 0);
  }
})();
