<script setup lang="ts">
const paths: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9v12h14V9', 'M9 21v-7h6v7'],
  map: ['m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15', 'M15 6v15'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'm19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.4.8l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.4-.8l-1.8.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.6l-1.4-1.1 1.4-2.4 1.8.6a8 8 0 0 1 1.4-.8l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.4.8l1.8-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.6z'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  layers: ['m12 3 9 5-9 5-9-5z', 'm3 12 9 5 9-5', 'm3 16 9 5 9-5'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.4-4.4'],
  homepin: ['M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z', 'M12 6v6', 'M9 9h6'],
  sun: ['M12 3v2', 'M12 19v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M3 12h2', 'M19 12h2', 'm4.9 19.1 1.4-1.4', 'm17.7 6.3 1.4-1.4', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'],
  moon: ['M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z'],
  person: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
  lock: ['M5 10h14v11H5z', 'M8 10V7a4 4 0 1 1 8 0v3'],
}

defineProps<{ name: string; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="path in paths[name]" :key="path" :d="path" />
  </svg>
</template>
