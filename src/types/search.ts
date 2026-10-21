export interface SearchDocument {
  slug: string
  title: string
  content: string
  tags: string[]
}

export type SearchIndexPayload = SearchDocument[]
