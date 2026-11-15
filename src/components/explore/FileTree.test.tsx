import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { java } from '@codemirror/lang-java'
import { FileTree, collectChangedDirs, mergeRemovedIntoTree, visibleRows } from './FileTree'
import { diffRows, foldUnchanged, hunkStarts, isFold, pairRows } from '../../utils/diffRows'
import { searchFiles } from '../../utils/searchFiles'
import { tokenizeLines } from '../../utils/highlightCode'
import type { FileStatus, TreeNode } from '../../types'

const file = (path: string): TreeNode => ({ name: path.split('/').pop()!, path, type: 'file', children: [] })
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split('/').pop()!, path, type: 'directory', children })

const tree: TreeNode[] = [
  dir('src', [
    dir('src/main', [file('src/main/App.java'), file('src/main/KafkaConfig.java')]),
    dir('src/test', [file('src/test/AppTests.java')]),
  ]),
  file('pom.xml'),
  file('README.md'),
]

const paths = (rows: { node: TreeNode }[]) => rows.map(r => r.node.path)
const shown = () => screen.getAllByRole('treeitem').map(el => el.getAttribute('data-tree-path'))

describe('visibleRows', () => {
  it('lists everything that is not inside a collapsed directory', () => {
    expect(paths(visibleRows(tree, new Set(), ''))).toEqual([
      'src', 'src/main', 'src/main/App.java', 'src/main/KafkaConfig.java', 'src/test', 'src/test/AppTests.java', 'pom.xml', 'README.md',
    ])
    expect(paths(visibleRows(tree, new Set(['src/main']), ''))).toEqual(['src', 'src/main', 'src/test', 'src/test/AppTests.java', 'pom.xml', 'README.md'])
  })

  it('narrows to matching files under their directories, opening collapsed ones', () => {
    const rows = visibleRows(tree, new Set(['src']), 'kafka')
    expect(paths(rows)).toEqual(['src', 'src/main', 'src/main/KafkaConfig.java'])
    expect(rows[2].ranges).toEqual([[0, 5]])
    // A folder path is a filter too (the breadcrumbs use it).
    expect(paths(visibleRows(tree, new Set(), 'src/test/'))).toEqual(['src', 'src/test', 'src/test/AppTests.java'])
    expect(visibleRows(tree, new Set(), 'nothing')).toEqual([])
  })
})

