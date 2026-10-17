import type { MetadataRoute } from 'next'

import { SITE_URL } from '../lib/site'

/**
 * `robots.txt`. PLAN.md step 6b-ii.
 *
 * `PLAN.md:80` rules that MyStable, login and checkout stay out of the index, so
 * they are disallowed here. None of the three is a route yet and this file is
 * still the right place for the rule: it states the intent once, at the site
 * level, and the routes inherit it the day they are built rather than needing
 * someone to remember.
 *
 * The sitemap is named absolutely, on the `www` host, because `PLAN.md:84` rules
 * the apex out.
 *
 * Static on purpose. Nothing here reads a row, so there is nothing to make
 * dynamic and no build-time data need.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/mystable', '/login', '/checkout'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
