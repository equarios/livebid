/** Safe font stacks for Super Look & theme (avoids broken CSS from free-typed stacks). */
export const BODY_FONT_PRESETS: Array<{ id: string; label: string; stack: string }> = [
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    stack: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'system',
    label: 'System UI',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  {
    id: 'georgia',
    label: 'Georgia (serif)',
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans',
    stack: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
  },
]

export const DISPLAY_FONT_PRESETS: Array<{ id: string; label: string; stack: string }> = [
  {
    id: 'syne',
    label: 'Syne',
    stack: "'Syne', 'Source Sans 3', system-ui, sans-serif",
  },
  {
    id: 'match-body',
    label: 'Same as body',
    stack: '',
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    stack: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'system',
    label: 'System UI',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
]
