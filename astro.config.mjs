import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

const site = 'https://acomerca.com';

export default defineConfig({
  site,
  integrations: [
    icon({
      include: {
        logos: ['whatsapp-icon', 'instagram-icon', 'tiktok-icon', 'facebook'],
        mdi: [
          'map-marker-outline',
          'email-outline',
          'phone-outline',
          'clock-outline',
          'card-account-details-outline',
        ],
      },
    }),
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/gracias') &&
        !page.includes('/404'),
      serialize(item) {
        const homepage = item.url === `${site}/` || item.url === site;
        return {
          ...item,
          changefreq: homepage ? 'weekly' : 'monthly',
          priority: homepage ? 1 : 0.6,
        };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  devToolbar: {
    enabled: false,
  },
});
