const C='drago-v3',F=['./','index.html','app.css','app.js','logo.svg','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('fetch',e=>{if(e.request.url.includes('/api'))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
