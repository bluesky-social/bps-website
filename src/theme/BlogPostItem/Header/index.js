import React from 'react'
import { useBlogPost } from '@docusaurus/plugin-content-blog/client'
import BlogPostItemHeaderTitle from '@theme/BlogPostItem/Header/Title'
import BlogPostItemHeaderInfo from '@theme/BlogPostItem/Header/Info'
import BlogByline from '@site/src/components/BlogByline'

/**
 * BlogPostItem/Header — title, date, and a byline on post pages.
 *
 * Ejected rather than wrapped because this header does three things a wrapper
 * cannot: it drops a child (the theme's avatar byline), names the two it keeps,
 * and adds one of its own. The upstream component is three lines and has been
 * for several major versions, so owning it is cheap — but it IS owned now, and
 * a Docusaurus upgrade that adds something to the blog post header will not
 * reach this file. It is worth a glance when upgrading.
 *
 * The byline is src/components/BlogByline — name and title, no avatar — and it
 * replaces the reading time that used to sit beside the date. Reading time is
 * gone at the source (showReadingTime: false in docusaurus.config.js), not
 * hidden here, so Info renders the date alone.
 *
 * `isBlogPostPage` keeps the byline off the index. The same BlogPostItem
 * renders both, and the index is a list of links: a name and job title under
 * every entry would crowd it. scripts/check-build.mjs asserts both halves.
 *
 * The two class names are the styling contract with src/css/custom.css, which
 * needs a stable hook: the theme's own classes here are hashed CSS-module names.
 */
export default function BlogPostItemHeader() {
  const { isBlogPostPage } = useBlogPost()

  return (
    <header className="bpsBlogHeader">
      <BlogPostItemHeaderTitle className="bpsBlogTitle" />
      <BlogPostItemHeaderInfo className="bpsBlogInfo" />
      {isBlogPostPage && <BlogByline />}
    </header>
  )
}
