---
title: 'Astro + Theme.Pure 建站流程记录'
description: '记录一下构建新博客站的过程、自定义功能需求和 bug 的解决，以及在这个过程中了解到的一些 js 相关的知识'
tags:
  - default
  - note
publishDate: 2025-09-26
updatedDate: 2025-10-09
---

参考资料：pure 主题文档、astro 文档。我不太懂 js 及其专有名词，很多内容也是自己折腾半天、大模型生成、勉强理解之后写的，未经过专业的考证。如果您有相关的专业知识，欢迎评论详细说明，感谢。
***
起因：知乎上刷到一个关于个人博客的问答，看到这个博客站 https://arthals.ink/ ，太喜欢这个干干净净的界面了。再加上使用 hexo + shoka 的旧站非常卡，很多功能都不完善，维护起来很麻烦。于是启动了这次搬家。

环境与工具：
- node 22.15.8
- npm 10.9.2
- astro-pure 4.0.8

## 阶段一：Installation

### Step 1：把主题 clone 下来
```shell
git clone https://github.com/cworld1/astro-theme-pure.git
```

### Step 2：删除 .git 目录
除非您完全掌握 git 的使用方法，否则**删除原有的 git 文件夹**，重新 git init（贸然沿用原有的 git 文件可能会影响原项目）

### Step 3：安装依赖项
一般 js 项目都不会上传依赖包，因为太大了。因此需要在根目录下运行：
```shell
npm install
```
这一步文件比较多 要等一会儿

如果是 windows 系统，注意在根目录下的 `package.json` 文件中，要把 clean 的指令改一下，windows 没有 `rm`
```json
{
  // ...
  "scripts": {
    // ...
    "clean": "rmdir /s /q .astro .vercel dist"
  },
  // ...
}
```

### Step 4：测试
启动 astro 开发服务器，默认监听 4321 端口
```shell
npm run dev
```
如果能够正常运行说明安装成功。开发过程中将会自动监看文件的变化

### Step 5：删除 docs 目录
这里是存放 pure 主题官方文档的地方。删掉 `src/pages/docs` 文件夹，然后在配置文件中删除 docs 相关的内容：
```diff
// src/site.config.ts :

export const theme: ThemeUserConfig = {
   // ...
   header: {
      menu: [
         { title: 'Blog', link: '/blog' },
-        { title: 'Docs', link: '/docs' }, 
         { title: 'Projects', link: '/projects' },
         // ...
      ],
   },
}

// src/content.config.ts :
- const docs = defineCollection({
- 	// ...
- })
- export const collections = { blog, docs } 
+ export const collections = { blog }
```

注：官方文档中建议删除 packages 目录。`packages/pure` 里头是 astro-pure 的依赖包，而在安装依赖项的时候已经装到 `node_modules` 里面了。但是我的习惯是留着 `packages`，并做以下处理：
1. 打开 `packages` 目录，将 `pure` 重命名为 `astro-pure`。这是为了与 `node_modules` 里头的名字一致。
2. 将 `packages` 目录移动到 `src` 里头

基于这个方式进行后续操作，将会使得 customization 的流程变得简单。

### Step 6：测试部署
不急着对网页做修改，先看看能不能部署成功。连接 Github 并部署到托管平台。例如 vercel 能够识别 astro 项目，自动填好 buildcommand 等配置。

## 阶段二：Customization

如果不涉及依赖包、或者作者提供了接口的东西，直接改就行了，例如 author、title、avatar、icon 等。

如果要修改依赖包里面的东西，不能直接在 `node_modules` 里面改。因为 `node_modules` 这个目录被 ignore 掉了，即使把它从 ignore 里头移走，部署平台在构建时一般也不会访问它。本来尝试的方法是直接在本地构建后再部署到云端，但没有成功。因此只能通过改变引用路径的方式，在外部进行修改，称为 Swizzling，官方给出的步骤是：
1. 先找到需要修改的文件
2. 复制出来并对文件做出修改
3. 修改引用路径

***
下面举一个例子详细说明：修改页面底端的 Quote 组件。原本是一个显示随机名言的元素，我希望改成显示固定名言。

