// O Marketing mudou para universo.odisse.com.br/marketing/ (24/11/2026). Este service worker só se desliga e
// apaga o cache antigo nos navegadores que ainda tinham o do marketing.odisse.com.br.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
