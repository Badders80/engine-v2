/**
 * Contracts for the public image storage module. PLAN.md step 5.
 *
 * These run hermetically: the S3 client is mocked, so no test touches the
 * network and no test needs credentials. The key and URL contracts are pure and
 * are asserted directly.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MIN_IMAGES_FOR_AVAILABLE,
  R2_IMAGE_CONTENT_TYPE,
  assertPublicImageKey,
  imageCountFromKeys,
  imageKey,
  imageKeys,
  isReservedPrivateKey,
  publicImageUrl,
  r2ConfigFromEnv,
  r2Endpoint,
  uploadPublicImage,
  type EnvLike,
} from '../src/lib/storage'

const hoisted = vi.hoisted(() => {
  const clientConfigs: Array<Record<string, unknown>> = []
  const objectInputs: Array<Record<string, unknown>> = []

  class PutObjectCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
      objectInputs.push(input)
    }
  }

  class S3Client {
    constructor(config: Record<string, unknown>) {
      clientConfigs.push(config)
    }
    async send() {
      return {}
    }
  }

  return { clientConfigs, objectInputs, PutObjectCommand, S3Client }
})

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: hoisted.PutObjectCommand,
  S3Client: hoisted.S3Client,
}))

/** A complete, fake environment. No real credential value appears in this file. */
const ENV: EnvLike = {
  R2_ACCOUNT_ID: 'account-under-test',
  R2_ACCESS_KEY_ID: 'access-key-under-test',
  R2_SECRET_ACCESS_KEY: 'secret-under-test',
  R2_BUCKET_NAME: 'bucket-under-test',
  R2_PUBLIC_URL: 'https://images.example.test',
}

const SOURCE_URL = new URL('../src/lib/storage.ts', import.meta.url)
const STORAGE_SOURCE = readFileSync(fileURLToPath(SOURCE_URL), 'utf8')

const image = () => new Uint8Array([1, 2, 3])

beforeEach(() => {
  hoisted.clientConfigs.length = 0
  hoisted.objectInputs.length = 0
})

describe('image keys resolve as {slug}/01 through {slug}/NN with no extension', () => {
  it('keys the first image as 01', () => {
    expect(imageKey('lady-ketchikan', 1)).toBe('lady-ketchikan/01')
  })

  it('keys the ninth and tenth images as 09 and 10, still two digits', () => {
    expect(imageKey('lady-ketchikan', 9)).toBe('lady-ketchikan/09')
    expect(imageKey('lady-ketchikan', 10)).toBe('lady-ketchikan/10')
  })

  it('keys a run of images as 01..NN', () => {
    expect(imageKeys('mulan-the-brave', 4)).toEqual([
      'mulan-the-brave/01',
      'mulan-the-brave/02',
      'mulan-the-brave/03',
      'mulan-the-brave/04',
    ])
  })

  it('carries no file extension on any key in the run', () => {
    for (const key of imageKeys('lady-ketchikan', 12)) {
      expect(key).not.toMatch(/\./)
      expect(key).toMatch(/^lady-ketchikan\/\d{2}$/)
    }
  })

  it('carries no uuid and sits under no legacy media prefix', () => {
    const key = imageKey('lady-ketchikan', 1)
    expect(key).not.toMatch(/uuid/i)
    expect(key.startsWith('horses/')).toBe(false)
  })

  it('refuses a key with a file extension', () => {
    expect(() => assertPublicImageKey('lady-ketchikan/01.jpg')).toThrow(/no file extension/)
    expect(() => assertPublicImageKey('lady-ketchikan/01.webp')).toThrow(/no file extension/)
  })

  it('refuses a nested path, a bare slug, and a non-numeric file name', () => {
    expect(() => assertPublicImageKey('horses/lady-ketchikan/01')).toThrow()
    expect(() => assertPublicImageKey('lady-ketchikan')).toThrow()
    expect(() => assertPublicImageKey('lady-ketchikan/front')).toThrow()
    expect(() => assertPublicImageKey('lady-ketchikan/1')).toThrow()
  })

  it('refuses a slug that is not lowercase hyphenated words', () => {
    expect(() => imageKey('Lady Ketchikan', 1)).toThrow(/slug/)
    expect(() => imageKey('lady_ketchikan', 1)).toThrow(/slug/)
  })

  it('refuses a non-integer or zero image number', () => {
    expect(() => imageKey('lady-ketchikan', 0)).toThrow(/whole number/)
    expect(() => imageKey('lady-ketchikan', 1.5)).toThrow(/whole number/)
  })

  it('refuses a negative image count', () => {
    expect(() => imageKeys('lady-ketchikan', -1)).toThrow(/whole number/)
  })

  it('accepts a well-formed key unchanged', () => {
    expect(assertPublicImageKey('lady-ketchikan/01')).toBe('lady-ketchikan/01')
  })
})

