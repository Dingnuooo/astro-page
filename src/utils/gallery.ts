const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)

// Escape all content before restoring the one supported Markdown construct.
export const renderGallerySubtitle = (subtitle: unknown) => {
  const escaped = escapeHtml(typeof subtitle === 'string' ? subtitle : '')

  return escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-white underline decoration-white/60 underline-offset-2 hover:decoration-white">$1</a>'
  )
}
