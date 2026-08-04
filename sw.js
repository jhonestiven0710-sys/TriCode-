// ============================================================
// triCode — Service Worker
// Cachea los archivos base del juego (HTML/CSS/JS/íconos) para
// que la app abra al instante y funcione sin internet.
// El modo online sigue necesitando conexión real para jugar,
// pero la interfaz y el modo local funcionan sin problema.
// ============================================================

const CACHE_NAME = 'tricode-v1';

const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Instala el service worker y guarda los archivos base en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Limpia versiones de caché anteriores cuando se actualiza el juego
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Estrategia: intenta la red primero (para tener siempre lo último),
// y si no hay internet, responde con lo que haya en caché.
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
