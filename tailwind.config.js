/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        xiaoxiang: {
          paper: '#F7F6F0',
          celadon: '#8BA38D',
          bamboo: '#4A3C31',
          ink: '#2B2B2B',
          rose: '#C25953', // Deep, traditional red accent
        },
      },
      fontFamily: {
        serif: [
          '"Cormorant Garamond"',
          '"Playfair Display"',
          '"Noto Serif SC"',
          '"Songti SC"',
          '"Source Han Serif SC"',
          '"Microsoft YaHei"',
          'serif',
        ],
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
      },
      typography: (theme) => ({
        xiaoxiang: {
          css: {
            '--tw-prose-body': theme('colors.xiaoxiang.ink'),
            '--tw-prose-headings': theme('colors.xiaoxiang.ink'),
            '--tw-prose-links': theme('colors.xiaoxiang.celadon'),
            '--tw-prose-bold': theme('colors.xiaoxiang.bamboo'),
            '--tw-prose-quotes': theme('colors.xiaoxiang.bamboo'),
            '--tw-prose-quote-borders': theme('colors.xiaoxiang.celadon'),
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
