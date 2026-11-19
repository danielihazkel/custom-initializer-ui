import { createContext } from 'react'
import type { FullstackEntityDef } from '../../types'

/**
 * The whole model, for a check that reads past one entity — a rule over a linked row
 * (`costCenter.budget`). A context rather than a prop, so the memoized entity cards do not all
 * render again on every edit; only what reads it does.
 */
export const ModelEntities = createContext<readonly FullstackEntityDef[]>([])
