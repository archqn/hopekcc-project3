import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      //'/': '127.0.0.1:8000/classroom',

    },
    https: {

      key: fs.readFileSync('./key.pem'),  // Path to key.pem
      cert: fs.readFileSync('./cert.pem') // Path to cert.pem

    },
  },
  plugins: [react()],
  //base: '/classroom/',
  base: '/',
})
