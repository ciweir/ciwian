import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 构建后仍输出单个 HTML（内联 JS/CSS），保持"双击即玩"特性
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
})