describe('private KYC and proof-of-address material is rejected from the public bucket', () => {
  it('treats the reserved private prefixes as private', () => {
    expect(isReservedPrivateKey('kyc/alex-passport')).toBe(true)
    expect(isReservedPrivateKey('proof-of-address/alex-rates-bill')).toBe(true)
    expect(isReservedPrivateKey('identity/alex-licence')).toBe(true)
    expect(isReservedPrivateKey('documents/signed-sa')).toBe(true)
  })

  it('matches the reserved word as a whole first segment only', () => {
    expect(isReservedPrivateKey('kyc-horse/01')).toBe(false)
    expect(isReservedPrivateKey('lady-ketchikan/01')).toBe(false)
  })

  it('refuses to build a public key under a reserved private prefix', () => {
    expect(() => assertPublicImageKey('kyc/alex-passport')).toThrow(/private document key/)
    expect(() => assertPublicImageKey('proof-of-address/alex-rates-bill')).toThrow(/private document key/)
  })

  it('refuses to publish a URL for a reserved private prefix', () => {
    expect(() => publicImageUrl('kyc/alex-passport', 'https://images.example.test')).toThrow(/private document key/)
  })

  it('refuses an upload whose content type is not an image', async () => {
    const input = { slug: 'lady-ketchikan', imageNumber: 1, body: image(), env: ENV }
    await expect(uploadPublicImage({ ...input, contentType: 'application/pdf' })).rejects.toThrow(/non-image/)
    expect(hoisted.objectInputs).toHaveLength(0)
  })

  it('defaults to webp when no content type is given, since the key cannot imply one', async () => {
    await uploadPublicImage({ slug: 'mulan-the-brave', imageNumber: 2, body: image(), env: ENV })
    expect(hoisted.objectInputs[0]).toMatchObject({
      Key: 'mulan-the-brave/02',
      ContentType: R2_IMAGE_CONTENT_TYPE,
    })
    expect(R2_IMAGE_CONTENT_TYPE).toBe('image/webp')
  })

  it('cannot be handed a caller-supplied key: the upload input carries no key field', () => {
    const declaration = STORAGE_SOURCE.match(/export type UploadPublicImageInput = \{[\s\S]*?\n\}/)
    expect(declaration).not.toBeNull()
    expect(declaration?.[0]).toMatch(/\bslug\b/)
    expect(declaration?.[0]).toMatch(/\bimageNumber\b/)
    expect(declaration?.[0]).not.toMatch(/\bkey\b/)
  })
})

describe('the public URL generator matches the key format', () => {
  it('joins the base and the key with one slash', () => {
    expect(publicImageUrl('lady-ketchikan/01', 'https://images.example.test')).toBe(
      'https://images.example.test/lady-ketchikan/01',
    )
  })

  it('normalises a trailing slash on the base', () => {
    expect(publicImageUrl('lady-ketchikan/01', 'https://images.example.test/')).toBe(
      'https://images.example.test/lady-ketchikan/01',
    )
    expect(publicImageUrl('lady-ketchikan/01', 'https://images.example.test///')).toBe(
      'https://images.example.test/lady-ketchikan/01',
    )
  })

  it('produces one valid URL per key across a run', () => {
    const urls = imageKeys('lady-ketchikan', 3).map((key) => publicImageUrl(key, 'https://images.example.test'))
    expect(urls).toEqual([
      'https://images.example.test/lady-ketchikan/01',
      'https://images.example.test/lady-ketchikan/02',
      'https://images.example.test/lady-ketchikan/03',
    ])
    for (const url of urls) {
      expect(new URL(url).pathname).toMatch(/^\/lady-ketchikan\/\d{2}$/)
    }
  })

  it('refuses a non-https base', () => {
    expect(() => publicImageUrl('lady-ketchikan/01', 'http://images.example.test')).toThrow(/https/)
    expect(() => publicImageUrl('lady-ketchikan/01', '')).toThrow(/https/)
  })

  it('refuses a key that carries an extension', () => {
    expect(() => publicImageUrl('lady-ketchikan/01.jpg', 'https://images.example.test')).toThrow(/no file extension/)
  })
})

