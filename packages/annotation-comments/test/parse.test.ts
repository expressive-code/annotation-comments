import { describe, expect, test } from 'vitest'
import type { AnnotationComment, AnnotationTag } from '../src/core/types'
import { parseAnnotationComments } from '../src/core/parse'
import { splitCodeLines } from './utils'

type PartialAnnotationComment = Partial<Omit<AnnotationComment, 'tag'>> & { tag: Partial<AnnotationTag> }

describe('parseAnnotationComments()', () => {
	describe('Successfully parses code examples in various languages', () => {
		test('JavaScript (including JSDoc)', () => {
			const jsTestCode = `
import { defineConfig } from 'astro/config';

/**
 * Some JSDoc test.
 *
 * [!note:test] The \`test\` function here is just an example
 * and doesn't do anything meaningful.
 *
 * Also note that we just added a [!note] tag to an existing
 * JSDoc comment to create this note.
 */
export async function test(a, b, c) {
  let x = true
  let y = a.toString()
  const z = \`hello\${a === true ? 'x' : 'y'}\`
  const fn = () => "test\\nanother line"
}

// Single-line comment
var v = 300 // [!ins]
test(1, Math.min(6, 2), defineConfig.someProp || v)

export default defineConfig({
  markdown: {
    // [!note:"'some.example'"] This setting does not actually exist.
    'some.example': 2048,
    smartypants: false, // [!ins]
    /* [!ins] */ gfm: false,
  }
});
			`.trim()
			const comments = getComments(jsTestCode)
			expect(comments).toHaveLength(5)
			expect(comments).toMatchObject([
				{
					tag: { name: 'note', targetSearchQuery: 'test' },
					contents: [
						`The \`test\` function here is just an example`,
						`and doesn't do anything meaningful.`,
						``,
						`Also note that we just added a [!note] tag to an existing`,
						`JSDoc comment to create this note.`,
					],
					commentRange: { start: { line: 2 }, end: { line: 10 } },
					annotationRange: { start: { line: 5 }, end: { line: 9 } },
				},
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
				{
					tag: { name: 'note', targetSearchQuery: "'some.example'" },
					contents: [`This setting does not actually exist.`],
				},
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
			] as PartialAnnotationComment[])
		})

		test('CSS', () => {
			const cssTestCode = `
@media (min-width: 50em) {
  :root {
    --min-spacing-inline: calc(0.5vw - 1.5rem); /* [!ins] */
    /* [!del] */ color: blue;
  }
  body, html, .test[data-size="large"], #id {
    /* [!note:linear-gradient]
       As this [!note] points out, we let the browser
       create a gradient for us here. */
    background: linear-gradient(to top, #80f 1px, rgb(30, 90, 130) 50%);
  }
  .frame:focus-within :focus-visible ~ .copy button:not(:hover) {
    content: 'Hello \\000026 welcome!';
    opacity: 0.75;
  }
}
			`.trim()
			const comments = getComments(cssTestCode)
			expect(comments).toHaveLength(3)
			expect(comments).toMatchObject([
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
				{
					tag: { name: 'del', targetSearchQuery: undefined },
					contents: [],
				},
				{
					tag: { name: 'note', targetSearchQuery: 'linear-gradient' },
					contents: [
						// Content lines
						`As this [!note] points out, we let the browser`,
						`create a gradient for us here.`,
					],
					commentRange: { start: { line: 6 }, end: { line: 8 } },
					annotationRange: { start: { line: 6 }, end: { line: 8 } },
				},
			] as PartialAnnotationComment[])
		})

		test('Astro', () => {
			const astroTestCode = `
---
import Header from './Header.astro';
import Logo from './Logo.astro';
import Footer from './Footer.astro';

// [!note:title] By destructuring the \`Astro.props\` object,
// we can access the \`title\` prop passed to this component.
const { title } = Astro.props
---
<div id="content-wrapper" class="test">
  <Header />
  <Logo size="large"/>
  <!-- [!note:{title}] By wrapping any variable name in curly braces,
       we can output its value in the HTML template,
       as explained by this [!note] annotation. -->
  <h1>{title} &amp; some text</h1>
  <slot />  <!-- [!note] Children passed to the component will be inserted here -->
  <Footer />
</div>
			`.trim()
			const comments = getComments(astroTestCode)
			expect(comments).toHaveLength(3)
			expect(comments).toMatchObject([
				{
					tag: { name: 'note', targetSearchQuery: 'title' },
					contents: [
						// Content lines
						`By destructuring the \`Astro.props\` object,`,
						`we can access the \`title\` prop passed to this component.`,
					],
					commentRange: { start: { line: 5 }, end: { line: 6 } },
					annotationRange: { start: { line: 5 }, end: { line: 6 } },
				},
				{
					tag: { name: 'note', targetSearchQuery: '{title}' },
					contents: [
						// Content lines
						`By wrapping any variable name in curly braces,`,
						`we can output its value in the HTML template,`,
						`as explained by this [!note] annotation.`,
					],
				},
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [`Children passed to the component will be inserted here`],
				},
			] as PartialAnnotationComment[])
		})

		test('Python', () => {
			const pythonTestCode = `
import time

# [!note] This function will print a countdown from the given time,
# as explained by this # [!note] annotation.
def countdown(time_sec):
  while time_sec:
    mins, secs = divmod(time_sec, 60)
    timeformat = '{:02d}:{:02d}'.format(mins, secs)
    print(timeformat, end='\\r')
    time.sleep(1)
    time_sec -= 1 # [!note] This is important to actually count down
  print("stop")

countdown(5)
			`.trim()
			const comments = getComments(pythonTestCode)
			expect(comments).toMatchObject([
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [
						// Content lines
						`This function will print a countdown from the given time,`,
						`as explained by this # [!note] annotation.`,
					],
				},
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [`This is important to actually count down`],
				},
			] as PartialAnnotationComment[])
		})
	})

	test('Supports chaining multiple matching single-line annotations on the same line', () => {
		const lines = [
			`// [!note] This is the note content. // [!ins]`,
			`console.log('Inserted line with an attached note')`,
			`testCode() // [!mark] // [!note] It also works at the end of a line.`,
		]
		const comments = getComments(lines.join('\n'))
		expect(comments).toHaveLength(4)
		expect(comments).toMatchObject([
			{
				tag: { name: 'note', targetSearchQuery: undefined },
				annotationRange: { start: { line: 0 }, end: { line: 0, column: lines[0].indexOf(' // [!ins]') } },
				contents: [`This is the note content.`],
			},
			{
				tag: { name: 'ins', targetSearchQuery: undefined },
				annotationRange: { start: { line: 0, column: lines[0].indexOf(' // [!ins]') }, end: { line: 0 } },
				contents: [],
			},
			{
				tag: { name: 'mark', targetSearchQuery: undefined },
				annotationRange: {
					start: { line: 2, column: lines[2].indexOf(' // [!mark]') },
					end: { line: 2, column: lines[2].indexOf(' // [!note]') },
				},
				contents: [],
			},
			{
				tag: { name: 'note', targetSearchQuery: undefined },
				annotationRange: { start: { line: 2, column: lines[2].indexOf(' // [!note]') }, end: { line: 2 } },
				contents: [`It also works at the end of a line.`],
			},
		] as PartialAnnotationComment[])
	})

	describe('Supports ignoring unwanted annotations', () => {
		test('[!ignore-tags] ignores all annotations on the next line', () => {
			const lines = [
				`// [!before] This is before any ignores`,
				`console.log('Some code')`,
				`// [!ignore-tags]`,
				`testCode() // [!ignored] This should not be parsed`,
				`// [!after] This should be parsed again`,
			]
			const comments = getComments(lines.join('\n'))
			expect(comments).toHaveLength(2)
			expect(comments).toMatchObject([
				{
					tag: { name: 'before', targetSearchQuery: undefined },
					contents: [`This is before any ignores`],
				},
				// TODO: Expect the ignore-tags annotation comment to be present as well
				{
					tag: { name: 'after', targetSearchQuery: undefined },
					contents: [`This should be parsed again`],
				},
			] as PartialAnnotationComment[])
		})
		test('[!ignore-tags:2] ignores the next two lines', () => {
			const lines = [
				`// [!before] This is before any ignores`,
				`console.log('Some code')`,
				`// [!ignore-tags:2]`,
				`testCode() // [!ignored] This should not be parsed`,
				`// [!ignored] Still ignored`,
				`// [!after] This should be parsed again`,
			]
			const comments = getComments(lines.join('\n'))
			expect(comments).toHaveLength(2)
			expect(comments).toMatchObject([
				{
					tag: { name: 'before', targetSearchQuery: undefined },
					contents: [`This is before any ignores`],
				},
				// TODO: Expect the ignore-tags annotation comment to be present as well
				{
					tag: { name: 'after', targetSearchQuery: undefined },
					contents: [`This should be parsed again`],
				},
			] as PartialAnnotationComment[])
		})
		test('[!ignore-tags:note] ignores the next occurrence of "note"', () => {
			const lines = [
				`// [!before] This is before any ignores`,
				`// [!ignore-tags:note]`,
				`console.log('Some code')`,
				`testCode() // [!note] This should not be parsed`,
				`// [!note] This should be parsed again`,
			]
			const comments = getComments(lines.join('\n'))
			expect(comments).toHaveLength(2)
			expect(comments).toMatchObject([
				{
					tag: { name: 'before', targetSearchQuery: undefined },
					contents: [`This is before any ignores`],
				},
				// TODO: Expect the ignore-tags annotation comment to be present as well
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [`This should be parsed again`],
				},
			] as PartialAnnotationComment[])
		})
		test('[!ignore-tags:note,ins:3] ignores the next 3 occurrences of "note" and "ins"', () => {
			const lines = [
				`// [!before] This is before any ignores`,
				`// [!ignore-tags:note,ins:3]`,
				`console.log('Some code') // [!ins]`,
				`testCode() // [!note] This should not be parsed`,
				`// [!ins] // [!note] Still ignored`,
				`// [!ins] // [!note] Still ignored`,
				`console.log('Test') // [!ins]`,
				`// [!note] This should be parsed again`,
			]
			const comments = getComments(lines.join('\n'))
			expect(comments).toHaveLength(3)
			expect(comments).toMatchObject([
				{
					tag: { name: 'before', targetSearchQuery: undefined },
					contents: [`This is before any ignores`],
				},
				// TODO: Expect the ignore-tags annotation comment to be present as well
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [`This should be parsed again`],
				},
			] as PartialAnnotationComment[])
		})
		test('Ignores work in multi-line comments', () => {
			const lines = [
				`/*`,
				`  [!before] This is before any ignores`,
				`  [!ignore-tags]`,
				`  [!note] This should not be parsed`,
				`  [!note] This should be parsed again`,
				`*/`,
				`console.log('Some code')`,
				`testCode() // [!ins]`,
			]
			const comments = getComments(lines.join('\n'))
			expect(comments).toHaveLength(3)
			expect(comments).toMatchObject([
				{
					tag: { name: 'before', targetSearchQuery: undefined },
					contents: [`This is before any ignores`],
					commentRange: { start: { line: 0 }, end: { line: 5 } },
					annotationRange: { start: { line: 1 }, end: { line: 1 } },
				},
				// TODO: Expect the ignore-tags annotation comment to be present as well
				{
					tag: { name: 'note', targetSearchQuery: undefined },
					contents: [`This should be parsed again`],
					commentRange: { start: { line: 0 }, end: { line: 5 } },
					annotationRange: { start: { line: 4 }, end: { line: 4 } },
				},
				{
					tag: { name: 'ins', targetSearchQuery: undefined },
					contents: [],
				},
			] as PartialAnnotationComment[])
		})
	})

	function getComments(code: string) {
		const codeLines = splitCodeLines(code)
		return parseAnnotationComments({ codeLines })
	}
})
