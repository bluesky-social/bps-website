import React from 'react'
import clsx from 'clsx'
import { useBlogPost } from '@docusaurus/plugin-content-blog/client'
import Original from '@theme-original/BlogPostItem/Content'

/**
 * BlogPostItem/Content — the post body on a post page, the description on the
 * index.
 *
 * The theme renders the same MDX in both places, cut at the post's truncate
 * marker for the index. That makes an index entry a fragment of a post: it
 * starts mid-argument and stops mid-sentence. The
 * front-matter `description` is written to be read on its own, and is already
 * what the feeds and og:description use, so the index uses it too.
 *
 * Wrapped rather than ejected — unlike BlogPostItem/Header, nothing here needs
 * to reach inside the original. The post page delegates to it untouched, which
 * keeps the `blogPostContainerID` the feed generator looks for, and the index
 * substitutes a paragraph.
 *
 * `metadata.description` is `frontMatter.description ?? excerpt`, so a post
 * that declares no description still shows its opening rather than nothing.
 */
export default function BlogPostItemContentWrapper(props) {
  const { isBlogPostPage, metadata } = useBlogPost()

  if (isBlogPostPage) return <Original {...props} />

  return (
    <div className={clsx('markdown', 'bpsBlogSummary', props.className)}>
      <p>{metadata.description}</p>
    </div>
  )
}