describe('configuration fails fast rather than falling back', () => {
  it('names every missing variable at once', () => {
    expect(() => r2ConfigFromEnv({})).toThrow(
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL/,
    )
  })

  it('treats an empty or whitespace value as missing', () => {
    const env: EnvLike = { ...ENV, R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '   ' }
    expect(() => r2ConfigFromEnv(env)).toThrow(/R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/)
  })

  it('resolves every value from the environment and defaults none of them', () => {
    expect(r2ConfigFromEnv(ENV)).toEqual({
      accountId: 'account-under-test',
      accessKeyId: 'access-key-under-test',
      secretAccessKey: 'secret-under-test',
      bucketName: 'bucket-under-test',
      publicUrl: 'https://images.example.test',
    })
  })

  it('strips a trailing slash from the configured public base', () => {
    expect(r2ConfigFromEnv({ ...ENV, R2_PUBLIC_URL: 'https://images.example.test/' }).publicUrl).toBe(
      'https://images.example.test',
    )
  })

  it('sends the upload to the account endpoint, region auto', async () => {
    await uploadPublicImage({ slug: 'lady-ketchikan', imageNumber: 3, body: image(), env: ENV })
    expect(hoisted.clientConfigs[0]).toMatchObject({
      region: 'auto',
      endpoint: 'https://account-under-test.r2.cloudflarestorage.com',
    })
  })

  it('exposes the endpoint as a pure function of the account id', () => {
    expect(r2Endpoint('abc123')).toBe('https://abc123.r2.cloudflarestorage.com')
  })

  it('returns the key and the matching public URL from an upload', async () => {
    const result = await uploadPublicImage({ slug: 'lady-ketchikan', imageNumber: 4, body: image(), env: ENV })
    expect(result).toEqual({
      key: 'lady-ketchikan/04',
      url: 'https://images.example.test/lady-ketchikan/04',
    })
  })

  it('refuses to upload at all while the environment is incomplete', async () => {
    await expect(uploadPublicImage({ slug: 'lady-ketchikan', imageNumber: 1, body: image(), env: {} })).rejects.toThrow(
      /not configured/,
    )
    expect(hoisted.objectInputs).toHaveLength(0)
  })

  it('reads the environment lazily, with an injectable override', () => {
    expect(STORAGE_SOURCE).toMatch(/export function storageConfig\(env: EnvLike = process\.env\)/)
  })
})

describe('image_count is derived from the bucket, never stored as a path map', () => {
  it('counts a run of three as three', () => {
    expect(imageCountFromKeys('lady-ketchikan', ['lady-ketchikan/01', 'lady-ketchikan/02', 'lady-ketchikan/03'])).toBe(3)
  })

  it('ignores keys belonging to other horses', () => {
    expect(imageCountFromKeys('lady-ketchikan', ['lady-ketchikan/01', 'mulan-the-brave/01', 'lady-ketchikan/02'])).toBe(2)
  })

  it('counts zero for a horse with no images', () => {
    expect(imageCountFromKeys('lady-ketchikan', [])).toBe(0)
  })

  it('refuses a gap in the run', () => {
    expect(() => imageCountFromKeys('lady-ketchikan', ['lady-ketchikan/01', 'lady-ketchikan/03'])).toThrow(/no gap/)
  })

  it('refuses a repeated number', () => {
    expect(() => imageCountFromKeys('lady-ketchikan', ['lady-ketchikan/01', 'lady-ketchikan/01'])).toThrow(/repeated/)
  })

  it('refuses an off-convention key in the folder', () => {
    expect(() => imageCountFromKeys('lady-ketchikan', ['lady-ketchikan/01.jpg'])).toThrow(/off-convention/)
  })

  it('pins the minimum for Available at three', () => {
    expect(MIN_IMAGES_FOR_AVAILABLE).toBe(3)
  })
})

describe('drift traps on the module source', () => {
  it('hardcodes no bucket name', () => {
    expect(STORAGE_SOURCE).not.toMatch(/evolution-v2-horse-images/)
  })

  it('hardcodes no public base URL, so no development host can become the default', () => {
    expect(STORAGE_SOURCE).not.toMatch(/r2\.dev/)
    expect(STORAGE_SOURCE).not.toMatch(/https:\/\/pub-/)
  })

  it('names no old media bucket', () => {
    expect(STORAGE_SOURCE).not.toMatch(/evolution-media/)
    expect(STORAGE_SOURCE).not.toMatch(/cdn\.evolutionstables\.nz/)
  })

  it('holds no module-level client and declares no mutable module state', () => {
    expect(STORAGE_SOURCE).not.toMatch(/^const\s+\w*[Cc]lient\s*=/m)
    expect(STORAGE_SOURCE).not.toMatch(/\blet\s+\w/)
  })

  it('imports no Supabase client, so private files cannot be routed here', () => {
    expect(STORAGE_SOURCE).not.toMatch(/from '@supabase/)
  })
})