### Step 1：找到元素源码位置
找到该元素源码所在的位置。“显示随机名言”这个元素位于 `src/pages/index.astro`：
```json
import { Quote } from 'astro-pure/advanced'
// ...
---
// ...
<Quote class='mt-12' />
// ...
```
`ctrl+左键` 点击下面这个 Quote，定位到实现 Quote 的文件 `node_modules\astro-pure\components\advanced\Quote.astro`

### Step 2：复制文件
官方给出的做法是，把 `node_modules\astro-pure\components\advanced\Quote.astro` 复制到自定义的路径下。

但是我们在阶段一中没有删除 packages 目录，因此我们可以直接去 packages 里头对应的文件里做修改，也即修改 `src\packages\astro-pure\components\advanced\Quote.astro`

### Step 3：修改文件
```ts
// src\packages\astro-pure\components\advanced\Quote.astro
---
import { cn } from '../../utils'

const { class: className } = Astro.props
---

<quote-component class={cn('not-prose inline-block', className)} >
  <div class='flex flex-row items-center gap-x-3 rounded-full border px-4 py-2 shadow-sm' style='font-size: 0.9375rem;'>
    <span class='relative flex items-center justify-center'>
      <span
        class='absolute size-2.2 animate-ping rounded-full border border-green-400 bg-green-400 opacity-75'
      ></span>
      <span class='size-2.2 rounded-full bg-green-400'></span>
    </span>
    <p id='quote-sentence' class='font-medium text-muted-foreground'>握紧你的锄头 - Never put down your hammer.</p>
  </div>
</quote-component>

<script>
  class Quote extends HTMLElement {
    constructor() {
      super()
    }
  }
  customElements.define('quote-component', Quote)
</script>
```

### Step 4：修改引用
回到引用 Quote 的 import 语句处（即 `src/pages/index.astro`），修改引用方式。

```diff 
- import { Quote } from 'astro-pure/advanced'
+ import { Quote } from '../packages/astro-pure/components/advanced/index.ts'
```

这与原始的引用逻辑看起来不太一样。

因为像 `astro-pure` 这种包，作者在它的 package.json 里设置了入口，称为命名导入：
```json
// node_modules/astro-pure/package.json
"exports": {
    ".": "./index.ts",
    "./user": "./components/user/index.ts",
    "./advanced": "./components/advanced/index.ts",
    "./components/pages": "./components/pages/index.ts",
    "./components/basic": "./components/basic/index.ts",
    "./utils": "./utils/index.ts",
    "./server": "./utils/server.ts",
    "./types": "./types/index.ts",
    "./libs": "./libs/index.ts"
  },
```
例如原本的引用句 `import { Quote } from 'astro-pure/advanced'`，后面的路径并非真实的文件路径，而是映射到内部的真实目录：
`node_modules/astro-pure/components/advanced/index.ts`

因此在引用修改后文件的路径时，需要把完整的真实目录写出来。

另外做一个说明：大括号的用法。`index.ts` 长这样
```ts
// Web content render
export { default as Quote } from './Quote.astro'
export { default as GithubCard } from './GithubCard.astro'
export { default as LinkPreview } from './LinkPreview.astro'

// Data transformer
export { default as QRCode } from './QRCode.astro'
export { default as MediumZoom } from './MediumZoom.astro'
```
因此 `{ Quote }` 则表示“导入成员 Quote”，称为解构导入


### Step 5：级联修改引用
这就体现出保留 packages 的好处了。由于整个依赖包使用的都是相对路径，一旦某个部件里头还需要同一个依赖包里的其他文件，程序可以通过相对路径直接定位。反而，如果采用官方给出的做法，会导致“找不到这些二级依赖”而报错，因此需要级联地把二级依赖复制过来并且修改引用路径。

所以说我们才选择使用 packages 做 customization，这样就不用级联修改了。除非它引用了其他依赖包里头的东西。这时候只需要把依赖到的包也复制进 `packages` 文件夹，与 `astro-pure` 同级即可。也就是说，`packages` 就相当于一个小型的 `node_modules`，可以正常上传到部署平台进行构建。

