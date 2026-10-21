import { buildSearchIndex } from '../utils/search-index'

export const prerender = true

const GET = async () => {
  const contentIndex = await buildSearchIndex()

  return new Response(JSON.stringify(contentIndex), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}

export { GET }
