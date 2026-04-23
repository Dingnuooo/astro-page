import type { SearchDocument, SearchIndexPayload } from '../../types/search'

interface SearchResultEntry {
  id: number
}

interface SearchableDocument extends SearchDocument {
  id: number
  [key: string]: string | number | boolean | null | Array<string | number | boolean | null>
}

interface SearchResultBucket {
  result?: Array<number | SearchResultEntry>
}

interface SearchEngine {
  addAsync: (id: number, item: SearchableDocument) => Promise<unknown>
  searchAsync: (
    query: string,
    options: {
      limit: number
      index: string[]
      enrich: boolean
    }
  ) => Promise<SearchResultBucket[]>
}

interface SearchContext {
  documents: SearchIndexPayload
  index: SearchEngine
}

interface SearchElements {
  input: HTMLInputElement
  clear: HTMLButtonElement
  results: HTMLElement
  status: HTMLElement
}

declare global {
  interface Window {
    __SEARCH_DOCUMENTS__?: SearchIndexPayload
  }
}

// Encoder for CJK (Chinese, Japanese, Korean) languages with bigram support
const encoder = (str: string): string[] => {
  const tokens: string[] = []
  const lower = str.toLowerCase()
  
  const chars: Array<{ char: string; isCJK: boolean }> = []
  
  // First pass: categorize each character
  for (const char of lower) {
    const code = char.codePointAt(0)!
    const isCJK =
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) || // Katakana
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0xac00 && code <= 0xd7af) || // Hangul
      (code >= 0x20000 && code <= 0x2a6df)  // CJK Extension B
    
    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13
    
    if (!isWhitespace) {
      chars.push({ char, isCJK })
    }
  }
  
  // Second pass: generate tokens
  let buffer = ''
  let lastWasCJK = false
  
  for (let i = 0; i < chars.length; i++) {
    const { char, isCJK } = chars[i]
    
    if (isCJK) {
      // Flush non-CJK buffer
      if (buffer && !lastWasCJK) {
        tokens.push(buffer)
        buffer = ''
      }
      
      // Add single character
      tokens.push(char)
      
      // Add bigram (2-character combinations)
      if (i + 1 < chars.length && chars[i + 1].isCJK) {
        tokens.push(char + chars[i + 1].char)
      }
      
      // Add trigram (3-character combinations) for better phrase matching
      if (i + 2 < chars.length && chars[i + 1].isCJK && chars[i + 2].isCJK) {
        tokens.push(char + chars[i + 1].char + chars[i + 2].char)
      }
      
      lastWasCJK = true
    } else {
      // Flush CJK mode
      if (lastWasCJK && buffer) {
        tokens.push(buffer)
        buffer = ''
      }
      
      buffer += char
      lastWasCJK = false
    }
  }
  
  // Flush remaining buffer
  if (buffer) {
    tokens.push(buffer)
  }
  
  return tokens
}

const contextWindowWords = 15
let searchContextPromise: Promise<SearchContext> | null = null

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(searchTerm: string, text: string): string {
  if (!searchTerm || !text) return text
  
  const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.trim())
  let result = text
  
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi')
    result = result.replace(regex, '<mark>$1</mark>')
  }
  
  return result
}

function createExcerpt(content: string, searchTerm: string): string {
  if (!searchTerm) return content.slice(0, 200) + '...'
  
  const terms = searchTerm.toLowerCase().split(/\s+/)
  const words = content.split(/\s+/)
  
  // Find first occurrence of any search term
  let matchIndex = -1
  for (let i = 0; i < words.length; i++) {
    if (terms.some(term => words[i].toLowerCase().includes(term))) {
      matchIndex = i
      break
    }
  }
  
  if (matchIndex === -1) return content.slice(0, 200) + '...'
  
  const start = Math.max(0, matchIndex - contextWindowWords)
  const end = Math.min(words.length, matchIndex + contextWindowWords)
  
  const excerpt = words.slice(start, end).join(' ')
  return (start > 0 ? '...' : '') + excerpt + (end < words.length ? '...' : '')
}

