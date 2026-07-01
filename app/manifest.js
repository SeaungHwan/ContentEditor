export default function manifest() {
  return {
    name: 'Shin Editor',
    short_name: 'Editor',
    description: '컨텐츠 에디터',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    lang: 'ko',
    "icons": [
    {
      "src": "/icon192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
  };
}
