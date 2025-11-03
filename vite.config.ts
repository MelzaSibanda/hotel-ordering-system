
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'input-otp@1.4.2': 'input-otp',
        'figma:asset/5f7e92102992d37ad039f90a4366f1707e7a6962.png': path.resolve(__dirname, './src/assets/5f7e92102992d37ad039f90a4366f1707e7a6962.png'),
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        '@supabase/supabase-js@2': '@supabase/supabase-js',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      port: 3000,
      open: true,
      allowedHosts: ['egumeni-eat.onrender.com', 'egumeni-eat-gzgq.onrender.com'],
    },
    preview: {
      allowedHosts: ['egumeni-eat.onrender.com', 'egumeni-eat-gzgq.onrender.com'],
    },
  });