## 阶段三：Writing
### 创建文章
#### 法 1：指令创建
```shell
npm run new <title>
```
用于在 Astro 项目的 `src/content/blog/` 目录下创建新的博客文章。

- 指令：`astro-pure new [options] <post-title>`
- 参数，默认都是否：
	- `-l, --lang <en|zh>`：文章语言
	- `-d, --draft`：是否是草稿
	- `-m, --mdx`：使用 `.mdx` 格式
	- `-f, --folder`：是否在单独文件夹下创建文章
	  （无法在文件夹内新建文章）
	- `-h, --help`：显示帮助信息
- 默认路径：`src/content/blog/`
- 文件命名：
	- 默认直接生成 `slug.md`
	- 如果加 `-f`，会生成一个目录 `slug/`，里面放 `index.md`
- 内容模板：YAML Frontmatter（包含 `title`、`description`、`publishDate`、`draft`、`lang`、`tags` 等）。

#### 法 2：直接创建
在 blog 文件夹下直接新建文件即可。注意，如果开着 dev 可能会报错，不用管他
### Waline 配置


## 阶段四：Sitemap
webmaster

以下是一个标准的 sitemap.xml 文件格式示例，适用于向搜索引擎（如 Google、Bing 等）提交站点地图，以帮助其更好地抓取和索引您的网站内容。
示例代码：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- 示例：主页 -->
    <url>
        <loc>https://www.example.com/</loc>
        <lastmod>2025-09-01</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>

    <!-- 示例：关于页面 -->
    <url>
        <loc>https://www.example.com/about</loc>
        <lastmod>2025-08-25</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>

    <!-- 示例：博客文章 -->
    <url>
        <loc>https://www.example.com/blog/post1</loc>
        <lastmod>2025-08-30</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
    </url>
</urlset>
```

元素说明：
- `<urlset>`: 根元素，包含所有 URL 信息。必须包含 xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 命名空间。
- `<url>`: 每个 URL 的信息块。
- `<loc>`: 页面 URL，必须是绝对路径（包括协议，如 https://）。
- `<lastmod>`: 页面最后修改时间（可选），格式为 YYYY-MM-DD。
- `<changefreq>`: 页面内容更新频率（可选），值包括：always（始终）、hourly（每小时）、daily（每天）、weekly（每周）、monthly（每月）、yearly（每年）、never（从不）。
- `<priority>`: 页面优先级（可选），范围为 0.0 到 1.0，默认值为 0.5。

注意事项：
1. 编码: 文件必须使用 UTF-8 编码。
2. 文件大小限制: 单个 sitemap.xml 文件不能超过 50MB 或包含超过 50,000 个 URL。如果超出限制，可以使用 sitemap index 文件。
3. 提交方式: 将 sitemap.xml 文件上传到网站根目录（如 https://www.example.com/sitemap.xml）。在搜索引擎的站长工具（如 Google Search Console）中提交。

## bug
### 名言条动画
名言左侧的绿色原点，有一个动画（tailwind 实现的，`animate-ping`），没有动起来。一般不会有问题，可能是 tailwindcss 的问题，于是在 `app.css` 中重写了这个动画
```css
/* src/assets/styles/app.css */

/* Animations */
@keyframes ping {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
```

### rehype-tabs 报错的解决
```diff
// ...
- interface Panel {
+ export interface Panel {
  panelId: string
  tabId: string
  label: string
}
// ...

- export const processPanels = (html: string) => {
-   const file = tabsProcessor.processSync({ value: html })
-   return {
-     /** Data for each tab panel. */
-     panels: file.data.panels,
-     /** Processed HTML for the tab panels. */
-     html: file.toString()
-   }
- }

+ export const processPanels = (html: string): { panels: Panel[]; html: string } => {
+   const file = tabsProcessor.processSync({ value: html })
+   return {
+     panels: file.data.panels as Panel[],
+     html: file.toString()
+   }
+ }
```

### 数学公式
latex 正常写。行间公式必须单独成行，并且双美元也要单独成行

### 暗色模式颜色
- 标题：一级标题黑的。从二级标题开始写。
- 引用是黑的
- 行内代码块文字也是黑的