describe('FileTree', () => {
  it('selects a file on click and folds a directory', () => {
    const onSelect = vi.fn()
    render(<FileTree tree={tree} selected="pom.xml" onSelect={onSelect} />)
    expect(screen.getByRole('treeitem', { selected: true }).getAttribute('data-tree-path')).toBe('pom.xml')

    fireEvent.click(screen.getByText('App.java'))
    expect(onSelect).toHaveBeenCalledWith('src/main/App.java')

    fireEvent.click(screen.getByText('main'))
    expect(shown()).not.toContain('src/main/App.java')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('is one Tab stop, walked with the arrows', () => {
    const onSelect = vi.fn()
    render(<FileTree tree={tree} selected="pom.xml" onSelect={onSelect} />)
    const stops = () => screen.getAllByRole('treeitem').filter(el => el.tabIndex === 0)
    expect(stops().map(el => el.getAttribute('data-tree-path'))).toEqual(['pom.xml'])

    const root = screen.getByRole('tree')
    fireEvent.keyDown(root, { key: 'Home' })
    expect(stops()[0].getAttribute('data-tree-path')).toBe('src')
    expect(document.activeElement).toBe(stops()[0])

    // → on an open directory steps into it; ← on a file goes to its directory; ← again folds it.
    fireEvent.keyDown(root, { key: 'ArrowRight' })
    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(stops()[0].getAttribute('data-tree-path')).toBe('src/main/App.java')
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('src/main/App.java')
    fireEvent.keyDown(root, { key: 'ArrowLeft' })
    expect(stops()[0].getAttribute('data-tree-path')).toBe('src/main')
    fireEvent.keyDown(root, { key: 'ArrowLeft' })
    expect(screen.getByText('main').closest('[role="treeitem"]')!.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    expect(stops()[0].getAttribute('data-tree-path')).toBe('src/test')
    fireEvent.keyDown(root, { key: 'End' })
    expect(stops()[0].getAttribute('data-tree-path')).toBe('README.md')
  })

  it('marks what a diff changed, on files and on the directories above them', () => {
    const statuses = new Map<string, FileStatus>([
      ['src/main/KafkaConfig.java', 'added'], ['pom.xml', 'modified'], ['src/main/App.java', 'unchanged'], ['old/Gone.java', 'removed'],
    ])
    const merged = mergeRemovedIntoTree(tree, ['old/Gone.java'])
    render(<FileTree tree={merged} selected="" onSelect={() => {}} fileStatuses={statuses} changedDirs={collectChangedDirs(statuses)} />)
    expect(screen.getByText('KafkaConfig.java').closest('[role="treeitem"]')!.querySelector('[aria-label="added"]')).toBeTruthy()
    expect(screen.getByText('Gone.java').className).toContain('line-through')
    expect(screen.getByText('main').closest('[role="treeitem"]')!.querySelector('[aria-label="Has changes"]')).toBeTruthy()
    expect(screen.getByText('test').closest('[role="treeitem"]')!.querySelector('[aria-label="Has changes"]')).toBeNull()
    // The tree that was passed in is not touched.
    expect(tree.some(n => n.path === 'old')).toBe(false)
  })

  it('says so when a filter matches nothing', () => {
    render(<FileTree tree={tree} selected="" onSelect={() => {}} filter="zzz" />)
    expect(document.querySelector('[data-tree-empty]')?.textContent).toContain('zzz')
  })
})

describe('the diff model', () => {
  const lines = (n: number, prefix = 'line') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`)

  it('numbers lines on both sides and finds where each change starts', () => {
    const before = ['a', 'b', 'c', 'd'].join('\n')
    const after = ['a', 'B', 'c', 'd', 'e'].join('\n')
    const rows = diffRows('modified', before, after)
    expect(rows.map(r => `${r.type[0]}${r.oldLine ?? '-'}/${r.newLine ?? '-'}`)).toEqual(['u1/1', 'r2/-', 'a-/2', 'u3/3', 'r4/-', 'a-/4', 'a-/5'])
    expect(hunkStarts(rows)).toEqual([1, 4])

    expect(diffRows('added', '', 'x\ny').map(r => r.newLine)).toEqual([1, 2])
    expect(diffRows('removed', 'x\ny\nz', '').every(r => r.type === 'removed')).toBe(true)
  })

  it('folds a long unchanged stretch, keeping context beside the changes', () => {
    const before = [...lines(30), 'old'].join('\n')
    const after = [...lines(30), 'new'].join('\n')
    const rows = diffRows('modified', before, after)
    const blocks = foldUnchanged(rows)
    // The file starts unchanged: no context is owed at the top, three lines are before the change.
    expect(isFold(blocks[0])).toBe(true)
    expect(isFold(blocks[0]) && blocks[0].rows.length).toBe(27)
    expect(blocks.slice(1).filter(isFold)).toEqual([])
    expect(blocks).toHaveLength(1 + 3 + 2)
    // Opened, it is all there.
    expect(foldUnchanged(rows, new Set([0]))).toHaveLength(rows.length)
    // A short stretch is not worth a fold.
    expect(foldUnchanged(diffRows('modified', 'a\nb\nc\nold', 'a\nb\nc\nnew')).some(isFold)).toBe(false)
  })

  it('pairs removed lines with added ones side by side, padding the shorter side', () => {
    const rows = diffRows('modified', 'keep\nold 1\nold 2\nold 3\nend', 'keep\nnew 1\nend')
    const pairs = pairRows(rows).map(p => `${p.left?.oldLine ?? '·'}|${p.right?.newLine ?? '·'}`)
    expect(pairs).toEqual(['1|1', '2|2', '3|·', '4|·', '5|3'])
  })
})

describe('searchFiles', () => {
  const files = [
    { path: 'pom.xml', content: '<artifactId>demo</artifactId>\n<name>Demo</name>' },
    { path: 'src/App.java', content: `class App {\n  // ${'x'.repeat(100)} DEMO ${'y'.repeat(200)}\n}` },
  ]

  it('finds every line holding the words, whatever the case, and where', () => {
    const { hits, more } = searchFiles(files, 'demo')
    expect(more).toBe(false)
    expect(hits.map(h => `${h.path}:${h.line}`)).toEqual(['pom.xml:1', 'pom.xml:2', 'src/App.java:2'])
    for (const h of hits) expect(h.text.slice(h.from, h.to).toLowerCase()).toBe('demo')
    // A long line is cut around the match.
    expect(hits[2].text.startsWith('…')).toBe(true)
    expect(hits[2].text.length).toBeLessThan(140)
  })

  it('wants two letters, and stops at the limit', () => {
    expect(searchFiles(files, 'd').hits).toEqual([])
    const many = [{ path: 'big.txt', content: Array.from({ length: 50 }, () => 'needle').join('\n') }]
    const { hits, more } = searchFiles(many, 'needle', 10)
    expect(hits).toHaveLength(10)
    expect(more).toBe(true)
  })
})

describe('tokenizeLines', () => {
  it('colours code by its grammar, one array of tokens per line', () => {
    const lines = tokenizeLines('public class App {\n  // hello\n  int n = 42;\n}', [java()])
    expect(lines).toHaveLength(4)
    expect(lines.map(l => l.map(t => t.text).join(''))).toEqual(['public class App {', '  // hello', '  int n = 42;', '}'])
    const classOf = (line: number, text: string) => lines[line].find(t => t.text === text)?.cls
    expect(classOf(0, 'public')).toContain('tok-keyword')
    expect(classOf(1, '// hello')).toContain('tok-comment')
    expect(classOf(2, '42')).toContain('tok-number')
  })

  it('leaves text without a grammar plain, blank lines included', () => {
    expect(tokenizeLines('one\n\nthree', [])).toEqual([[{ text: 'one' }], [], [{ text: 'three' }]])
  })
})
