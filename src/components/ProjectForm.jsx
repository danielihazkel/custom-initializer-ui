export function ProjectForm({ values, onChange }) {
  function handle(field) {
    return e => {
      const val = e.target.value
      const updates = { [field]: val }

      if (field === 'artifactId') {
        updates.name = val
        updates.packageName = `${values.groupId}.${val}`.replace(/-/g, '_')
      }
      if (field === 'groupId') {
        updates.packageName = `${val}.${values.artifactId}`.replace(/-/g, '_')
      }

      onChange(updates)
    }
  }

  return (
    <section className="form-section">
      <h2>Project</h2>
      <div className="field-grid">
        <label>
          <span>Group</span>
          <input value={values.groupId} onChange={handle('groupId')} />
        </label>
        <label>
          <span>Artifact</span>
          <input value={values.artifactId} onChange={handle('artifactId')} />
        </label>
        <label>
          <span>Name</span>
          <input value={values.name} onChange={handle('name')} />
        </label>
        <label className="full-width">
          <span>Description</span>
          <input value={values.description} onChange={handle('description')} />
        </label>
        <label className="full-width">
          <span>Package name</span>
          <input value={values.packageName} onChange={handle('packageName')} />
        </label>
      </div>
    </section>
  )
}
