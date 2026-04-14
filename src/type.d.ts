declare module 'virtual:config' {
  const Config: import('astro-pure/types').ConfigOutput & {
    highlightColor?: string
  }
  export default Config
}
