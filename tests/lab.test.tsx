import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import { LAB_SOURCES } from '../hooks/lab'

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'FP lab',
  isFocused: false,
  bodyColumns: 58,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

function engine(on: On) {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('fs.write', () => ({ value: undefined }))
}

describe('the lab', () => {
  test('every page draws a valid tree on desktop, and presses work', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan-lab', props: PANE_PROPS })
    expect(await ui.find({ text: /Flight Plan lab/ })).toBeDefined()
    expect(await ui.find({ text: /Bar A/ })).toBeDefined()
    await ui.press({ key: 'q-s2a-0' })
    expect(await ui.find({ text: /● fills all the way/ })).toBeDefined()

    await ui.press({ key: 'page-pictures' })
    expect(await ui.find({ text: /Which ways fill the width/ })).toBeDefined()
    await ui.press({ key: 'p-s4-2' })
    await ui.press({ key: 'replay' })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn.match(/"type":"Svg"/g)?.length).toBeGreaterThan(8)

    await ui.press({ key: 'page-busy' })
    expect(await ui.find({ text: /The busy sky/ })).toBeDefined()
    await ui.press({ key: 'done' })
    expect(await ui.find({ text: /Sent to Claude/ })).toBeDefined()
    await ui.unmount()
  })

  test('narrow and inline panes still draw', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan-lab', props: { ...PANE_PROPS, bodyColumns: 30, placement: 'inline' } })
    expect(await ui.find({ text: /Flight Plan lab/ })).toBeDefined()
    await ui.unmount()
  })

  test('the terminal gets a note instead of pictures', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'terminal', component: 'Pane', requestId: 'flightplan-lab', props: PANE_PROPS })
    expect(await ui.find({ text: /needs the Claude desktop app/ })).toBeDefined()
    await ui.unmount()
  })

  test('the pictures are small, script-free and well formed', () => {
    for (const [name, source] of Object.entries(LAB_SOURCES)) {
      expect(source.length).toBeLessThan(131072)
      expect(source.startsWith('<svg ')).toBe(true)
      expect(source.endsWith('</svg>')).toBe(true)
      expect(/<script|\son[a-z]+=|NaN|undefined/.test(source)).toBe(false)
      if (name === 'BUSY') expect(source.length).toBeLessThan(32768)
    }
  })
})
