import type { Image, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Remark plugin to add width to images from alt text
 * Syntax: ![alt text|width](image.png)
 * Example: ![My Image|500](./image.png) will set width to 500px
 */
export const remarkImageSize: Plugin<[], Root> = function () {
  return function (tree) {
    visit(tree, 'image', (node: Image) => {
      if (!node.alt) return

      // Check if alt text contains size specification
      const match = node.alt.match(/^(.+?)\|(\d+)$/)
      if (match) {
        const [, actualAlt, width] = match
        
        // Update alt text to remove size specification
        node.alt = actualAlt.trim()
        
        // Add width to node data for HTML rendering
        if (!node.data) {
          node.data = {}
        }
        if (!node.data.hProperties) {
          node.data.hProperties = {}
        }
        
        // Set width style while preserving existing properties
        const existingClass = node.data.hProperties.class || ''
        node.data.hProperties = {
          ...node.data.hProperties,
          class: existingClass, // Preserve zoomable class if exists
          style: `width: ${width}px; height: auto;`
        }
      }
    })
  }
}
