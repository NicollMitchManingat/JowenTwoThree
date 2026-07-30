self.addEventListener('activate', () => {
  self.registration.unregister();
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
});
