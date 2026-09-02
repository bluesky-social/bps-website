import React from 'react'
import Link from '@docusaurus/Link'
import { useBlogPost } from '@docusaurus/plugin-content-blog/client'

/**
 * BlogByline — "Jim Ray / Bluesky DevRel" under a post's date.
 *
 * Not a theme component. The theme's own byline (BlogPostItem/Header/Authors)
 * is an avatar row built on Infima's avatar classes; this is two lines of text,
 * so it shadows nothing and lives with the site's other components rather than
 * pretending to be a swizzle.
 *
 * Every field comes from blog/authors.yml by way of the plugin, which is why a
 * post cannot name an author inline — see the note at the top of that file.
 * `title` and `url` are both optional there, so neither is assumed here: an
 * author with only a name renders as only a name.
 *
 * `image_url` is deliberately unread. It still feeds the feeds and the
 * article:author metadata; the byline just does not show avatars.
 */
export default function BlogByline() {
  const {
    metadata: { authors },
  } = useBlogPost()

  // A post with no `authors:` key gets no byline rather than an empty block.
  // The build already rejects an *unknown* author (onInlineAuthors: 'throw'),
  // but it does not require the key to be present at all.
  if (!authors || authors.length === 0) return null

  return (
    <div className="bpsBlogByline">
      {authors.map((author, index) => (
        <div className="bpsBlogBylineAuthor" key={author.key ?? index}>
          <span className="bpsBlogBylineName">
            {author.url ? (
              <Link href={author.url}>{author.name}</Link>
            ) : (
              author.name
            )}
          </span>
          {author.title && (
            <span className="bpsBlogBylineTitle">{author.title}</span>
          )}
        </div>
      ))}
    </div>
  )
}
