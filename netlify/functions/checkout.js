// Netlify function: creates a Stripe Checkout session. Card details never touch your site.
// Env vars to set in Netlify: STRIPE_SECRET_KEY (sk_live_… or sk_test_…) and SITE_URL (e.g. https://nvme.co)
const PRICES = { // pence. Prices are set here, not trusted from the browser.
  'Monogram tee': 3500,
  'Wordmark tee': 3500,
  'Spike tee': 3500,
  'Full logo tee': 3500,
  'Classic joggers': 7500,
  'DY cap': 2800,
  'Bucket hat': 3000,
  'Grey sweatpants': 7500
};
const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let items;
  try { items = JSON.parse(event.body).items; } catch (e) { return json(400, { error: 'Bad request' }); }
  if (!Array.isArray(items) || !items.length || items.length > 50) return json(400, { error: 'Bad basket' });

  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('success_url', process.env.SITE_URL + '/?paid=1');
  p.append('cancel_url', process.env.SITE_URL + '/');
  p.append('shipping_address_collection[allowed_countries][0]', 'GB');
  p.append('shipping_address_collection[allowed_countries][1]', 'US');
  p.append('shipping_address_collection[allowed_countries][2]', 'IE');
  p.append('shipping_address_collection[allowed_countries][3]', 'DE');
  p.append('shipping_address_collection[allowed_countries][4]', 'FR');

  for (let i = 0; i < items.length; i++) {
    const it = items[i], price = PRICES[it.name], qty = Math.floor(+it.qty);
    if (!price || !(qty >= 1 && qty <= 99) || typeof it.size !== 'string' || it.size.length > 40) return json(400, { error: 'Bad item' });
    p.append(`line_items[${i}][quantity]`, String(qty));
    p.append(`line_items[${i}][price_data][currency]`, 'gbp');
    p.append(`line_items[${i}][price_data][unit_amount]`, String(price));
    p.append(`line_items[${i}][price_data][product_data][name]`, `${it.name} (${it.size})`);
  }

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p
  });
  const d = await r.json();
  if (!r.ok) return json(502, { error: 'Payment provider error' });
  return json(200, { url: d.url });
};