function resolveUrl(slug: string): string {
  if (slug.startsWith('/')) return slug
  return `/${slug}`
}

function setStatus(statusElement: HTMLElement, message?: string) {
  if (!message) {
    statusElement.hidden = true
    return
  }
  
  statusElement.textContent = message
  statusElement.hidden = false
}

function clearResults(resultsElement: HTMLElement) {
  resultsElement.innerHTML = ''
  resultsElement.hidden = true
}

function setClearVisible(clearButton: HTMLButtonElement, visible: boolean) {
  clearButton.hidden = !visible
}

async function createSearchEngine(): Promise<SearchEngine> {
  const { default: FlexSearch } = await import('flexsearch')
  
  return new FlexSearch.Document<SearchableDocument>({
    encode: encoder,
    tokenize: 'forward',
    document: {
      id: 'id',
      tag: 'tags',
      index: ['title', 'content']
    }
  }) as SearchEngine
}

async function loadContentIndex(): Promise<SearchIndexPayload> {
  const embeddedDocuments = window.__SEARCH_DOCUMENTS__
  if (Array.isArray(embeddedDocuments) && embeddedDocuments.length > 0) {
    return embeddedDocuments
  }

  const response = await fetch('/contentIndex.json')
  if (!response.ok) {
    throw new Error(`Failed to fetch contentIndex.json: ${response.status}`)
  }
  
  return response.json() as Promise<SearchIndexPayload>
}

async function fillIndex(index: SearchEngine, documents: SearchIndexPayload) {
  await Promise.all(
    documents.map((document: SearchDocument, id: number) =>
      index.addAsync(id, {
        id,
        ...document
      })
    )
  )
}

function prepareSearchContext(): Promise<SearchContext> {
  if (!searchContextPromise) {
    searchContextPromise = Promise.all([loadContentIndex(), createSearchEngine()])
      .then(async ([documents, index]) => {
        await fillIndex(index, documents)
        return { documents, index }
      })
      .catch((error) => {
        searchContextPromise = null
        throw error
      })
  }
  
  return searchContextPromise
}

function scheduleSearchWarmup() {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => {
      void prepareSearchContext()
    }, { timeout: 1200 })
    return
  }
  
  window.setTimeout(() => {
    void prepareSearchContext()
  }, 0)
}

function collectResultIds(searchResults: SearchResultBucket[]): number[] {
  const resultIds = new Set<number>()
  
  for (const result of searchResults) {
    if (!result.result || !Array.isArray(result.result)) continue
    
    for (const item of result.result) {
      if (typeof item === 'number') {
        resultIds.add(item)
        continue
      }
      
      if (typeof item === 'object' && item !== null && 'id' in item) {
        resultIds.add(item.id)
      }
    }
  }
  
  return Array.from(resultIds)
}

function filterRelevantResults(documents: SearchIndexPayload, resultIds: number[], query: string): number[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  
  return resultIds
    .filter((id) => {
      const item = documents[id]
      if (!item) return false
      
      const titleLower = item.title.toLowerCase()
      const contentLower = item.content.toLowerCase()
      
      return terms.every((term) => titleLower.includes(term) || contentLower.includes(term))
    })
    .slice(0, 10)
}

function displayResults(resultsElement: HTMLElement, documents: SearchIndexPayload, resultIds: number[], query: string) {
  resultsElement.innerHTML = ''
  resultsElement.hidden = false
  
  if (resultIds.length === 0) {
    const message = document.createElement('p')
    message.className = 'pagefind-ui__message'
    message.textContent = `No results for "${query}"`
    resultsElement.appendChild(message)
    return
  }
  
  const heading = document.createElement('p')
  heading.className = 'pagefind-ui__results-heading'
  heading.textContent = `${resultIds.length} result${resultIds.length === 1 ? '' : 's'} for "${query}"`
  resultsElement.appendChild(heading)
  
  const resultsList = document.createElement('ol')
  resultsList.className = 'pagefind-ui__results'
  
  for (const id of resultIds) {
    const item = documents[id]
    if (!item) continue
    
    const li = document.createElement('li')
    li.className = 'pagefind-ui__result'
    
    const link = document.createElement('a')
    link.className = 'pagefind-ui__result-link'
    link.href = resolveUrl(item.slug)
    
    const title = document.createElement('p')
    title.className = 'pagefind-ui__result-title'
    title.innerHTML = highlight(query, item.title)
    
    const excerpt = document.createElement('p')
    excerpt.className = 'pagefind-ui__result-excerpt'
    excerpt.innerHTML = highlight(query, createExcerpt(item.content, query))
    
    link.appendChild(title)
    link.appendChild(excerpt)
    
    if (item.tags.length > 0) {
      const tags = document.createElement('p')
      tags.className = 'pagefind-ui__result-tags'
      tags.innerHTML = item.tags.map((tag: string) => `<span class="pagefind-ui__result-tag">${tag}</span>`).join('')
      link.appendChild(tags)
    }
    
    li.appendChild(link)
    resultsList.appendChild(li)
  }
  
  resultsElement.appendChild(resultsList)
}

