export function GenerateButton({ form, selected }) {
  function handleGenerate() {
    const url = new URL('/starter.zip', window.location.origin)
    url.searchParams.set('type', form.type)
    url.searchParams.set('language', form.language)
    url.searchParams.set('bootVersion', form.bootVersion)
    url.searchParams.set('groupId', form.groupId)
    url.searchParams.set('artifactId', form.artifactId)
    url.searchParams.set('name', form.name)
    url.searchParams.set('description', form.description)
    url.searchParams.set('packageName', form.packageName)
    url.searchParams.set('packaging', form.packaging)
    url.searchParams.set('javaVersion', form.javaVersion)
    if (selected.length > 0) {
      url.searchParams.set('dependencies', selected.join(','))
    }

    const a = document.createElement('a')
    a.href = url.toString()
    a.download = `${form.artifactId}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="generate-bar">
      <button type="button" className="generate-btn" onClick={handleGenerate}>
        Generate Project
      </button>
      <span className="generate-hint">
        {selected.length > 0
          ? `${selected.length} dependenc${selected.length === 1 ? 'y' : 'ies'} selected`
          : 'No dependencies selected'}
      </span>
    </div>
  )
}
