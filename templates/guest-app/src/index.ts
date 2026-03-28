import { defineGuestApp } from '@ensemble-edge/guest';
import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';

const app = defineGuestApp({
  manifest: {
    id: 'my-app',
    name: 'My App',
    version: '1.0.0',
    permissions: ['read:user'],
    entry: '/',
  },
  onInit: async () => {
    console.log('App initialized');
  },
});

export default createGuestWorker(app);
