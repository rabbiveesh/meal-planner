import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'system',
    themes: {
      light: { colors: { primary: '#2e7d32', secondary: '#f57c00' } },
      dark: { colors: { primary: '#81c784', secondary: '#ffb74d' } },
    },
  },
  defaults: {
    VBtn: { size: 'large' },
    VCard: { rounded: 'lg' },
  },
})
