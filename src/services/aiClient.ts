import type { AiGeneratedFile, ProjectFormValues } from '../types'

interface AiGenerationResponse {
  files: AiGeneratedFile[]
}

export async function postAiGenerateFiles(
  form: ProjectFormValues,
  dependencies: string[],
  selectedOptions: Record<string, string[]>,
  prompt: string,
  signal?: AbortSignal,
): Promise<AiGeneratedFile[]> {
  const body = {
    form: {
      groupId: form.groupId,
      artifactId: form.artifactId,
      name: form.name,
      description: form.description,
      packageName: form.packageName,
      bootVersion: form.bootVersion,
      javaVersion: form.javaVersion,
      packaging: form.packaging,
    },
    dependencies,
    selectedOptions,
    prompt,
  }
  const res = await fetch('/ai/generate-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = await res.json()
      if (err && typeof err === 'object') {
        detail = err.detail || err.error || detail
      }
    } catch {
      // body was not JSON; keep the HTTP status fallback
    }
    throw new Error(detail)
  }
  const data = (await res.json()) as AiGenerationResponse
  return data.files ?? []
}
