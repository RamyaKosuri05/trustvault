/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          navy: '#14213D',
          blue: '#2563EB',
          canvas: '#F5F7FB',
          surface: '#FFFFFF',
          slate: '#1E293B',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
        }
      }
    },
  },
  plugins: [],
}
