/**
 * Engine V2 public image storage on Cloudflare R2. PLAN.md step 5.
 *
 * Public horse images live in one R2 bucket, in a folder named from the horse
 * slug, with files numbered `01` upward and **no file extension**. The database
 * stores `image_count` and nothing else about images: there is no path column,
 * no slug-to-path lookup, and no redirect table.
 *
 * Two halves, kept apart on purpose:
 *
 *   - Key, URL, and count algebra is pure. No client, no environment read, no
 *     network, no module-level state.
 *   - The client and the upload read `process.env` at call time, never at import
 *     time, so importing this module in a test or in CI costs nothing and needs
 *     no credentials.
 *
 * Private KYC and proof-of-address documents never come through here; they stay
 * in private Supabase Storage. That is enforced structurally rather than by
 * convention: the upload takes a slug and a number, never a caller-supplied key,
 * and it refuses both non-image content types and reserved key prefixes.
 *
 * The old media bucket and its keys are not referenced anywhere in this file.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/** Minimum images on a horse before a DSL may be Available. */
export const MIN_IMAGES_FOR_AVAILABLE = 3

/**
 * Every public image is served as this type. The key carries no extension, so
 * nothing downstream can infer the type: it has to be set at upload time.
 */
export const R2_IMAGE_CONTENT_TYPE = 'image/webp'

/**
 * Two digits, so a folder reads and sorts the way the operator expects: `01`,
 * `02`, ... `10`. A hundredth image widens to `100` on its own.
 */
const IMAGE_NUMBER_DIGITS = 2

/** A slug: lowercase ASCII words joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * A public image key: `{slug}/{NN}`, and nothing else. A dot cannot match, so a
 * file extension is refused by the shape of the key rather than by a check for
 * known extensions.
 */
const PUBLIC_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/\d{2,}$/

/** One or more digits, the suffix half of a key. */
const NUMBER_SUFFIX_PATTERN = /^\d{2,}$/

/**
 * First path segments reserved for private material. These belong in private
 * Supabase Storage. Seeing one on the public bucket means a caller went around
 * `imageKey`, so the upload refuses instead of writing the object.
 */
const PRIVATE_KEY_PREFIXES = [
  'kyc',
  'private',
  'identity',
  'documents',
  'document',
  'proof-of-address',
  'poa',
  'legal',
  'pds',
  'sa',
]

/** The environment variables this module reads, in the order it names them. */
export const REQUIRED_ENV_NAMES = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const

export type EnvName = (typeof REQUIRED_ENV_NAMES)[number]

/** Anything shaped like `process.env`, so config resolution stays testable. */
export type EnvLike = Record<string, string | undefined>

export type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  /** No trailing slash. */
  publicUrl: string
}

