import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
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
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  devToolbar: {
    enabled: false,
  },
});