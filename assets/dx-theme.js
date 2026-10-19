/* DUEXBROX shared behaviour. No dependencies. Each feature binds to data-dx-* hooks
   and is safe to run again after a Theme Editor section reload. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const once = (el, key) => {
    if (el.dataset[key]) return false;
    el.dataset[key] = '1';
    return true;
  };

  /* ---------- Money + cart helpers (shared with dx-product.js / dx-cart) ---------- */
  const DX = (window.DX = window.DX || {});

  DX.formatMoney = (cents, format) => {
    const fmt = format || DX.moneyFormat || '{{amount}}';
    const value = Number(cents) || 0;
    const fix = (n, decimals, thousands = ',', dec = '.') => {
      const parts = (n / 100).toFixed(decimals).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return parts.join(decimals ? dec : '');
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return fix(value, 0);
        case 'amount_with_comma_separator': return fix(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fix(value, 0, '.');
        case 'amount_with_apostrophe_separator': return fix(value, 2, "'");
        case 'amount_with_space_separator': return fix(value, 2, ' ', ',');
        default: return fix(value, 2);
      }
    });
  };

  DX.setCartCount = (count) => {
    document.querySelectorAll('[data-dx-cart-count]').forEach((el) => {
      el.textContent = count;
    });
  };

  DX.refreshCart = async () => {
    try {
      const res = await fetch((window.Shopify?.routes?.root || '/') + 'cart.js', { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      DX.setCartCount(cart.item_count);
      document.dispatchEvent(new CustomEvent('dx:cart', { detail: cart }));
      return cart;
    } catch (e) {
      return null;
    }
  };

  DX.toast = (html, ms = 4200) => {
    let t = document.querySelector('.dx-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'dx-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.innerHTML = html;
    requestAnimationFrame(() => t.classList.add('is-on'));
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('is-on'), ms);
  };

  // Keep the header count right when other parts of the theme change the cart, and after bfcache restores.
  document.addEventListener('cart:update', () => DX.refreshCart());
  window.addEventListener('pageshow', (e) => e.persisted && DX.refreshCart());

  /* ---------- Cart drawer (sections/dx-cart-drawer.liquid) ----------
     Content always comes from Shopify: the section is re-rendered through the Section Rendering API
     after each /cart/change.js call, so totals, discounts and variants stay exact. */
  const CD_ID = 'dx-cart-drawer';
  const root = () => window.Shopify?.routes?.root || '/';
  const drawer = () => document.querySelector('[data-dx-cart-drawer]');
  const onCartPage = () => (document.querySelector('main')?.dataset.template || '').startsWith('cart');
  let lastFocus = null;

  const swapDrawer = (html) => {
    const el = drawer();
    if (!el || !html) return;
    const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-dx-cart-drawer]');
    if (!fresh) return;
    el.querySelector('.dx-cd__panel').innerHTML = fresh.querySelector('.dx-cd__panel').innerHTML;
    el.dataset.count = fresh.dataset.count;
    DX.setCartCount(fresh.dataset.count);
  };

  DX.renderCartDrawer = async () => {
    try {
      const res = await fetch(`${root()}?sections=${CD_ID}`, { headers: { Accept: 'application/json' } });
      const json = await res.json();
      swapDrawer(json[CD_ID]);
    } catch (e) { /* keep what is on screen */ }
  };

  const focusables = (el) =>
    [...el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (n) => n.offsetParent !== null
    );

  DX.openCart = async ({ refresh = true } = {}) => {
    const el = drawer();
    if (!el || el.dataset.enabled === 'false' || onCartPage()) return false;
    if (refresh) await DX.renderCartDrawer();
    lastFocus = document.activeElement;
    document.dispatchEvent(new CustomEvent('dx:menu-close'));
    el.classList.add('is-open');
    document.documentElement.classList.add('dx-lock');
    requestAnimationFrame(() => el.querySelector('.dx-cd__panel')?.focus({ preventScroll: true }));
    return true;
  };

  DX.closeCart = () => {
    const el = drawer();
    if (!el || !el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    document.documentElement.classList.remove('dx-lock');
    lastFocus?.focus?.({ preventScroll: true });
  };

  const changeLine = async (key, quantity) => {
    const el = drawer();
    const row = el?.querySelector(`.dx-cd__row[data-key="${CSS.escape(key)}"]`);
    el?.classList.add('is-busy');
    row?.classList.add('is-busy');
    try {
      const res = await fetch(`${root()}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: key, quantity, sections: CD_ID, sections_url: location.pathname })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.description || json.message || 'Could not update the cart');
      swapDrawer(json.sections?.[CD_ID]);
      document.dispatchEvent(new CustomEvent('dx:cart', { detail: json }));
    } catch (ex) {
      await DX.renderCartDrawer();
      const err = drawer()?.querySelector('[data-dx-cd-err]');
      if (err) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    } finally {
      drawer()?.classList.remove('is-busy');
    }
  };

  let qtyTimer;
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-dx-cart-open]');
    if (opener) {
      const el = drawer();
      if (!el || el.dataset.enabled === 'false' || onCartPage()) return;
      e.preventDefault();
      DX.openCart();
      return;
    }
    if (!drawer()?.classList.contains('is-open')) return;
    if (e.target.closest('[data-dx-cd-close]')) {
      e.preventDefault();
      DX.closeCart();
      return;
    }
    const step = e.target.closest('[data-dx-cd-step]');
    if (step) {
      const input = step.parentElement.querySelector('[data-dx-cd-qty]');
      const inc = Number(input.step) || 1;
      input.value = Math.max(0, Number(input.value) + Number(step.dataset.dxCdStep) * inc);
      const key = step.closest('.dx-cd__row').dataset.key;
      clearTimeout(qtyTimer);
      qtyTimer = setTimeout(() => changeLine(key, Number(input.value)), 350);
      return;
    }
    const rm = e.target.closest('[data-dx-cd-remove]');
    if (rm) {
      e.preventDefault();
      changeLine(rm.closest('.dx-cd__row').dataset.key, 0);
    }
  });

  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-dx-cd-qty]')) return;
    clearTimeout(qtyTimer);
    changeLine(e.target.closest('.dx-cd__row').dataset.key, Math.max(0, Number(e.target.value) || 0));
  });

  document.addEventListener('keydown', (e) => {
    const el = drawer();
    if (!el?.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      DX.closeCart();
      return;
    }
    if (e.key === 'Enter' && e.target.matches('[data-dx-cd-qty]')) {
      e.preventDefault();
      e.target.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables(el.querySelector('.dx-cd__panel'));
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Other parts of the theme (or apps) that change the cart keep the drawer in sync.
  document.addEventListener('cart:update', () => drawer() && DX.renderCartDrawer());

  /* ---------- Announcement bar ---------- */
  const initAnnouncement = (root) => {
    if (!once(root, 'dxAnn')) return;
    const items = [...root.querySelectorAll('[data-dx-ann-item]')];
    if (items.length < 2) return;
    let i = items.findIndex((el) => el.classList.contains('is-on'));
    if (i < 0) i = 0;
    const delay = (Number(root.dataset.speed) || 5) * 1000;
    const opts = { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
    let timer;
    let anims = [];
    // Horizontal slide: "next" pushes the current message out to the left and brings the new one in
    // from the right; "previous" does the mirror image.
    const show = (n, dir = 1) => {
      anims.forEach((a) => a.finish());
      const prev = items[i];
      i = (n + items.length) % items.length;
      const next = items[i];
      if (prev === next) return;
      prev.classList.remove('is-on');
      prev.setAttribute('aria-hidden', 'true');
      next.classList.add('is-on');
      next.removeAttribute('aria-hidden');
      if (reduce.matches || !next.animate) return;
      prev.classList.add('is-out');
      anims = [
        prev.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], opts),
        next.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], opts)
      ];
      anims[0].onfinish = () => prev.classList.remove('is-out');
      anims[1].onfinish = () => (anims = []);
    };
    const play = () => {
      clearInterval(timer);
      timer = setInterval(() => show(i + 1, 1), delay);
    };
    root.querySelector('[data-dx-ann-prev]')?.addEventListener('click', () => { show(i - 1, -1); play(); });
    root.querySelector('[data-dx-ann-next]')?.addEventListener('click', () => { show(i + 1, 1); play(); });
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', () => clearInterval(timer));
    root.addEventListener('focusout', play);
    play();
  };

  /* ---------- Header: hide on scroll down, reveal (white) on scroll up ---------- */
  const initHeader = (root) => {
    if (!once(root, 'dxHd')) return;
    const bar = root.querySelector('.dx-hd');
    const wrap = root.querySelector('.dx-hd-wrap') || root;
    if (!bar) return;
    let lastY = window.scrollY;
    let ticking = false;
    const setH = () => document.documentElement.style.setProperty('--dx-hd-h', bar.offsetHeight + 'px');
    setH();
    new ResizeObserver(setH).observe(bar);

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const start = wrap.getBoundingClientRect().top + y;
      const limit = start + bar.offsetHeight;
      if (root.classList.contains('is-menu')) return;
      if (y <= start) {
        bar.classList.remove('is-stuck', 'is-up');
      } else if (y > limit) {
        if (!bar.classList.contains('is-stuck')) {
          bar.classList.add('is-stuck', 'is-instant');
          requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('is-instant')));
        }
        if (y < lastY - 2) bar.classList.add('is-up');
        else if (y > lastY + 2) bar.classList.remove('is-up');
      }
      lastY = y;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();

    // Mobile menu
    const toggle = root.querySelector('[data-dx-menu-toggle]');
    const panel = root.querySelector('[data-dx-menu]');
    if (toggle && panel) {
      const close = () => {
        root.classList.remove('is-menu');
        toggle.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
      };
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        root.classList.toggle('is-menu', open);
        toggle.setAttribute('aria-expanded', String(open));
        document.documentElement.style.overflow = open ? 'hidden' : '';
        if (open) panel.querySelector('a')?.focus();
      });
      document.addEventListener('keydown', (e) => e.key === 'Escape' && root.classList.contains('is-menu') && (close(), toggle.focus()));
      document.addEventListener('dx:menu-close', () => root.classList.contains('is-menu') && close());
      window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => e.matches && close());
    }
  };

  /* ---------- Carousel with position-aware arrows ---------- */
  const initCarousel = (root) => {
    if (!once(root, 'dxCar')) return;
    const track = root.querySelector('[data-dx-track]');
    const prev = root.querySelector('[data-dx-prev]');
    const next = root.querySelector('[data-dx-next]');
    if (!track) return;
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.hidden = track.scrollLeft <= 2;
      if (next) next.hidden = track.scrollLeft >= max;
    };
    // One card per click: 1-4 → 2-5 → 3-6 …
    const step = (dir) => {
      const item = track.children[0];
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const w = item ? item.getBoundingClientRect().width + gap : track.clientWidth;
      const max = track.scrollWidth - track.clientWidth;
      const idx = Math.round(track.scrollLeft / w) + dir;
      track.scrollTo({ left: Math.max(0, Math.min(max, idx * w)), behavior: reduce.matches ? 'auto' : 'smooth' });
    };
    prev?.addEventListener('click', () => step(-1));
    next?.addEventListener('click', () => step(1));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    new ResizeObserver(sync).observe(track);
    sync();
  };

  /* ---------- Accordion (details/summary with smooth height) ---------- */
  const initAccordion = (item) => {
    if (!once(item, 'dxAcc')) return;
    const summary = item.querySelector('summary');
    const body = item.querySelector('.dx-acc__a');
    if (!summary || !body) return;
    summary.addEventListener('click', (e) => {
      if (reduce.matches || !body.animate) return;
      e.preventDefault();
      if (item._anim) item._anim.cancel();
      const opening = !item.open;
      if (opening) item.open = true;
      const h = body.scrollHeight;
      item._anim = body.animate(
        { height: opening ? ['0px', h + 'px'] : [h + 'px', '0px'], opacity: opening ? [0, 1] : [1, 0] },
        { duration: 420, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
      );
      item._anim.onfinish = () => {
        item._anim = null;
        if (!opening) item.open = false;
      };
    });
  };

  /* ---------- Entrance reveal ---------- */
  let io;
  const initReveal = (el) => {
    if (!once(el, 'dxRv')) return;
    if (reduce.matches || !('IntersectionObserver' in window)) {
      el.classList.add('is-in');
      return;
    }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
  };

  /* ---------- Smooth scroll to the next section (hero "SCROLL") ---------- */
  const initScrollNext = (btn) => {
    if (!once(btn, 'dxNext')) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const section = btn.closest('.shopify-section');
      const target = section?.nextElementSibling;
      if (!target) return;
      const offset = 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  };

  /* ---------- Form validation (contact + newsletter) ---------- */
  const initForm = (form) => {
    if (!once(form, 'dxForm')) return;
    const fields = [...form.querySelectorAll('input, textarea')].filter((f) => f.type !== 'hidden');
    const check = (f) => {
      const wrap = f.closest('.dx-fld');
      if (!wrap) return f.checkValidity();
      const ok = f.checkValidity();
      wrap.classList.toggle('is-invalid', !ok);
      f.setAttribute('aria-invalid', String(!ok));
      const err = wrap.querySelector('.dx-fld__err');
      if (err && !ok) err.textContent = f.validity.valueMissing ? err.dataset.required : err.dataset.invalid;
      return ok;
    };
    fields.forEach((f) => f.addEventListener('blur', () => f.value && check(f)));
    fields.forEach((f) => f.addEventListener('input', () => f.closest('.dx-fld.is-invalid') && check(f)));
    form.addEventListener('submit', (e) => {
      const bad = fields.filter((f) => !check(f));
      if (bad.length) {
        e.preventDefault();
        bad[0].focus();
        return;
      }
      form.querySelector('[type="submit"]')?.classList.add('is-loading');
    });
  };

  /* ---------- Share ---------- */
  const initShare = (btn) => {
    if (!once(btn, 'dxShare')) return;
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url || location.href;
      const title = btn.dataset.title || document.title;
      if (navigator.share) {
        try { await navigator.share({ title, url }); } catch (e) { /* dismissed */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        DX.toast(btn.dataset.copied || 'Link copied');
      } catch (e) {
        window.prompt('Copy link', url);
      }
    });
  };

  /* ---------- Boot ---------- */
  const boot = (scope = document) => {
    scope.querySelectorAll('[data-dx-ann]').forEach(initAnnouncement);
    scope.querySelectorAll('[data-dx-header]').forEach(initHeader);
    scope.querySelectorAll('[data-dx-carousel]').forEach(initCarousel);
    scope.querySelectorAll('.dx-acc__item').forEach(initAccordion);
    scope.querySelectorAll('.dx-rv').forEach(initReveal);
    scope.querySelectorAll('[data-dx-next-section]').forEach(initScrollNext);
    scope.querySelectorAll('form[data-dx-validate]').forEach(initForm);
    scope.querySelectorAll('[data-dx-share]').forEach(initShare);
  };
  DX.boot = boot;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot());
  else boot();

  document.addEventListener('shopify:section:load', (e) => boot(e.target));
})();
