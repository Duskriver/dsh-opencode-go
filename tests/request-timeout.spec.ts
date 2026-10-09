import { expect, it } from 'vitest'
import { PlainConfig } from '../src/config.ts'

it('provides finite preparation and whole-request deadlines', () => {
  expect(PlainConfig()).toMatchObject({ requestPreparationTimeoutMs: 60_000, requestTimeoutMs: 1_800_000 })
})

it.each(['requestPreparationTimeoutMs', 'requestTimeoutMs'])('rejects invalid %s values before installing timer policy', field => {
  for (const value of [0, -1, Infinity, NaN, 2_147_483_648, '30']) {
    expect(() => PlainConfig({ [field]: value })).toThrow()
  }
  expect(PlainConfig({ [field]: 30 })[field as 'requestTimeoutMs']).toBe(30)
})
