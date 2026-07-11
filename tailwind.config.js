/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        panel: '#1e1e1e',
        sidebar: '#252526',
        'tab-bar': '#2d2d2d',
        border: '#3c3c3c',
        accent: '#0078d4',
      }
    }
  },
  plugins: []
}
