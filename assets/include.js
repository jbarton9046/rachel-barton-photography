// /assets/include.js
// Inject partials, execute any <script> tags inside them,
// and reliably mark the current page link in the navbar.

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
        a.setAttribute('aria-current', 'page'); // mobile overlay/drawer hook
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

/* === MOBILE UX helpers (compatible with overlay): freeze during submenu tap & flatten === */
(function(){
  const mq = window.matchMedia('(max-width:820px)');

  function freezeDuringTap(){
    try{
      const menu = document.querySelector('.topbar .is-galleries-dropdown') ||
                   document.querySelector('.topbar .has-sub .dropdown');
      if(!menu) return;
      const links = menu.querySelectorAll('a[href]');
      function startFreeze(){
        document.documentElement.classList.add('submenu-tap');
        document.body.classList.add('drawer-open'); // harmless for overlay
        const navchk = document.getElementById('navchk');
        if (navchk) navchk.checked = true;
        setTimeout(() => {
          document.documentElement.classList.remove('submenu-tap');
        }, 700);
      }
      function cleanup(){
        document.documentElement.classList.remove('submenu-tap');
      }
      links.forEach(a=>{
        a.addEventListener('touchstart', startFreeze, { passive:true, capture:true });
        a.addEventListener('mousedown',   startFreeze, { capture:true });
        a.addEventListener('touchend',    cleanup,     { passive:true, capture:true });
        a.addEventListener('mouseup',     cleanup,     { capture:true });
        a.addEventListener('click', (e)=>{
          e.stopPropagation();
          document.body.classList.add('drawer-open');
          const navchk = document.getElementById('navchk');
          if (navchk) navchk.checked = true;
        }, { capture:true });
      });
      window.addEventListener('beforeunload', () => {
        document.body.classList.remove('drawer-open');
        document.documentElement.classList.remove('submenu-tap');
      }, { once:true });
      window.addEventListener('pagehide', () => {
        document.body.classList.remove('drawer-open');
        document.documentElement.classList.remove('submenu-tap');
      }, { once:true });
    }catch(e){}
  }

  // Flatten Galleries submenu into same list (mobile only)
  let flattened = false;
  function flattenSubmenu(){
    if (!mq.matches) { unflatten(); return; }
    if (flattened) return;

    const nav = document.querySelector('.topbar nav.primary ul');
    const parentLi = nav && nav.querySelector('li.has-sub');
    const dropdown = parentLi && parentLi.querySelector(':scope > ul.dropdown');
    if (!nav || !parentLi || !dropdown) return;

    const afterNode = parentLi;
    const items = Array.from(dropdown.querySelectorAll(':scope > li > a[href]'));
    items.forEach(a => {
      const li = document.createElement('li');
      li.className = 'nav-subitem';
      const clone = a.cloneNode(true);
      li.appendChild(clone);
      afterNode.parentNode.insertBefore(li, afterNode.nextSibling);
    });

    document.documentElement.classList.add('nav-flattened');
    flattened = true;
  }

  function unflatten(){
    if (!flattened) return;
    document.querySelectorAll('nav.primary li.nav-subitem').forEach(li => li.remove());
    document.documentElement.classList.remove('nav-flattened');
    flattened = false;
  }

  function initMobileEnhancements(){
    if (!mq.matches) { unflatten(); return; }
    flattenSubmenu();
    freezeDuringTap();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
  } else {
    initMobileEnhancements();
  }
  mq.addEventListener('change', initMobileEnhancements);
})();
