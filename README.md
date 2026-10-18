# DUEXBROX Shopify Theme

DUEXBROX streetwear store ka Shopify theme. Base: unmodified [Shopify Horizon](https://github.com/Shopify/horizon) **v4.3.0** (commit `dfad90d`).

## Structure

Standard Shopify theme folders repo root par hain: `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`. Shopify GitHub integration isi structure ko read karti hai.

## Conventions

- Custom DUEXBROX work self-contained files mein: `sections/dx-*.liquid` (markup + scoped CSS/JS + schema).
- CSS classes `dx-` prefix ke sath, taake Horizon styles se clash na ho.
- Horizon ki core files sirf zaroorat par edit hon, taake future Horizon updates merge karna aasaan rahe.
- Product data hardcode nahi hota; settings / product / collection objects use hote hain.

## Shopify connection

Ye repo Shopify admin > Online Store > Themes > Add theme > Connect from GitHub ke through connect hota hai. Theme Editor mein ki gayi changes Shopify khud is branch par commit karta hai, is liye kaam shuru karne se pehle hamesha latest pull karein.

Horizon license: `LICENSE.md`. Horizon release notes: `HORIZON-RELEASE-NOTES.md`.
