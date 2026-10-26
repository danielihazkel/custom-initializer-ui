import type { FullstackChartDef, FullstackEntityDef } from '../../../types'
import { inputClass } from '../controls'
import { fieldOption, keyOption, relationOption } from '../fieldOptions'
import { moveItem } from '../reorder'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import {
  MAX_CHARTS, chartKindsFor, dateFields, defaultChartSeries, defaultOptionLabel, defaultReportGroupBy, relationKeys, reportGroupKeys,
  chartControl, groupByFields, pageLabel, reportCharts, retargetReport,
} from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'
import { AggFields, BucketSelect, DragGrip, EntitySelect, Field, MoveButtons, PresetFilters } from './fields'

export function ReportForm({ page, index, entities, errors, update, lossy, removed, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const entity = entities.find(e => e.name === page.entity)
  const charts = reportCharts(page)
  // One chart is sent as `chart`, several as `charts` — the backend takes either spelling.
  const setCharts = (next: FullstackChartDef[]) =>
    update(index, next.length <= 1 ? { chart: next[0] ?? {}, charts: undefined } : { charts: next, chart: undefined })

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="The report charts and filters this entity's rows">
        <EntitySelect
          label="Report entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          className="max-w-[12rem]"
          // The charts and filter keep whatever the new entity also has.
          onChange={name => {
            const { patch, dropped } = retargetReport(page, entities.find(e => e.name === name))
            lossy(`Reported on ${name} in “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      {charts.map((chart, ci) => (
        <div
          key={ci}
          {...(charts.length > 1 ? dnd.rowProps(`charts:${index}`, ci) : {})}
          className={`space-y-1 rounded border border-outline-variant px-2 py-1.5 ${dnd.isDragging(`charts:${index}`, ci) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`charts:${index}`, ci))}`}
          data-report-chart={ci}
          data-control={ci === 0 ? 'chart' : `chart${ci + 1}`}
        >
          <div className="flex items-center gap-1.5">
            {charts.length > 1 && <DragGrip dnd={dnd} list={`charts:${index}`} index={ci} />}
            {charts.length > 1 && (
              <MoveButtons
                label={`chart ${ci + 1}`}
                canUp={ci > 0}
                canDown={ci < charts.length - 1}
                onMove={delta => setCharts(moveItem(charts, ci, ci + delta))}
              />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Chart {charts.length > 1 ? ci + 1 : ''}{ci === 0 && <span className="font-normal normal-case tracking-normal"> · with the totals table</span>}
            </span>
            <span className="flex-1" />
            {charts.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  removed?.(`Removed chart ${ci + 1} from “${pageLabel(page)}”`)
                  setCharts(charts.filter((_, i) => i !== ci))
                }}
                className={ICON_BUTTON}
                aria-label={`Remove chart ${ci + 1}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
          <ChartFields
            chart={chart}
            chartIndex={ci}
            entity={entity}
            errors={errors}
            onChange={patch => setCharts(charts.map((c, i) => (i === ci ? { ...c, ...patch } : c)))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setCharts([...charts, {}])}
        disabled={charts.length >= MAX_CHARTS}
        className={SMALL_BUTTON}
        title={charts.length >= MAX_CHARTS ? `A report can have at most ${MAX_CHARTS} charts` : undefined}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
        Add chart
      </button>
      <PresetFilters filter={page.presetFilter} entity={entity} errors={errors} onChange={presetFilter => update(index, { presetFilter })} />
    </div>
  )
}

/** One report chart: what it groups by (a breakdown or a time series), its bucket and reduction. */
function ChartFields({ chart, chartIndex, entity, errors, onChange }: {
  chart: FullstackChartDef
  chartIndex: number
  entity: FullstackEntityDef | undefined
  errors: Record<string, string>
  onChange: (patch: Partial<FullstackChartDef>) => void
}) {
  const effectiveGroupBy = chart.groupBy ?? defaultReportGroupBy(entity)
  const overTime = !!effectiveGroupBy && dateFields(entity).some(f => f.name === effectiveGroupBy)
  const setChart = onChange
  const groupKey = chartControl(chartIndex, 'groupBy')
  const bucketKey = chartControl(chartIndex, 'bucket')
  const fieldKey = chartControl(chartIndex, 'field')
  const kindKey = chartControl(chartIndex, 'kind')
  const seriesKey = chartControl(chartIndex, 'series')
  const byRelation = !!effectiveGroupBy && relationKeys(entity).includes(effectiveGroupBy)
  const kinds = chartKindsFor(overTime, byRelation)
  // A new grouping keeps the drawing only when it still fits (a donut cannot draw a date).
  const regroup = (groupBy: string | undefined) => {
    const by = groupBy ?? defaultReportGroupBy(entity)
    const time = !!by && dateFields(entity).some(f => f.name === by)
    const fits = !chart.kind || chartKindsFor(time, !!by && relationKeys(entity).includes(by)).some(k => k.value === chart.kind)
    setChart({ groupBy, bucket: undefined, ...(fits ? {} : { kind: undefined, series: undefined }), ...(chart.series === by ? { series: undefined } : {}) })
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1" data-control={groupKey}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Group by</span>
          <select
            aria-label="Group by"
            aria-invalid={Boolean(errors[groupKey])}
            value={chart.groupBy ?? ''}
            onChange={e => regroup(e.target.value || undefined)}
            className={`${inputClass(errors[groupKey])} max-w-[12rem] py-1 text-xs`}
          >
            <option value="">{defaultOptionLabel(defaultReportGroupBy(entity), 'enum, boolean or date', k => keyOption(entity, k))}</option>
            {groupByFields(entity).length > 0 && (
              <optgroup label="Breakdown">
                {groupByFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
              </optgroup>
            )}
            {dateFields(entity).length > 0 && (
              <optgroup label="Over time">
                {dateFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
              </optgroup>
            )}
            {relationKeys(entity).length > 0 && (
              <optgroup label="By related record">
                {relationKeys(entity).map(k => <option key={k} value={k}>{relationOption(k)}</option>)}
              </optgroup>
            )}
            {chart.groupBy && !reportGroupKeys(entity).includes(chart.groupBy) && (
              <option value={chart.groupBy}>{chart.groupBy}</option>
            )}
          </select>
        </label>
        {overTime && (
          <span data-control={bucketKey}><BucketSelect value={chart.bucket} onChange={bucket => setChart({ bucket })} /></span>
        )}
        <label className="flex flex-col gap-1" data-control={kindKey}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Draw as</span>
          <select
            aria-label={`Chart ${chartIndex + 1} kind`}
            aria-invalid={Boolean(errors[kindKey])}
            value={chart.kind ?? ''}
            onChange={e => {
              const kind = (e.target.value || undefined) as FullstackChartDef['kind']
              setChart({ kind, ...(kind === 'stacked' ? {} : { series: undefined }), ...(kind === 'table' ? { table: undefined } : {}) })
            }}
            className={`${inputClass(errors[kindKey])} max-w-[10rem] py-1 text-xs`}
          >
            <option value="">{overTime ? 'Line (default)' : 'Bars (default)'}</option>
            {kinds.filter(k => k.value !== (overTime ? 'line' : 'bar')).map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            {chart.kind && !kinds.some(k => k.value === chart.kind) && <option value={chart.kind}>{chart.kind}</option>}
          </select>
        </label>
        {chart.kind === 'stacked' && (
          <label className="flex flex-col gap-1" data-control={seriesKey}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Split by</span>
            <select
              aria-label={`Chart ${chartIndex + 1} series`}
              aria-invalid={Boolean(errors[seriesKey])}
              value={chart.series ?? ''}
              onChange={e => setChart({ series: e.target.value || undefined })}
              className={`${inputClass(errors[seriesKey])} max-w-[12rem] py-1 text-xs`}
            >
              <option value="">{defaultOptionLabel(defaultChartSeries(entity, effectiveGroupBy), 'second enum or boolean', k => keyOption(entity, k))}</option>
              {groupByFields(entity).filter(f => f.name !== effectiveGroupBy).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
            </select>
          </label>
        )}
        <span className="inline-flex flex-wrap items-center gap-2" data-control={fieldKey}>
          <AggFields
            agg={chart.agg}
            field={chart.field}
            entity={entity}
            error={errors[fieldKey]}
            onChange={patch => setChart(patch)}
          />
        </span>
        <label className="inline-flex items-center gap-1.5 pb-1 text-xs text-on-surface" title="The grouped totals under the chart (by default only under the first chart)">
          <input
            type="checkbox"
            className="accent-primary"
            aria-label={`Totals table under chart ${chartIndex + 1}`}
            checked={chart.kind === 'table' || (chart.table ?? chartIndex === 0)}
            disabled={chart.kind === 'table'}
            onChange={e => setChart({ table: e.target.checked === (chartIndex === 0) ? undefined : e.target.checked })}
          />
          Totals table
        </label>
      </div>
      {errors[groupKey] && <p className="text-[11px] text-error">{errors[groupKey]}</p>}
      {errors[fieldKey] && <p className="text-[11px] text-error">{errors[fieldKey]}</p>}
      {errors[bucketKey] && <p className="text-[11px] text-error">{errors[bucketKey]}</p>}
      {errors[kindKey] && <p className="text-[11px] text-error">{errors[kindKey]}</p>}
      {errors[seriesKey] && <p className="text-[11px] text-error">{errors[seriesKey]}</p>}
    </div>
  )
}
