import FlexSearch from 'flexsearch'

interface ContentDetails {
  slug: string
  title: string
  content: string
  tags: string[]
  links: string[]
  collection: 'blog'
  publishDate?: string
}

interface ContentIndex {
  [slug: string]: ContentDetails
}

interface Item {
  id: number
  slug: string
  title: string
  content: string
  tags: string[]
  [key: string]: any // Index signature for FlexSearch compatibility
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

const index = new FlexSearch.Document<Item>({
  encode: encoder,
  tokenize: 'forward',
  document: {
    id: 'id',
    tag: 'tags',
    index: ['title', 'content']
  }
})

const contextWindowWords = 15

function highlight(searchTerm: string, text: string): string {
  if (!searchTerm || !text) return text
  
  const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.trim())
  let result = text
  
  for (const term of terms) {
    const regex = new RegExp(`(${term})`, 'gi')
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

async function setupSearch(containerElement: HTMLElement, data: ContentIndex) {
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.className = 'pagefind-ui__search-input'
  searchInput.placeholder = 'Search'
  searchInput.setAttribute('aria-label', 'Search')
  
  const searchClear = document.createElement('button')
  searchClear.className = 'pagefind-ui__search-clear'
  searchClear.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>`
  searchClear.style.display = 'none'
  searchClear.addEventListener('click', () => {
    searchInput.value = ''
    searchClear.style.display = 'none'
    resultsArea.innerHTML = ''
    resultsArea.style.display = 'none'
    searchInput.focus()
  })
  
  const searchWrapper = document.createElement('div')
  searchWrapper.className = 'pagefind-ui__search'
  searchWrapper.appendChild(searchInput)
  searchWrapper.appendChild(searchClear)
  
  const resultsArea = document.createElement('div')
  resultsArea.className = 'pagefind-ui__results-area'
  resultsArea.style.display = 'none'
  
  containerElement.appendChild(searchWrapper)
  containerElement.appendChild(resultsArea)
  
  const idDataMap = Object.keys(data)
  let debounceTimer: ReturnType<typeof setTimeout>
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim()
    
    if (query) {
      searchClear.style.display = 'block'
    } else {
      searchClear.style.display = 'none'
      resultsArea.innerHTML = ''
      resultsArea.style.display = 'none'
      return
    }
    
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      await performSearch(query)
    }, 300)
  })
  
  async function performSearch(query: string) {
    if (!query) {
      resultsArea.innerHTML = ''
      resultsArea.style.display = 'none'
      return
    }
    
    try {
      const searchResults = await index.searchAsync(query, {
        limit: 30, // Get more results to filter
        index: ['title', 'content'],
        enrich: true
      })
      
      const resultIds = new Set<number>()
      
      // Collect all result IDs
      for (const result of searchResults) {
        if (result.result && Array.isArray(result.result)) {
          for (const item of result.result) {
            if (typeof item === 'object' && item !== null && 'id' in item) {
              resultIds.add((item as any).id as number)
            } else if (typeof item === 'number') {
              resultIds.add(item)
            }
          }
        }
      }
      
      // Filter results to ensure they actually contain the search terms
      const filtered = filterRelevantResults(Array.from(resultIds), query)
      displayResults(filtered, query)
    } catch (error) {
      console.error('Search error:', error)
      displayResults([], query)
    }
  }
  
  function filterRelevantResults(resultIds: number[], query: string): number[] {
    const normalizedQuery = query.toLowerCase().trim()
    
    return resultIds.filter(id => {
      const slug = idDataMap[id]
      const item = data[slug]
      if (!item) return false
      
      const titleLower = item.title.toLowerCase()
      const contentLower = item.content.toLowerCase()
      
      // Check if title or content contains the search query
      return titleLower.includes(normalizedQuery) || contentLower.includes(normalizedQuery)
    }).slice(0, 10) // Limit to top 10 after filtering
  }
  
  function displayResults(resultIds: number[], query: string) {
    resultsArea.innerHTML = ''
    
    if (resultIds.length === 0) {
      resultsArea.style.display = 'block'
      const message = document.createElement('p')
      message.className = 'pagefind-ui__message'
      message.textContent = `No results for "${query}"`
      resultsArea.appendChild(message)
      return
    }
    
    resultsArea.style.display = 'block'
    
    const heading = document.createElement('p')
    heading.className = 'pagefind-ui__results-heading'
    heading.textContent = `${resultIds.length} result${resultIds.length === 1 ? '' : 's'} for "${query}"`
    resultsArea.appendChild(heading)
    
    const resultsList = document.createElement('ol')
    resultsList.className = 'pagefind-ui__results'
    
    for (const id of resultIds) {
      const slug = idDataMap[id]
      const item = data[slug]
      if (!item) continue
      
      const li = document.createElement('li')
      li.className = 'pagefind-ui__result'
      
      const link = document.createElement('a')
      link.className = 'pagefind-ui__result-link'
      link.href = resolveUrl(slug)
      
      const title = document.createElement('p')
      title.className = 'pagefind-ui__result-title'
      title.innerHTML = highlight(query, item.title)
      
      const excerpt = document.createElement('p')
      excerpt.className = 'pagefind-ui__result-excerpt'
      const excerptText = createExcerpt(item.content, query)
      excerpt.innerHTML = highlight(query, excerptText)
      
      link.appendChild(title)
      link.appendChild(excerpt)
      
      if (item.tags && item.tags.length > 0) {
        const tags = document.createElement('p')
        tags.className = 'pagefind-ui__result-tags'
        tags.innerHTML = item.tags.map(tag => `<span class="pagefind-ui__result-tag">${tag}</span>`).join('')
        link.appendChild(tags)
      }
      
      li.appendChild(link)
      resultsList.appendChild(li)
    }
    
    resultsArea.appendChild(resultsList)
  }
  
  await fillIndex(data)
}

let indexPopulated = false
async function fillIndex(data: ContentIndex) {
  if (indexPopulated) return
  
  let id = 0
  const promises: Array<Promise<unknown>> = []
  
  for (const [slug, fileData] of Object.entries(data)) {
    promises.push(
      index.addAsync(id++, {
        id,
        slug: slug,
        title: fileData.title,
        content: fileData.content,
        tags: fileData.tags
      })
    )
  }
  
  await Promise.all(promises)
  indexPopulated = true
}

async function initSearch() {
  try {
    const response = await fetch('/contentIndex.json')
    if (!response.ok) {
      console.error('Failed to fetch contentIndex.json')
      return
    }
    
    const data: ContentIndex = await response.json()
    const searchContainer = document.getElementById('flex-search')
    
    if (searchContainer) {
      await setupSearch(searchContainer, data)
    }
  } catch (error) {
    console.error('Failed to initialize search:', error)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch)
} else {
  initSearch()
}
