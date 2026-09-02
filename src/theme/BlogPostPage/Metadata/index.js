/**
 * BlogPostPage/Metadata — wraps the theme's blog-post head metadata.
 *
 * Docusaurus already emits title, description, keywords, og:image, og:type,
 * article:published_time, article:author and article:tag from a post's front
 * matter. This wrapper adds the tags it has no opinion about, driven from a
 * `head_meta` front-matter field:
 *
 *   ---
 *   title: ...
 *   head_meta:
 *     robots: max-image-preview:large
 *     og:audience: developers
 *   ---
 *
 * `BlogPostPage/Metadata` is the wrap target rather than `BlogPostPage` because
 * emitting head metadata is the whole of its job, and it reads the post from
 * `useBlogPost()` rather than props — so wrapping it costs nothing and stays
 * clear of the page's layout, TOC and pagination.
 *
 * Attribute choice follows the RDFa/OGP split that the rest of the head already
 * uses: `og:*`, `article:*`, `fb:*` and `profile:*` are Open Graph properties
 * and get `property=`; everything else is a plain `name=` meta.
 *
 * Malformed `head_meta` throws rather than rendering a partial head. This runs
 * during SSR, so the failure surfaces as a build error naming the post — which
 * is the point. A tag silently dropped from a page's head is invisible until
 * something downstream is already broken.
 */

import React from 'react'
import Head from '@docusaurus/Head'
import Original from '@theme-original/BlogPostPage/Metadata'
import { useBlogPost } from '@docusaurus/plugin-content-blog/client'

const OG_PREFIXES = ['og:', 'article:', 'fb:', 'profile:']

const isOpenGraph = (key) =>
  OG_PREFIXES.some((prefix) => key.startsWith(prefix))

function parseHeadMeta(headMeta, postId) {
  if (headMeta == null) return []
  const where = `blog post "${postId}"`
  if (typeof headMeta !== 'object' || Array.isArray(headMeta)) {
    throw new Error(
      `${where}: front-matter "head_meta" must be a map of tag name to content, got ${
        Array.isArray(headMeta) ? 'a list' : typeof headMeta
      }.`,
    )
  }
  return Object.entries(headMeta).map(([key, content]) => {
    // Numbers and booleans are a likely YAML slip (`head_meta: {robots: true}`)
    // and would stringify into something the author did not write, so they are
    // rejected rather than coerced.
    if (typeof content !== 'string') {
      throw new Error(
        `${where}: front-matter "head_meta.${key}" must be a string, got ${typeof content}. ` +
          `Quote the value if YAML is parsing it as a number or boolean.`,
      )
    }
    if (key.trim() === '') {
      throw new Error(
        `${where}: front-matter "head_meta" has an empty tag name.`,
      )
    }
    return { key, content, attribute: isOpenGraph(key) ? 'property' : 'name' }
  })
}

export default function BlogPostPageMetadataWrapper(props) {
  const { metadata } = useBlogPost()
  const tags = parseHeadMeta(
    metadata.frontMatter.head_meta,
    metadata.id ?? metadata.permalink,
  )

  return (
    <>
      <Original {...props} />
      {tags.length > 0 && (
        <Head>
          {tags.map(({ key, content, attribute }) =>
            attribute === 'property' ? (
              <meta key={key} property={key} content={content} />
            ) : (
              <meta key={key} name={key} content={content} />
            ),
          )}
        </Head>
      )}
    </>
  )
}
