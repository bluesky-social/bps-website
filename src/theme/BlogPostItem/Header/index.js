import React from 'react'
import BlogPostItemHeaderTitle from '@theme/BlogPostItem/Header/Title'
import BlogPostItemHeaderInfo from '@theme/BlogPostItem/Header/Info'

/**
 * BlogPostItem/Header — title and date/reading-time only.
 *
 * Ejected rather than wrapped because this header does two things a wrapper
 * cannot: it drops a child (the author byline) and names the two it keeps. The
 * upstream component is three lines and has been for several major versions,
 * so owning it is cheap — but it IS owned now, and a Docusaurus upgrade that
 * adds something to the blog post header will not reach this file. It is worth
 * a glance when upgrading.
 *
 * The author is still credited where it belongs — the RSS/Atom feeds and the
 * page's article:author metadata, both of which come from blog/authors.yml by
 * way of the plugin. Hiding the byline is a display choice, not a decision to
 * publish anonymously.
 *
 * The two class names are the styling contract with src/css/custom.css, which
 * needs a stable hook: the theme's own classes here are hashed CSS-module names.
 */
export default function BlogPostItemHeader() {
  return (
    <header className="bpsBlogHeader">
      <BlogPostItemHeaderTitle className="bpsBlogTitle" />
      <BlogPostItemHeaderInfo className="bpsBlogInfo" />
    </header>
  )
}
