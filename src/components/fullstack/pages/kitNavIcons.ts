import { createContext, useContext } from 'react'

/** The nav icons the model's design kit adds (KitManifest.navIcons), for the icon picker. */
export const KitNavIcons = createContext<readonly string[]>([])

export const useKitNavIcons = () => useContext(KitNavIcons)

/** A kit icon's label: `ShieldIcon` → "Shield". */
export const kitIconLabel = (name: string) => name.replace(/Icon$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