function getSearchElements(): SearchElements | null {
  const input = document.querySelector<HTMLInputElement>('[data-search-input]')
  const clear = document.querySelector<HTMLButtonElement>('[data-search-clear]')
  const results = document.querySelector<HTMLElement>('[data-search-results]')
  const status = document.querySelector<HTMLElement>('[data-search-status]')
  
  if (!input || !clear || !results || !status) {
    return null
  }
  
  return { input, clear, results, status }
}

function initSearch() {
  const elements = getSearchElements()
  if (!elements) return
  
  let debounceTimer: number | undefined
  let requestId = 0
  
  const updateIdleStatus = () => {
    if (elements.input.value.trim()) return
    
    void prepareSearchContext()
      .then(() => {
        if (!elements.input.value.trim()) {
          setStatus(elements.status)
        }
      })
      .catch((error) => {
        console.error('Failed to warm search index:', error)
        if (!elements.input.value.trim()) {
          setStatus(elements.status, 'Search is temporarily unavailable.')
        }
      })
  }
  
  const performSearch = async (query: string) => {
    const currentRequestId = ++requestId
    
    if (!query) {
      clearResults(elements.results)
      updateIdleStatus()
      return
    }
    
    setStatus(elements.status, 'Preparing search index...')
    
    try {
      const { documents, index } = await prepareSearchContext()
      if (currentRequestId !== requestId) return
      
      setStatus(elements.status, 'Searching...')
      const searchResults = await index.searchAsync(query, {
        limit: 30,
        index: ['title', 'content'],
        enrich: true
      })
      if (currentRequestId !== requestId) return
      
      const filteredResults = filterRelevantResults(documents, collectResultIds(searchResults), query)
      displayResults(elements.results, documents, filteredResults, query)
      setStatus(elements.status)
    } catch (error) {
      if (currentRequestId !== requestId) return
      
      console.error('Search error:', error)
      clearResults(elements.results)
      setStatus(elements.status, 'Search is temporarily unavailable.')
    }
  }
  
  const handleInput = () => {
    const query = elements.input.value.trim()
    setClearVisible(elements.clear, Boolean(query))
    
    if (debounceTimer !== undefined) {
      window.clearTimeout(debounceTimer)
    }
    
    if (!query) {
      requestId += 1
      clearResults(elements.results)
      updateIdleStatus()
      return
    }
    
    setStatus(elements.status, 'Preparing search index...')
    debounceTimer = window.setTimeout(() => {
      void performSearch(query)
    }, 200)
  }
  
  elements.input.addEventListener('focus', () => {
    void prepareSearchContext()
  })
  elements.input.addEventListener('input', handleInput)
  
  elements.clear.addEventListener('click', () => {
    requestId += 1
    elements.input.value = ''
    setClearVisible(elements.clear, false)
    clearResults(elements.results)
    updateIdleStatus()
    elements.input.focus()
  })
  
  const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim()
  if (initialQuery) {
    elements.input.value = initialQuery
    setClearVisible(elements.clear, true)
    void performSearch(initialQuery)
  } else {
    scheduleSearchWarmup()
    updateIdleStatus()
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch)
} else {
  initSearch()
}
