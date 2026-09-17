import { describe, it, expect } from 'vitest'
import { decodeShare, encodeShare } from './shareLink'
import type { FullstackSnapshot } from './snapshot'

const snapshot: FullstackSnapshot = {
  meta: {
    groupId: 'com.menora', artifactId: 'shop', packageName: 'com.menora.shop', domainPackage: '',
    bootVersion: '3.2.1', javaVersion: '21', dashboardTitle: 'חנות', dashboardOverview: '',
  },
  entities: [
    { name: 'Order', label: 'הזמנה', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }] },
  ],
  selectedDeps: ['data-jpa', 'web'],
  scaffoldOpts: ['audit'],
  backendSet: 'spring-jpa-crud',
  frontendSet: 'react-tailwind-crud',
}

describe('shareLink', () => {
  it('round-trips a snapshot, including non-ASCII labels, through a URL-safe string', () => {
    const encoded = encodeShare(snapshot)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeShare(encoded)).toEqual(snapshot)
  })

  it('returns null for garbage or a wrong shape instead of throwing', () => {
    expect(decodeShare('not base64!!')).toBeNull()
    expect(decodeShare(btoa('{"meta":{}}'))).toBeNull()
  })
})
