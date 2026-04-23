import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'
import type { Root } from 'mdast'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { SearchIndexPayload } from '../types/search'

// Extract text content from markdown AST, removing markdown syntax.
function extractText(node: Root): string {
  const textParts: string[] = []

  visit(node, (currentNode) => {
    if (currentNode.type === 'text') {
      textParts.push(currentNode.value)
    } else if (currentNode.type === 'code' && 'value' in currentNode) {
      textParts.push(currentNode.value)
    }
  })

  return textParts.join(' ').replace(/\s+/g, ' ').trim()
}

function getSlug(entry: CollectionEntry<'blog'>): string {
  return `blog/${entry.id}`
}

export async function buildSearchIndex(): Promise<SearchIndexPayload> {
  const blogPosts = await getCollection('blog', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true
  })

  const contentIndex: SearchIndexPayload = []

  for (const entry of blogPosts) {
    if (!entry.body) continue

    const ast = unified().use(remarkParse).parse(entry.body) as Root

    contentIndex.push({
      slug: getSlug(entry),
      title: entry.data.title || '',
      content: extractText(ast),
      tags: entry.data.tags || []
    })
  }

  return contentIndex
}
