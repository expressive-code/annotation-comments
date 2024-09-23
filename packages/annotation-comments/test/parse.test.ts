import { describe, expect, test } from 'vitest'
import { parseAnnotationComments } from '../src/core/parse'
import { createSingleLineRanges, createSingleLineRange } from '../src/internal/ranges'
import { createGlobalRegExp } from '../src/internal/regexps'
import type { ExpectedAnnotationComment } from './utils'
import { splitCodeLines, validateAnnotationComment } from './utils'

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
			validateParsedComments(jsTestCode, [
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
					targetRangeRegExp: /function (test)/,
				},
				{
					tag: { name: 'ins' },
					contents: [],
					targetRangeRegExp: /var v = 300.*/,
				},
				{
					tag: { name: 'note', targetSearchQuery: "'some.example'" },
					contents: [`This setting does not actually exist.`],
					targetRangeRegExp: /('some.example'):/,
				},
				{
					tag: { name: 'ins' },
					contents: [],
					targetRangeRegExp: /.*smartypants: false.*/,
				},
				{
					tag: { name: 'ins' },
					contents: [],
					targetRangeRegExp: /.*gfm: false.*/,
				},
			])
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
			validateParsedComments(cssTestCode, [
				{
					tag: { name: 'ins' },
					contents: [],
					targetRangeRegExp: /.*--min-spacing-inline.*/,
				},
				{
					tag: { name: 'del' },
					contents: [],
					targetRangeRegExp: /.*color: blue.*/,
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
					targetRangeRegExp: /: (linear-gradient)/,
				},
			])
		})

		test('Astro', () => {
			const astroTestCode = `
---
import Header from './Header.astro';
import Logo from './Logo.astro';
import Footer from './Footer.astro';

// [!note:/\\{ ?(title) ?\\}/:2] By destructuring the \`Astro.props\` object,
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
			validateParsedComments(astroTestCode, [
				{
					tag: { name: 'note', targetSearchQuery: createGlobalRegExp(/\{ ?(title) ?\}/), relativeTargetRange: 2 },
					contents: [
						// Content lines
						`By destructuring the \`Astro.props\` object,`,
						`we can access the \`title\` prop passed to this component.`,
					],
					commentRange: { start: { line: 5 }, end: { line: 6 } },
					annotationRange: { start: { line: 5 }, end: { line: 6 } },
					// Expect only the capture group inside the full match to be highlighted
					targetRangeRegExp: /(?<!:)\{ ?(title) ?\}/,
				},
				{
					tag: { name: 'note', targetSearchQuery: '{title}' },
					contents: [
						// Content lines
						`By wrapping any variable name in curly braces,`,
						`we can output its value in the HTML template,`,
						`as explained by this [!note] annotation.`,
					],
					// In contrast to the previous note, this one also targets the brackets
					targetRangeRegExp: /(?<=<h1>)\{title\}/,
				},
				{
					tag: { name: 'note' },
					contents: [`Children passed to the component will be inserted here`],
					targetRangeRegExp: /.*<slot \/>.*/,
				},
			])
		})

		test('Python', () => {
			const pythonTestCode = `
import time

# [!note:countdown:2] Prints a countdown from the given time,
# as explained by this # [!note] annotation.
def countdown(time_sec):
  while time_sec:
    mins, secs = divmod(time_sec, 60)
    timeformat = '{:02d}:{:02d}'.format(mins, secs)
    print(timeformat, end='\\r')
    time.sleep(1)
    time_sec -= 1
	# [!note:-1] This is important to actually count down
  print("stop")

countdown(5)
countdown(9) // This one is out of the target range
			`.trim()
			validateParsedComments(pythonTestCode, [
				{
					tag: { name: 'note', targetSearchQuery: 'countdown', relativeTargetRange: 2 },
					contents: [
						// Content lines
						`Prints a countdown from the given time,`,
						`as explained by this # [!note] annotation.`,
					],
					targetRangeRegExp: /(countdown)\((?:time_sec|5)/,
				},
				{
					tag: { name: 'note', relativeTargetRange: -1 },
					contents: [`This is important to actually count down`],
					targetRangeRegExp: /.*time_sec -= 1.*/,
				},
			])
		})
	})

	test('Supports chaining multiple matching single-line annotations on the same line', () => {
		const lines = [
			`// [!note] This is the note content. // [!ins]`,
			`console.log('Inserted line with an attached note')`,
			`testCode() // [!mark] // [!note] It also works at the end of a line.`,
		]
		validateParsedComments(lines, [
			{
				tag: { name: 'note' },
				annotationRange: { start: { line: 0 }, end: { line: 0, column: lines[0].indexOf(' // [!ins]') } },
				contents: [`This is the note content.`],
				targetRanges: [createSingleLineRange(1)],
			},
			{
				tag: { name: 'ins' },
				annotationRange: { start: { line: 0, column: lines[0].indexOf(' // [!ins]') }, end: { line: 0 } },
				contents: [],
				targetRanges: [createSingleLineRange(1)],
			},
			{
				tag: { name: 'mark' },
				annotationRange: {
					start: { line: 2, column: lines[2].indexOf(' // [!mark]') },
					end: { line: 2, column: lines[2].indexOf(' // [!note]') },
				},
				contents: [],
				targetRanges: [createSingleLineRange(2)],
			},
			{
				tag: { name: 'note' },
				annotationRange: { start: { line: 2, column: lines[2].indexOf(' // [!note]') }, end: { line: 2 } },
				contents: [`It also works at the end of a line.`],
				targetRanges: [createSingleLineRange(2)],
			},
		])
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
			validateParsedComments(lines, [
				{
					tag: { name: 'before' },
					contents: [`This is before any ignores`],
				},
				{ tag: { name: 'ignore-tags' } },
				{
					tag: { name: 'after' },
					contents: [`This should be parsed again`],
				},
			])
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
			validateParsedComments(lines, [
				{
					tag: { name: 'before' },
					contents: [`This is before any ignores`],
				},
				{ tag: { name: 'ignore-tags', relativeTargetRange: 2 } },
				{
					tag: { name: 'after' },
					contents: [`This should be parsed again`],
				},
			])
		})
		test('[!ignore-tags:note] ignores the next occurrence of "note"', () => {
			const lines = [
				`// [!before] This is before any ignores`,
				`// [!ignore-tags:note]`,
				`console.log('Some code')`,
				`testCode() // [!note] This should not be parsed`,
				`// [!note] This should be parsed again`,
			]
			validateParsedComments(lines, [
				{
					tag: { name: 'before' },
					contents: [`This is before any ignores`],
				},
				{ tag: { name: 'ignore-tags', targetSearchQuery: 'note' } },
				{
					tag: { name: 'note' },
					contents: [`This should be parsed again`],
				},
			])
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
			validateParsedComments(lines, [
				{
					tag: { name: 'before' },
					contents: [`This is before any ignores`],
				},
				{ tag: { name: 'ignore-tags', targetSearchQuery: 'note,ins', relativeTargetRange: 3 } },
				{
					tag: { name: 'ins' },
					contents: [],
				},
				{
					tag: { name: 'note' },
					contents: [`This should be parsed again`],
				},
			])
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
			validateParsedComments(lines, [
				{
					tag: { name: 'before' },
					contents: [`This is before any ignores`],
					commentRange: { start: { line: 0 }, end: { line: 5 } },
					annotationRange: { start: { line: 1 }, end: { line: 1 } },
				},
				{ tag: { name: 'ignore-tags' } },
				{
					tag: { name: 'note' },
					contents: [`This should be parsed again`],
					commentRange: { start: { line: 0 }, end: { line: 5 } },
					annotationRange: { start: { line: 4 }, end: { line: 4 } },
				},
				{
					tag: { name: 'ins' },
					contents: [],
				},
			])
		})
	})

	describe('Properly determines annotation targets', () => {
		describe('Plain tag without any target information', () => {
			test('[!tag] at the end of a non-empty line targets the current line', () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					``,
					`target1 // [!mark]`,
					``,
					// Empty line above
					``,
					`target2 // [!mark]`,
					`fail`,
					// Empty line below
					`fail`,
					`target3 // [!mark]`,
					``,
					// No empty lines
					`fail`,
					`target4 // [!mark]`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target1.*/ },
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target2.*/ },
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target3.*/ },
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target4.*/ },
				])
			})
			test(`[!tag] on its own line targets the first line below if it's non-empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					`// [!mark]`,
					`target1`,
					`fail`,
					``,
					// Single-line syntax with content
					`fail`,
					`// [!note] This adds a note to the line below.`,
					`target2`,
					`fail`,
					``,
					// Multi-line syntax with content
					`fail`,
					`/* [!note] You can also use the language's multi-line comment syntax.`,
					`           All text will be contained in the annotation. */`,
					`target3`,
					`fail`,
					``,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					`/*`,
					`  [!note]`,
					`  Whitespace inside the comments does not matter,`,
					`  allowing you to use any formatting you like.`,
					`*/`,
					`target4`,
					`fail`,
					``,
					// Single-line syntax with continuation lines
					`fail`,
					`// [!note] Comments can also span multiple lines even when using`,
					`// the language's single-line comment syntax, as long as all`,
					`// continuation lines are also comments.`,
					`target5`,
					`fail`,
					``,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target1.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target2.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target3.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target4.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target5.*/ },
				])
			})
			test(`[!tag] on its own line targets the first line above if only below is empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					`target1`,
					`// [!mark]`,
					``,
					// Single-line syntax with content
					`fail`,
					`target2`,
					`// [!note] This adds a note to the line above.`,
					``,
					// Multi-line syntax with content
					`fail`,
					`target3`,
					`/* [!note] You can also use the language's multi-line comment syntax.`,
					`           All text will be contained in the annotation. */`,
					``,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					`target4`,
					`/*`,
					`  [!note]`,
					`  Whitespace inside the comments does not matter,`,
					`  allowing you to use any formatting you like.`,
					`*/`,
					``,
					// Single-line syntax with continuation lines
					`fail`,
					`target5`,
					`// [!note] Comments can also span multiple lines even when using`,
					`// the language's single-line comment syntax, as long as all`,
					`// continuation lines are also comments.`,
					``,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark' }, targetRangeRegExp: /.*target1.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target2.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target3.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target4.*/ },
					{ tag: { name: 'note' }, targetRangeRegExp: /.*target5.*/ },
				])
			})
			test(`[!tag] on its own line targets nothing if lines below and above are empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					``,
					`// [!mark]`,
					``,
					// Single-line syntax with content
					`fail`,
					``,
					`// [!note] This is a standalone note.`,
					``,
					// Multi-line syntax with content
					`fail`,
					``,
					`/* [!note] You can also use the language's multi-line comment syntax.`,
					`           All text will be contained in the annotation. */`,
					``,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					``,
					`/*`,
					`  [!note]`,
					`  Whitespace inside the comments does not matter,`,
					`  allowing you to use any formatting you like.`,
					`*/`,
					``,
					// Single-line syntax with continuation lines
					`fail`,
					``,
					`// [!note] Comments can also span multiple lines even when using`,
					`// the language's single-line comment syntax, as long as all`,
					`// continuation lines are also comments.`,
					``,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark' }, targetRanges: [] },
					{ tag: { name: 'note' }, targetRanges: [] },
					{ tag: { name: 'note' }, targetRanges: [] },
					{ tag: { name: 'note' }, targetRanges: [] },
					{ tag: { name: 'note' }, targetRanges: [] },
				])
			})
		})
		describe('Tag with a relative target range', () => {
			test('[!tag:3] at the end of a non-empty line targets 3 lines downwards including the current one', () => {
				const codeLines = [
					// No empty lines
					`fail`,
					`function a() { // [!mark:3]`,
					`  return 'This also works';`,
					`}`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{
						tag: { name: 'mark', relativeTargetRange: 3 },
						targetRanges: createSingleLineRanges(1, 2, 3),
					},
				])
			})
			test('[!tag:-3] at the end of a non-empty line targets 3 lines upwards including the current one', () => {
				const codeLines = [
					// No empty lines
					`fail`,
					`function a() {`,
					`  return 'This also works';`,
					`} // [!mark:-3]`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{
						tag: { name: 'mark', relativeTargetRange: -3 },
						targetRanges: createSingleLineRanges(1, 2, 3),
					},
				])
			})
			test('[!tag:3] on its own line targets the following 3 lines', () => {
				const codeLines = [
					// No empty lines
					`fail`,
					`// [!mark:3]`,
					`console.log('This line will be marked.')`,
					`console.log('This one, too.')`,
					`console.log('And this one.')`,
					`fail`,
					// Given ranges can also target empty lines
					`fail`,
					`// [!mark:3]`,
					``,
					`console.log('This one, too.')`,
					``,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{
						tag: { name: 'mark', relativeTargetRange: 3 },
						targetRanges: createSingleLineRanges(2, 3, 4),
					},
					{
						tag: { name: 'mark', relativeTargetRange: 3 },
						targetRanges: createSingleLineRanges(8, 9, 10),
					},
				])
			})
			test('[!tag:-3] on its own line targets the previous 3 lines', () => {
				const codeLines = [
					// No empty lines
					`fail`,
					`console.log('This line will be marked.')`,
					`console.log('This one, too.')`,
					`console.log('And this one.')`,
					`// [!mark:-3]`,
					`fail`,
					// Given ranges can also target empty lines
					`fail`,
					``,
					`console.log('This one, too.')`,
					``,
					`// [!mark:-3]`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{
						tag: { name: 'mark', relativeTargetRange: -3 },
						targetRanges: createSingleLineRanges(1, 2, 3),
					},
					{
						tag: { name: 'mark', relativeTargetRange: -3 },
						targetRanges: createSingleLineRanges(7, 8, 9),
					},
				])
			})
		})
		describe('Tag with a target search query', () => {
			test('[!tag:search term] at the end of a non-empty line starts searching at the current line', () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					``,
					`target1 // [!mark:/(target.|fail)/]`,
					``,
					// Empty line above
					``,
					`target2 // [!mark:/(target.|fail)/]`,
					`fail`,
					// Empty line below
					`fail`,
					`target3 // [!mark:/(target.|fail)/]`,
					``,
					// No empty lines
					`fail`,
					`target4 // [!mark:/(target.|fail)/]`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target4/ },
				])
			})
			test('[!tag:search term] at the end of a non-empty line always searches downwards', () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					`fail`,
					``,
					`no match here // [!mark:/(target.|fail)/]`,
					``,
					`target1`,
					`fail`,
					// Empty line above
					``,
					`no match here // [!mark:/(target.|fail)/]`,
					`target2`,
					`fail`,
					// Empty line below
					`fail`,
					`no match here // [!mark:/(target.|fail)/]`,
					``,
					`target3`,
					// No empty lines
					`fail`,
					`no match here // [!mark:/(target.|fail)/]`,
					`target4`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target4/ },
				])
			})
			test(`[!tag:search term] on its own line searches downwards if the first line below is non-empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					`// [!mark:/(target.|fail)/]`,
					`target1`,
					`fail`,
					``,
					// Single-line syntax with content
					`fail`,
					`// [!note:/(target.|fail)/] This adds a note to the line below.`,
					`target2`,
					`fail`,
					``,
					// Multi-line syntax with content
					`fail`,
					`/* [!note:/(target.|fail)/] The language's multi-line comment syntax`,
					`   can also be used without any problems. */`,
					`target3`,
					`fail`,
					``,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					`/*`,
					`  [!note:/(target.|fail)/]`,
					`    Whitespace inside the comments does not matter,`,
					`    allowing you to use any formatting you like.`,
					`*/`,
					`target4`,
					`fail`,
					``,
					// Single-line syntax with continuation lines
					`fail`,
					`// [!note:/(target.|fail)/] Comments can also span multiple lines`,
					`// even when using the language's single-line comment syntax,`,
					`// as long as all continuation lines are also comments.`,
					`target5`,
					`fail`,
					``,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target4/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target5/ },
				])
			})
			test(`[!tag:search term] on its own line searches upwards if only below is empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					`target1`,
					`// [!mark:/(target.|fail)/]`,
					``,
					// Single-line syntax with content
					`fail`,
					`target2`,
					`something else that does not match`,
					`// [!note:/(target.|fail)/] This adds a note to a matching target above.`,
					``,
					// Multi-line syntax with content
					`fail`,
					`target3`,
					`something else that does not match`,
					`/* [!note:/(target.|fail)/] You can also use multi-line comment syntax.`,
					`           All text will be contained in the annotation. */`,
					``,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					`target4`,
					`/*`,
					`  [!note:/(target.|fail)/]`,
					`  Whitespace inside the comments does not matter,`,
					`  allowing you to use any formatting you like.`,
					`*/`,
					``,
					// Single-line syntax with continuation lines, and at the end of the file
					`fail`,
					`target5`,
					`// [!note:/(target.|fail)/] Comments can also span multiple lines`,
					`// even when using the language's single-line comment syntax,`,
					`// as long as all continuation lines are also comments.`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target4/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target5/ },
				])
			})
			test(`[!tag:search term] on its own line searches downwards if below and above are empty`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// No content
					`fail`,
					``,
					`// [!mark:/(target.|fail)/]`,
					``,
					`target1`,
					// Single-line syntax with content
					`fail`,
					``,
					`// [!note:/(target.|fail)/] This is a standalone note.`,
					``,
					`target2`,
					// Multi-line syntax with content
					`fail`,
					``,
					`/* [!note:/(target.|fail)/] You can also use multi-line comment syntax.`,
					`           All text will be contained in the annotation. */`,
					``,
					`target3`,
					// Multi-line syntax with lots of extra whitespace
					`fail`,
					``,
					`/*`,
					`  [!note:/(target.|fail)/]`,
					`  Whitespace inside the comments does not matter,`,
					`  allowing you to use any formatting you like.`,
					`*/`,
					``,
					`target4`,
					// Single-line syntax with continuation lines
					`fail`,
					``,
					`// [!note:/(target.|fail)/] Comments can also span multiple lines`,
					`// even when using the language's single-line comment syntax,`,
					`// as long as all continuation lines are also comments.`,
					``,
					`target5`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target4/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/ }, targetRangeRegExp: /.*target5/ },
				])
			})
		})
		describe('Tag with a target search query and relative target range', () => {
			test(`[!tag:search term:3] on its own line searches 3 matches downwards`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// Surrounded by non-empty lines
					`fail`,
					`// [!mark:/(target.|fail)/:3]`,
					`target1`,
					`no match`,
					`target1`,
					`target1`,
					`fail`,
					``,
					// Empty line above
					`fail`,
					``,
					`// [!note:/(target.|fail)/:3] This adds a note to the line below.`,
					`no match`,
					`target2`,
					`no match`,
					`target2`,
					`target2`,
					`fail`,
					``,
					// Empty line below
					`fail`,
					`/* [!note:/(target.|fail)/:3] The language's multi-line comment syntax`,
					`   can also be used without any problems. */`,
					``,
					`target3`,
					`no match`,
					`target3`,
					`target3`,
					`fail`,
					// Surrounded by empty lines
					`fail`,
					``,
					`/*`,
					`  [!note:/(target.|fail)/:3]`,
					`    Whitespace inside the comments does not matter,`,
					`    allowing you to use any formatting you like.`,
					`*/`,
					``,
					`target4`,
					`target4`,
					`no match`,
					`target4`,
					`fail`,
					``,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /.*target4/ },
				])
			})
			test(`[!tag:search term:-3] on its own line searches 3 matches upwards`, () => {
				const codeLines = [
					`Start of test code`,
					``,
					// Surrounded by non-empty lines
					`fail`,
					`target1`,
					`no match`,
					`target1`,
					`target1`,
					`// [!mark:/(target.|fail)/:-3]`,
					`fail`,
					``,
					// Empty line above
					`fail`,
					`no match`,
					`target2`,
					`no match`,
					`target2`,
					`target2`,
					``,
					`// [!note:/(target.|fail)/:-3] This adds a note to the line below.`,
					`fail`,
					``,
					// Empty line below
					`fail`,
					`target3`,
					`no match`,
					`target3`,
					`target3`,
					`/* [!note:/(target.|fail)/:-3] The language's multi-line comment syntax`,
					`   can also be used without any problems. */`,
					``,
					`fail`,
					// Surrounded by empty lines
					`fail`,
					`target4`,
					`target4`,
					`no match`,
					`target4`,
					``,
					`/*`,
					`  [!note:/(target.|fail)/:-3]`,
					`    Whitespace inside the comments does not matter,`,
					`    allowing you to use any formatting you like.`,
					`*/`,
					``,
					`fail`,
					``,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /.*target1/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /.*target2/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /.*target3/ },
					{ tag: { name: 'note', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /.*target4/ },
				])
			})
			test(`[!tag:search term:3] at the end of a non-empty line searches forwards from the start of the current line`, () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					`fail`,
					``,
					`target1 nothing target1 // [!mark:/(target.|fail)/:3]`,
					``,
					`target1`,
					``,
					`fail`,
					// Empty line above
					``,
					`target2 nothing target2 // [!mark:/(target.|fail)/:3]`,
					`target2`,
					`fail`,
					// Empty line below
					`fail`,
					`target3 nothing target3 // [!mark:/(target.|fail)/:3]`,
					``,
					`target3`,
					// No empty lines
					`fail`,
					`target4 nothing target4 // [!mark:/(target.|fail)/:3]`,
					`target4`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target4/ },
				])
			})
			test(`[!tag:search term:3] at the beginning of a non-empty line searches forwards from the start of the current line`, () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					`fail`,
					``,
					`/* [!mark:/(target.|fail)/:3] */ target1 nothing target1`,
					`target1`,
					``,
					`fail`,
					// Empty line above
					``,
					`/* [!mark:/(target.|fail)/:3] */ target2 nothing target2`,
					`target2`,
					`fail`,
					// Empty line below
					`fail`,
					`/* [!mark:/(target.|fail)/:3] */ target3 nothing target3`,
					``,
					`target3`,
					// No empty lines
					`fail`,
					`/* [!mark:/(target.|fail)/:3] */ target4 nothing target4`,
					`target4`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: 3 }, targetRangeRegExp: /target4/ },
				])
			})
			test(`[!tag:search term:-3] at the end of a non-empty line searches backwards from the end of the current line`, () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					`fail`,
					``,
					`fail target1 nothing target1`,
					``,
					`target1 // [!mark:/(target.|fail)/:-3]`,
					``,
					`fail`,
					// Empty line above
					`fail target2`,
					``,
					`target2 nothing target2 // [!mark:/(target.|fail)/:-3]`,
					`fail`,
					// Empty line below
					`fail`,
					`fail target3`,
					`target3 nothing target3 // [!mark:/(target.|fail)/:-3]`,
					``,
					// No empty lines
					`fail`,
					`fail target4`,
					`target4 nothing target4 // [!mark:/(target.|fail)/:-3]`,
					`fail`,
					// Check that the search goes backwards from the end of the comment line
					// (the requested 3 matches should already be exhausted by the "target5" terms
					// before reaching the "fail" term in the beginning of the line)
					`fail`,
					`fail target5 nothing here target5 nothing target5 // [!mark:/(target.|fail)/:-3]`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target4/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target5/ },
				])
			})
			test(`[!tag:search term:-3] at the beginning of a non-empty line searches backwards from the end of the current line`, () => {
				const codeLines = [
					`Start of test code`,
					// Empty lines above and below
					`fail`,
					``,
					`fail target1 nothing target1`,
					``,
					`/* [!mark:/(target.|fail)/:-3] */ target1`,
					``,
					`fail`,
					// Empty line above
					`fail target2`,
					``,
					`/* [!mark:/(target.|fail)/:-3] */ target2 nothing target2`,
					`fail`,
					// Empty line below
					`fail`,
					`fail target3`,
					`/* [!mark:/(target.|fail)/:-3] */ target3 nothing target3`,
					``,
					// No empty lines
					`fail`,
					`fail target4`,
					`/* [!mark:/(target.|fail)/:-3] */ target4 nothing target4`,
					`fail`,
					// Check that the search goes backwards from the end of the comment line
					// (the requested 3 matches should already be exhausted by the "target5" terms
					// before reaching the "fail" term in the beginning of the line)
					`fail`,
					`/* [!mark:/(target.|fail)/:-3] */ fail target5 nothing here target5 nothing target5`,
					`fail`,
				]
				validateParsedComments(codeLines, [
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target1/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target2/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target3/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target4/ },
					{ tag: { name: 'mark', targetSearchQuery: /(target.|fail)/, relativeTargetRange: -3 }, targetRangeRegExp: /target5/ },
				])
			})
		})
	})

	function validateParsedComments(code: string | string[], expectedComments: ExpectedAnnotationComment[]) {
		const codeLines = Array.isArray(code) ? code : splitCodeLines(code)
		const actualComments = parseAnnotationComments({ codeLines })
		expectedComments.forEach((expectedComment, index) => {
			validateAnnotationComment(actualComments[index], codeLines, expectedComment)
		})
		expect(actualComments).toHaveLength(expectedComments.length)
	}
})