/** The S3-compatible endpoint for an account. */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`
}

function assertSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`horse slug must be lowercase words joined by hyphens (received ${slug})`)
  }
}

function assertImageNumber(imageNumber: number): void {
  if (!Number.isInteger(imageNumber) || imageNumber < 1) {
    throw new Error(`image number must be a whole number from 1 upward (received ${String(imageNumber)})`)
  }
}

/** True when the key's first segment is reserved for private material. */
export function isReservedPrivateKey(key: string): boolean {
  const [first = ''] = key.trim().toLowerCase().split('/')
  return PRIVATE_KEY_PREFIXES.includes(first)
}

/**
 * Returns the key unchanged when it is a public image key, and throws otherwise.
 *
 * Rejects a reserved private prefix (KYC, proof of address, legal documents) and
 * any key that is not exactly `{slug}/{NN}`: a path with an extension, a nested
 * path, or a bare slug all fail here rather than becoming a stray object.
 */
export function assertPublicImageKey(key: string): string {
  if (isReservedPrivateKey(key)) {
    throw new Error(
      `refusing private document key on the public image bucket: ${key} (private files stay in Supabase Storage)`,
    )
  }
  if (!PUBLIC_KEY_PATTERN.test(key)) {
    throw new Error(`public image key must be {slug}/{NN} with no file extension (received ${key})`)
  }
  return key
}

/**
 * The storage key for one image: `{slug}/{NN}`.
 *
 * `imageKey('lady-ketchikan', 1)` is `lady-ketchikan/01`. There is no extension
 * and no uuid: the slug names the folder, and the number names the file. A
 * rename moves the folder, and no lookup anywhere has to be updated.
 */
export function imageKey(slug: string, imageNumber: number): string {
  assertSlug(slug)
  assertImageNumber(imageNumber)
  return `${slug}/${String(imageNumber).padStart(IMAGE_NUMBER_DIGITS, '0')}`
}

/** Every key for a horse, `01` through `NN` inclusive. */
export function imageKeys(slug: string, count: number): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`image count must be a whole number from 0 upward (received ${String(count)})`)
  }
  return Array.from({ length: count }, (_, index) => imageKey(slug, index + 1))
}

/**
 * The `image_count` for a slug, derived from the keys actually present.
 *
 * A folder must run `01..NN` with no gap and no repeat, because that is what
 * `image_count` means. A stray `03` with no `02` is refused here rather than
 * being counted, so the database figure cannot drift from the bucket.
 *
 * This is a pure function over a listing, not a stored map: nothing persists a
 * horse-to-path association.
 */
export function imageCountFromKeys(slug: string, keys: readonly string[]): number {
  assertSlug(slug)
  const prefix = `${slug}/`
  const suffixes = keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))

  for (const suffix of suffixes) {
    if (!NUMBER_SUFFIX_PATTERN.test(suffix)) {
      throw new Error(`${slug} has an off-convention image key: ${prefix}${suffix}`)
    }
  }

  if (new Set(suffixes).size !== suffixes.length) {
    throw new Error(`${slug} has a repeated image number`)
  }

  const expected = new Set(Array.from({ length: suffixes.length }, (_, index) => imageKey(slug, index + 1).slice(prefix.length)))
  for (const suffix of suffixes) {
    if (!expected.has(suffix)) {
      throw new Error(`${slug} images must run 01..NN with no gap; ${prefix}${suffix} breaks the run`)
    }
  }

  return suffixes.length
}

/**
 * The public URL for an image key.
 *
 * The base comes from the environment and has no default here: a built-in
 * fallback would quietly serve production URLs from a development host. When the
 * base is unset the config read throws, which surfaces at the first upload rather
 * than as broken images later.
 */
export function publicImageUrl(key: string, publicUrlBase: string): string {
  const base = publicUrlBase.trim().replace(/\/+$/, '')
  if (!base.startsWith('https://')) {
    throw new Error(`public base URL must be an https origin (received ${publicUrlBase})`)
  }
  return `${base}/${assertPublicImageKey(key)}`
}

/**
 * Resolves the R2 configuration from an environment record.
 *
 * Every name is required. Nothing is defaulted — not the bucket and not the
 * public base URL — so a missing value fails here, naming all of them at once,
 * instead of producing an upload to the wrong place or a dead image link.
 */
export function r2ConfigFromEnv(env: EnvLike): R2Config {
  const missing = REQUIRED_ENV_NAMES.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`R2 is not configured; missing or empty: ${missing.join(', ')} (see engine/.env.local)`)
  }

  const publicUrl = (env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')
  if (!publicUrl.startsWith('https://')) {
    throw new Error(`R2_PUBLIC_URL must be an https origin (received ${publicUrl})`)
  }

  return {
    accountId: (env.R2_ACCOUNT_ID ?? '').trim(),
    accessKeyId: (env.R2_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: (env.R2_SECRET_ACCESS_KEY ?? '').trim(),
    bucketName: (env.R2_BUCKET_NAME ?? '').trim(),
    publicUrl,
  }
}

/** The R2 configuration for this process. Reads the environment at call time. */
export function storageConfig(env: EnvLike = process.env): R2Config {
  return r2ConfigFromEnv(env)
}

function createClient(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

export type UploadPublicImageInput = {
  slug: string
  imageNumber: number
  body: Uint8Array
  contentType?: string
  env?: EnvLike
}

export type UploadPublicImageResult = {
  key: string
  url: string
}

/**
 * Uploads one public horse image and returns its key and public URL.
 *
 * The key is built here from the slug and the number; a caller cannot pass a
 * path in. A content type that is not an image is refused, which is what keeps a
 * KYC scan or a proof-of-address PDF from being written to the public bucket.
 * The image type is set explicitly because the key has no extension.
 */
export async function uploadPublicImage(input: UploadPublicImageInput): Promise<UploadPublicImageResult> {
  const contentType = (input.contentType ?? R2_IMAGE_CONTENT_TYPE).trim().toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error(
      `refusing non-image upload to the public image bucket: ${contentType} (private files stay in Supabase Storage)`,
    )
  }

  const key = assertPublicImageKey(imageKey(input.slug, input.imageNumber))
  const config = storageConfig(input.env)
  const client = createClient(config)

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: input.body,
      ContentType: contentType,
    }),
  )

  return { key, url: publicImageUrl(key, config.publicUrl) }
}
