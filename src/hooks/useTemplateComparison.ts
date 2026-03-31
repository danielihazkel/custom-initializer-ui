import { useMemo } from 'react'
import type { StarterTemplate, InitializrMetadata, DependencyExtensions } from '../types'

export interface SettingComparison {
  field: string
  values: (string | null)[]
  allSame: boolean
}

export interface SubOptionComparison {
  optId: string
  optLabel: string
  presence: boolean[]
}

export interface DepComparison {
  depId: string
  depName: string
  depDescription: string
  groupName: string
  presence: boolean[]
  subOptions: SubOptionComparison[]
  shared: boolean   // all templates have it
  unique: boolean   // exactly one template has it
}

export interface ComparisonResult {
  settings: SettingComparison[]
  dependencies: DepComparison[]
  sharedCount: number
  uniqueCount: number
  differenceCount: number
}

export function useTemplateComparison(
  selectedTemplates: StarterTemplate[],
  metadata: InitializrMetadata | null,
  extensions: DependencyExtensions
): ComparisonResult {
  return useMemo(() => {
    if (selectedTemplates.length < 2) {
      return { settings: [], dependencies: [], sharedCount: 0, uniqueCount: 0, differenceCount: 0 }
    }

    // Settings comparison
    const settings: SettingComparison[] = [
      {
        field: 'Boot Version',
        values: selectedTemplates.map(t => t.bootVersion),
        allSame: new Set(selectedTemplates.map(t => t.bootVersion ?? '')).size === 1,
      },
      {
        field: 'Java Version',
        values: selectedTemplates.map(t => t.javaVersion),
        allSame: new Set(selectedTemplates.map(t => t.javaVersion ?? '')).size === 1,
      },
      {
        field: 'Packaging',
        values: selectedTemplates.map(t => t.packaging),
        allSame: new Set(selectedTemplates.map(t => t.packaging ?? '')).size === 1,
      },
    ]

    // Build dep name/group lookup from metadata
    const depNameMap = new Map<string, string>()
    const depDescMap = new Map<string, string>()
    const depGroupMap = new Map<string, string>()
    if (metadata) {
      for (const group of metadata.dependencies.values) {
        for (const dep of group.values) {
          depNameMap.set(dep.id, dep.name)
          depDescMap.set(dep.id, dep.description ?? '')
          depGroupMap.set(dep.id, group.name)
        }
      }
    }

    // Collect all dep IDs in order of first appearance
    const allDepIds: string[] = []
    const seen = new Set<string>()
    for (const t of selectedTemplates) {
      for (const d of t.dependencies) {
        if (!seen.has(d.depId)) {
          seen.add(d.depId)
          allDepIds.push(d.depId)
        }
      }
    }

    // Build per-template dep+suboption sets
    const templateDepSets = selectedTemplates.map(t => new Set(t.dependencies.map(d => d.depId)))
    const templateSubOptionMap = selectedTemplates.map(t => {
      const m = new Map<string, Set<string>>()
      for (const d of t.dependencies) {
        m.set(d.depId, new Set(d.subOptions))
      }
      return m
    })

    const dependencies: DepComparison[] = allDepIds.map(depId => {
      const presence = selectedTemplates.map((_, i) => templateDepSets[i].has(depId))
      const presentCount = presence.filter(Boolean).length

      // Collect all sub-option IDs for this dep across selected templates
      const allOptIds: string[] = []
      const seenOpts = new Set<string>()
      for (const subMap of templateSubOptionMap) {
        const opts = subMap.get(depId)
        if (opts) {
          for (const optId of opts) {
            if (!seenOpts.has(optId)) {
              seenOpts.add(optId)
              allOptIds.push(optId)
            }
          }
        }
      }

      const subOptions: SubOptionComparison[] = allOptIds.map(optId => {
        const optLabel = extensions[depId]?.find(o => o.id === optId)?.label ?? optId
        return {
          optId,
          optLabel,
          presence: selectedTemplates.map((_, i) => templateSubOptionMap[i].get(depId)?.has(optId) ?? false),
        }
      })

      return {
        depId,
        depName: depNameMap.get(depId) ?? depId,
        depDescription: depDescMap.get(depId) ?? '',
        groupName: depGroupMap.get(depId) ?? 'Other',
        presence,
        subOptions,
        shared: presentCount === selectedTemplates.length,
        unique: presentCount === 1,
      }
    })

    const sharedCount = dependencies.filter(d => d.shared).length
    const uniqueCount = dependencies.filter(d => d.unique).length
    const differenceCount = dependencies.filter(d => !d.shared).length

    return { settings, dependencies, sharedCount, uniqueCount, differenceCount }
  }, [selectedTemplates, metadata, extensions])
}
