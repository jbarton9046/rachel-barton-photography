// /assets/include.js
// Inject partials, execute any <script> tags inside them, and
// wire the mobile drawer + reliably mark the current page link.

(async () => {
  // ---------- Helper: normalize paths and mark current nav link ----------
  const normalizePath = (href) => {
    const url = new URL(href, location.origin);
    return url.pathname
      .replace(/\/+/g, "/")
      .replace(/\/index\.html?$/i, "")
      .replace(/\.html?$/i, "")
      .replace(/\/$/, "") || "/";
  };

  const markCurrentNav = () => {
    const here = normalizePath(location.pathname);
    const links = document.querySelectorAll('.topbar nav.primary a[href]');
    if (!links.length) return false;

    links.forEach(a => {
      const target = normalizePath(a.href);
      if (target === here) {
        a.setAttribute('aria-current', 'page'); // mobile drawer hook
        a.classList.add('is-current');          // desktop hook
      } else {
        a.removeAttribute('aria-current');
        a.classList.remove('is-current');
      }
    });
    return true;
  };

  // ---------- Helper: wire the mobile drawer (idempotent) ----------
  const wireMobileDrawer = () => {
    const chk   = document.getElementById('navchk');
    const nav   = document.getElementById('site-menu') || document.querySelector('.topbar nav.primary');
    const label = document.querySelector('label[for="navchk"], .nav-toggle-8');

    if (!chk || !nav) return;

    // Prevent double binding
    if (chk.__wired) return;
    chk.__wired = true;

    const shiftTargets = () => [
      document.getElementById('content'),
      document.querySelector('[data-include="/partials/footer.html"]'),
      document.querySelector('.hero'),
      document.querySelector('.mobile-header-8 .left-cluster')
    ].filter(Boolean);

    const applyShift = (on) => {
      const tx = on ? 'translateX(var(--drawer-w))' : '';
      shiftTargets().forEach(el => { el.style.transform = tx; });
    };

    const sync = () => {
      const open = chk.checked;
      document.body.classList.toggle('drawer-open', open);
      if (label) label.setAttribute('aria-expanded', String(open));
      applyShift(open);
    };

    // Close on any link tap inside the drawer
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) { chk.checked = false; sync(); }
    });

    // Close on outside tap
    document.addEventListener('click', (e) => {
      if (!chk.checked) return;
      if (e.target.closest('nav.primary') || e.target.closest('label[for="navchk"], .nav-toggle-8')) return;
      chk.checked = false; sync();
    }, true);

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chk.checked) { chk.checked = false; sync(); }
    });

    chk.addEventListener('change', sync);

    // Initial sync on first wire
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sync, { once:true });
    } else {
      requestAnimationFrame(sync);
    }
  };

  // ---------- Include all [data-include] mounts ----------
  const mounts = document.querySelectorAll('[data-include]');
  for (const mount of mounts) {
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
        if (!node.querySelectorAll) return;
        node.querySelectorAll('script').forEach(old => {
          const s = document.createElement('script');
          for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
          if (!old.src) s.textContent = old.textContent || '';
          old.replaceWith(s);
        });
      });

      // If this include was (or contains) the navbar, mark current & wire drawer now
      const looksLikeNav =
        (typeof url === 'string' && url.includes('/partials/topnav.html')) ||
        nodes.some(n => n.querySelector && n.querySelector('.topbar nav.primary'));

      if (looksLikeNav) {
        markCurrentNav();
        requestAnimationFrame(markCurrentNav);
        // After the nav is present in DOM, wire the drawer
        wireMobileDrawer();
        requestAnimationFrame(wireMobileDrawer);
      }
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }

  // Final safety nets after all includes
  markCurrentNav();
  window.addEventListener('load', () => {
    markCurrentNav();
    wireMobileDrawer();
  }, { once:true });
})();
