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
        // keep the page pushed right regardless of checkbox state
        document.body.classList.add('drawer-open');
        var navchk = document.getElementById('navchk');
        if (navchk) navchk.checked = true; // reassert open state if something toggles it
        // safety timeout in case navigation is delayed
        setTimeout(function(){
          document.documentElement.classList.remove('submenu-tap');
          // leave drawer-open; it will be cleared on unload below
        }, 700);
      }
      function cleanupFreeze(){
        document.documentElement.classList.remove('submenu-tap');
      }
      function removeLock(){
        document.body.classList.remove('drawer-open');
        document.documentElement.classList.remove('submenu-tap');
      }
      window.addEventListener('beforeunload', removeLock, { once:true });
      window.addEventListener('pagehide', removeLock, { once:true });

      links.forEach(function(a){
        // Freeze layout for the duration of the tap
        a.addEventListener('touchstart', startFreeze, { passive:true, capture:true });
        a.addEventListener('mousedown',   startFreeze, { capture:true });
        a.addEventListener('touchend',    cleanupFreeze, { passive:true, capture:true });
        a.addEventListener('mouseup',     cleanupFreeze, { capture:true });

        // Let the browser navigate, but prevent global click-outside handlers
        // from closing/re-rendering the drawer first.
        a.addEventListener('click', function(e){
          e.stopPropagation();
          // Fallback: if some script prevented default navigation, force it.
          if (e.defaultPrevented) {
            try { window.location.assign(a.href); } catch(_) {}
          }
          // Keep the drawer/push locked until the page changes
          document.body.classList.add('drawer-open');
          var navchk = document.getElementById('navchk');
          if (navchk) navchk.checked = true;
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

/* === Mobile-only: Flatten Galleries submenu into the same list (identical look) === */
(function(){
  var FL_CLASS = 'nav-flattened';
  function isMobile(){ return window.matchMedia('(max-width:820px)').matches; }

  function getNavBits(){
    var nav = document.querySelector('.topbar nav.primary');
    if (!nav) return {};
    var topUl = nav.querySelector('ul');
    if (!topUl) return {};
    var galleriesLi = topUl.querySelector('li.has-sub');
    if (!galleriesLi) return {};
    var dropdown = galleriesLi.querySelector('.dropdown, ul');
    return { nav, topUl, galleriesLi, dropdown };
  }

  function alreadyFlattened(topUl){
    return !!topUl.querySelector('li.nav-subitem[data-flattened="1"]');
  }

  function flattenOnce(){
    var bits = getNavBits();
    if (!bits.dropdown || !bits.galleriesLi || !bits.topUl) return;
    if (alreadyFlattened(bits.topUl)) return;

    // Insert cloned submenu items immediately after "Galleries"
    var afterNode = bits.galleriesLi;
    bits.dropdown.querySelectorAll('a[href]').forEach(function(link){
      var li = document.createElement('li');
      li.className = 'nav-subitem';
      li.setAttribute('data-flattened','1');

      var a = document.createElement('a');
      a.href = link.href;
      a.textContent = (link.textContent || '').trim();

      // Preserve current-page state if present
      if (link.getAttribute('aria-current') === 'page'){
        a.setAttribute('aria-current','page');
      }

      li.appendChild(a);
      afterNode.insertAdjacentElement('afterend', li);
      afterNode = li;
    });

    // Mark HTML so CSS can hide the original dropdown & style clones
    document.documentElement.classList.add(FL_CLASS);
  }

  function unflatten(){
    // Remove cloned items
    document.querySelectorAll('li.nav-subitem[data-flattened="1"]').forEach(function(li){
      li.remove();
    });
    document.documentElement.classList.remove(FL_CLASS);
  }

  function apply(){
    if (isMobile()) flattenOnce(); else unflatten();
  }

  // Run after the nav include is in the DOM
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(apply, 0); });
  }else{
    setTimeout(apply, 0);
  }
  // Re-evaluate on resize/orientation changes
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
})();
