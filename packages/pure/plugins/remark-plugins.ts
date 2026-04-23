import type { Image, Node, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// Cannot use '../utils' for plugin absolute path
import mdastToString from '../utils/mdast-util-to-string'
import getReadingTime from '../utils/reading-time'

/**
 * [Dingnuooo changes] remarkImageSize
 * Remark plugin to add width to images from alt text
 * Syntax: ![alt text|width](image.png)
 * Example: ![My Image|500](./image.png) will set max-width to 500px
 * Uses max-width so that MediumZoom can display original size when clicked.
 * If the specified width exceeds the available width, it gracefully falls back
 * to the default responsive rendering.
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
        
        // Clamp the requested width to the available width. When the viewport
        // is narrower than the requested size, this behaves the same as the
        // default responsive image rendering.
        node.data.hProperties.style = `max-width: min(${width}px, 100%); height: auto;`
      }
    })
  }
}

export const remarkAddZoomable: Plugin<[{ className?: string }], Root> = function ({
  className = 'zoomable'
}) {
  return function (tree) {
    visit(tree, 'image', (node: Image) => {
      // Preserve existing data and hProperties from remarkImageSize
      if (!node.data) {
        node.data = {}
      }
      if (!node.data.hProperties) {
        node.data.hProperties = {}
      }
      
      // Add zoomable class while preserving existing properties
      node.data.hProperties = {
        ...node.data.hProperties,
        class: className
      }
    })
  }
}

export const remarkReadingTime: Plugin<[], Root> =
  () =>
  (tree, { data }) => {
    const textOnPage = mdastToString(tree)
    const readingTime = getReadingTime(textOnPage)
    // readingTime.text will give us minutes read as a friendly string,
    // i.e. "3 min"
    if (data.astro?.frontmatter) {
      data.astro.frontmatter.minutesRead = readingTime.text
      data.astro.frontmatter.words = readingTime.words
    }
  }
