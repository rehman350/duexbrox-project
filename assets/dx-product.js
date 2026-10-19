/* DUEXBROX product page: variant selection, availability, AJAX add to cart, sticky bar, size chart. */
(() => {
  const init = (root) => {
    if (!root || root.dataset.dxPdReady) return;
    root.dataset.dxPdReady = '1';
    const dataEl = root.querySelector('[data-dx-product-json]');
    if (!dataEl) return;
    const data = JSON.parse(dataEl.textContent);
    const DX = window.DX || {};
    DX.moneyFormat = data.moneyFormat;
    const money = (c) => (DX.formatMoney ? DX.formatMoney(c, data.moneyFormat) : (c / 100).toFixed(2));

    const form = root.querySelector('[data-dx-form]');
    const idInput = root.querySelector('[data-dx-variant-id]');
    const fieldsets = [...root.querySelectorAll('[data-dx-option]')];
    const addBtn = root.querySelector('[data-dx-add]');
    const addLabel = root.querySelector('[data-dx-add-label]');
    const stock = root.querySelector('[data-dx-stock]');
    const err = root.querySelector('[data-dx-error]');
    const dyn = root.querySelector('[data-dx-dyn]');
    const sticky = root.querySelector('[data-dx-sticky]');
    const stickyBtn = root.querySelector('[data-dx-sticky-add]');

    const selected = () => fieldsets.map((fs) => fs.querySelector('input:checked')?.value);

    const findVariant = (opts) =>
      data.variants.find((v) => v.options.every((o, i) => opts[i] === undefined || o === opts[i]));

    // Mark values that can't be bought together with the other current selections.
    const markAvailability = (opts) => {
      fieldsets.forEach((fs, idx) => {
        fs.querySelectorAll('input[type="radio"]').forEach((input) => {
          const test = [...opts];
          test[idx] = input.value;
          const v = data.variants.find((vv) => vv.options.every((o, i) => o === test[i]));
          const label = fs.querySelector(`label[for="${input.id}"]`);
          label?.classList.toggle('is-na', !v || !v.available);
        });
        const out = fs.querySelector('[data-dx-option-value]');
        if (out) out.textContent = opts[idx] || '';
      });
    };

    const stockText = (v) => {
      if (!v) return 'Unavailable';
      if (!v.available) return 'Sold out';
      if (v.inventory_management === 'shopify' && v.inventory_quantity > 0 && v.inventory_quantity <= data.lowStock) {
        return `Only ${v.inventory_quantity} left`;
      }
      return 'In stock';
    };

    const update = () => {
      const opts = selected();
      const v = findVariant(opts);
      markAvailability(opts);
      const ok = !!(v && v.available);
      if (v) {
        idInput.value = v.id;
        root.querySelector('[data-dx-price-now]').textContent = money(v.price);
        const was = root.querySelector('[data-dx-price-was]');
        if (was) {
          was.hidden = !(v.compare_at_price > v.price);
          if (v.compare_at_price) was.textContent = money(v.compare_at_price);
        }
        const url = new URL(location.href);
        url.searchParams.set('variant', v.id);
        history.replaceState(history.state, '', url);
        if (v.featured_media) {
          const fig = root.querySelector(`[data-media-id="${v.featured_media.id}"]`);
          const gallery = root.querySelector('[data-dx-gallery]');
          if (fig && gallery && getComputedStyle(gallery).display === 'flex') {
            gallery.scrollTo({ left: fig.offsetLeft - gallery.offsetLeft, behavior: 'smooth' });
          }
          const sImg = root.querySelector('[data-dx-sticky-img]');
          if (sImg && v.featured_media.preview_image?.src) {
            sImg.src = v.featured_media.preview_image.src + (v.featured_media.preview_image.src.includes('?') ? '&' : '?') + 'width=160';
            sImg.removeAttribute('srcset');
          }
        }
      }
      stock.textContent = stockText(v);
      stock.classList.toggle('is-in', ok);
      stock.classList.toggle('is-out', !ok);
      addBtn.disabled = !ok;
      addLabel.textContent = ok ? 'Add to cart' : v ? 'Sold out' : 'Unavailable';
      if (dyn) dyn.hidden = !ok;
      if (stickyBtn) {
        stickyBtn.disabled = !ok;
        stickyBtn.textContent = ok ? 'Add' : 'Sold out';
      }
      const sp = root.querySelector('[data-dx-sticky-price]');
      if (sp && v) sp.textContent = money(v.price);
      const sv = root.querySelector('[data-dx-sticky-variant]');
      if (sv && v) sv.textContent = v.title;
      if (err) err.hidden = true;
    };

    fieldsets.forEach((fs) => fs.addEventListener('change', update));
    if (fieldsets.length) markAvailability(selected());

    /* Add to cart via the AJAX Cart API; the form still posts normally if JS fails. */
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const buttons = [addBtn, stickyBtn].filter(Boolean);
      buttons.forEach((b) => b.classList.add('is-loading'));
      if (err) err.hidden = true;
      try {
        const body = new FormData(form);
        const res = await fetch((window.Shopify?.routes?.root || '/') + 'cart/add.js', {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body
        });
        const json = await res.json();
        if (!res.ok || json.status) throw new Error(json.description || json.message || 'Could not add to cart');
        addLabel.textContent = 'Added';
        setTimeout(update, 1600);
        await DX.refreshCart?.();
        if (await DX.openCart?.()) return;
        DX.toast?.(`<span>${json.product_title || 'Item'} added to cart</span><a href="${data.cartUrl}">View cart</a>`);
      } catch (ex) {
        if (err) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      } finally {
        buttons.forEach((b) => b.classList.remove('is-loading'));
      }
    });

    /* Sticky purchase bar: visible once the main Add to cart button scrolls out above the viewport. */
    if (sticky && addBtn && 'IntersectionObserver' in window) {
      const footer = document.querySelector('footer');
      let pastButton = false;
      let footerVisible = false;
      const sync = () => {
        const on = pastButton && !footerVisible;
        sticky.classList.toggle('is-on', on);
        sticky.setAttribute('aria-hidden', String(!on));
        if (stickyBtn) stickyBtn.tabIndex = on ? 0 : -1;
      };
      new IntersectionObserver(([en]) => {
        pastButton = !en.isIntersecting && en.boundingClientRect.top < 0;
        sync();
      }).observe(addBtn);
      if (footer) {
        new IntersectionObserver(([en]) => {
          footerVisible = en.isIntersecting && window.innerWidth < 900;
          sync();
        }).observe(footer);
      }
    }

    /* Size chart dialog */
    const dlg = root.querySelector('[data-dx-chart]');
    const openBtn = root.querySelector('[data-dx-chart-open]');
    if (dlg && openBtn) {
      openBtn.addEventListener('click', () => (dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '')));
      dlg.querySelector('[data-dx-chart-close]')?.addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
    }
  };

  const boot = () => document.querySelectorAll('[data-dx-product]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
