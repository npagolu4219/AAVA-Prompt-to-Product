import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks'
import { defaultValues, secretKeys, type DeployConfig, type EnvVar } from '@/services/publish/deployConfig'
import type { CloudProvider } from '@/types/export'

interface Persisted {
  provider: CloudProvider
  values: Partial<Record<CloudProvider, Record<string, string>>>
  envVars: EnvVar[]
  apiUrl: string
}

const KEY = 'aava-p2p.deploy-settings.v1'

/** Provider settings shared by Export and Publish. Secret fields are stripped before persisting. */
export function useDeploySettings() {
  const [state, setState] = useLocalStorage<Persisted>(KEY, { provider: 'vercel', values: {}, envVars: [], apiUrl: '' })

  const valuesFor = useCallback((p: CloudProvider) => ({ ...defaultValues(p), ...(state.values[p] ?? {}) }), [state.values])

  const setValue = useCallback(
    (p: CloudProvider, key: string, value: string) => {
      if (secretKeys(p).includes(key)) return // never persisted
      setState((s) => ({ ...s, values: { ...s.values, [p]: { ...(s.values[p] ?? {}), [key]: value } } }))
    },
    [setState],
  )

  const config = useCallback((p: CloudProvider): DeployConfig => ({ provider: p, values: valuesFor(p), envVars: state.envVars }), [valuesFor, state.envVars])

  return {
    provider: state.provider,
    setProvider: (provider: CloudProvider) => setState((s) => ({ ...s, provider })),
    envVars: state.envVars,
    setEnvVars: (envVars: EnvVar[]) => setState((s) => ({ ...s, envVars })),
    apiUrl: state.apiUrl,
    setApiUrl: (apiUrl: string) => setState((s) => ({ ...s, apiUrl })),
    valuesFor,
    setValue,
    config,
  }
}

export type DeploySettings = ReturnType<typeof useDeploySettings>
