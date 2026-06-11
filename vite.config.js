import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 단일 HTML 빌드: JS/CSS를 모두 index.html에 인라인해 file:// 로컬 실행을 지원한다.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
