import { describe, it, expect } from 'vitest'
import {
  clearShareFromLocation, decodeShare, encodeShare, readShareFromLocation, writeShareToLocation, SHARE_PARAM,
} from './shareLink'
import { DEFAULT_PROJECT_META, type FullstackSnapshot } from './snapshot'

const snapshot: FullstackSnapshot = {
  meta: {
    ...DEFAULT_PROJECT_META,
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

  it('writes the model into the URL next to other params, reads it back, and clears only itself', () => {
    window.history.replaceState(null, '', '/?tab=fullstack')
    expect(writeShareToLocation(snapshot)).toBe('written')
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('fullstack')
    expect(readShareFromLocation()).toEqual(snapshot)
    clearShareFromLocation()
    expect(new URLSearchParams(window.location.search).has(SHARE_PARAM)).toBe(false)
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('fullstack')
  })

  it('reports a model too large for a link and leaves the URL without it', () => {
    window.history.replaceState(null, '', '/?tab=fullstack')
    writeShareToLocation(snapshot)
    const huge: FullstackSnapshot = {
      ...snapshot,
      entities: [{ ...snapshot.entities[0], sourceSql: 'x'.repeat(70_000) }],
    }
    expect(writeShareToLocation(huge)).toBe('too-large')
    expect(new URLSearchParams(window.location.search).has(SHARE_PARAM)).toBe(false)
  })
})
