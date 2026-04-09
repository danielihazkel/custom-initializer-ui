import { useMetadata } from './useMetadata'

export interface AdminMetadataOptions {
  javaVersions: string[]
  bootVersions: string[]
  packagings: string[]
  loading: boolean
}

export function useAdminMetadata(): AdminMetadataOptions {
  const { metadata, loading } = useMetadata()
  return {
    javaVersions: metadata?.javaVersion.values.map(v => v.id) ?? [],
    bootVersions: metadata?.bootVersion.values.map(v => v.id) ?? [],
    packagings: metadata?.packaging.values.map(v => v.id) ?? [],
    loading,
  }
}
