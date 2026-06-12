import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'vendor-mui'
          }

          if (id.includes('@radix-ui')) {
            return 'vendor-radix'
          }

          if (
            id.includes('react-dnd') ||
            id.includes('react-resizable-panels') ||
            id.includes('embla-carousel-react') ||
            id.includes('react-slick') ||
            id.includes('recharts')
          ) {
            return 'vendor-heavy-ui'
          }

          if (
            id.includes('leaflet') ||
            id.includes('react-leaflet') ||
            id.includes('@googlemaps') ||
            id.includes('react-native-maps')
          ) {
            return 'vendor-maps'
          }

          if (
            id.includes('react-router') ||
            id.includes('@tanstack/react-query') ||
            id.includes('@supabase/supabase-js')
          ) {
            return 'vendor-app'
          }

          if (
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          ) {
            return 'vendor-react'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
