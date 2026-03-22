import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',       // 'dark' | 'light'
      colorTheme: 'default', // theme ID from modules/themes/

      toggleTheme() {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.classList.toggle('dark',  next === 'dark');
        document.documentElement.classList.toggle('light', next === 'light');
      },

      setColorTheme(id) {
        set({ colorTheme: id });
        document.documentElement.setAttribute('data-theme', id);
      },

      initTheme() {
        const { theme, colorTheme } = get();
        document.documentElement.classList.toggle('dark',  theme === 'dark');
        document.documentElement.classList.toggle('light', theme === 'light');
        document.documentElement.setAttribute('data-theme', colorTheme);
      },
    }),
    { name: 'kth-theme' },
  ),
);
