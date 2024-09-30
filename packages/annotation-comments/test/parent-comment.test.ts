import { describe, expect, test } from 'vitest'
import type { AnnotationComment, SourceRange } from '../src/core/types'
import { parseAnnotationTags } from '../src/parsers/annotation-tags'
import { parseParentComment } from '../src/parsers/parent-comment'
import { splitCodeLines, validateAnnotationComment } from './utils'

describe('parseParentComment()', () => {
	describe('Returns undefined when no valid parent comment is found', () => {
		describe('Single-line comment syntax', () => {
			test('No comment syntax in the same line', () => {
				expect(getParentComment([`console.log('This is [!ins] in a string'])`])).toEqual(undefined)
			})
			test('Comment syntax located after the annotation tag', () => {
				expect(getParentComment([`console.log('More [!test] text') // Hi!]`])).toEqual(undefined)
			})
			test('Missing whitespace before comment opening syntax', () => {
				expect(getParentComment([`someCode()// [!note] Invalid syntax`])).toEqual(undefined)
			})
			test('Missing whitespace before annotation tag', () => {
				expect(getParentComment([`someCode() //[!note] Invalid syntax`])).toEqual(undefined)
			})
			test('Content between comment opening and annotation tag', () => {
				expect(getParentComment([`someCode() // Hi [!note] This will not work`])).toEqual(undefined)
			})
		})
		describe('Multi-line comment syntax', () => {
			test('Content between the opening syntax and the annotation tag', () => {
				expect(getParentComment([`/* Hi [!note] This will not work */`])).toEqual(undefined)
				expect(getParentComment([`someCode() /* Hi [!note] This will not work */`])).toEqual(undefined)
			})
			test('Content between the beginning of the line and the annotation tag', () => {
				expect(
					getParentComment([
						'someCode()',
						'/*',
						// Content before the annotation tag
						'Hi [!note] This will not work',
						'*/',
					])
				).toEqual(undefined)
			})
		})
	})

	describe('Supports single-line comments', () => {
		describe('At the beginning of the line', () => {
			const syntaxes = [
				// Starting at column 0, followed by a space
				'// ',
				'# ',
				'-- ',
				// Starting at column 0, followed by a tab
				'//<tab>',
				'#<tab>',
				'--<tab>',
				// Starting at column 2, indented by spaces
				'  // ',
				'  # ',
				'  -- ',
				// Starting at column 1, indented by a tab
				'<tab>// ',
				'<tab># ',
				'<tab>-- ',
			]
			describe('Without content', () => {
				test.each(syntaxes)('"%s[!ins]"', (syntax) => {
					const commentLine = `${cs(syntax)}[!ins]`
					validateParentComment({
						lines: [commentLine],
						contents: [],
						commentRange: { start: { line: 2 }, end: { line: 2 } },
					})
				})
			})
			describe('With content', () => {
				test.each(syntaxes)('"%s[!note] Annotation content"', (syntax) => {
					const commentLine = `${cs(syntax)}[!note] Annotation content`
					validateParentComment({
						lines: [commentLine],
						contents: ['Annotation content'],
						commentRange: { start: { line: 2 }, end: { line: 2 } },
					})
				})
			})
		})
		describe('After code', () => {
			const cases = [
				// Separated from the code by a space
				' // ',
				' # ',
				' -- ',
				// Separated from the code by 2 spaces
				'  // ',
				'  # ',
				'  -- ',
				// Separated from the code by a tab
				'<tab>// ',
				'<tab># ',
				'<tab>-- ',
			]
			describe('Without content', () => {
				test.each(cases)(`"someCode()%s[!del]"`, (syntax) => {
					syntax = cs(syntax)
					const commentLine = `someCode()${syntax}[!del]`
					validateParentComment({
						lines: [commentLine],
						contents: [],
						commentRange: { start: { line: 2, column: commentLine.indexOf(syntax) }, end: { line: 2 } },
					})
				})
			})
			describe('With content', () => {
				test.each(cases)(`"someCode()%s[!note] Let's run it!"`, (syntax) => {
					syntax = cs(syntax)
					const commentLine = `someCode()${syntax}[!note] Let's run it!`
					validateParentComment({
						lines: [commentLine],
						contents: [`Let's run it!`],
						commentRange: { start: { line: 2, column: commentLine.indexOf(syntax) }, end: { line: 2 } },
					})
				})
			})
		})
		describe('After a regular comment on the same line', () => {
			test('"someCode() // Regular comment // [!note] Annotation content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				validateParentComment({
					lines: [commentLine],
					contents: ['Annotation content'],
					// Expect the whitespace before the annotation comment to be included in the comment range
					commentRange: { start: { line: 2, column: commentLine.indexOf(' // [!') }, end: { line: 2 } },
				})
			})
		})
		describe('Before another chained annotation comment on the same line', () => {
			test('"someCode() // [!note] Annotation 1 content // [!test] Annotation 2 content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				// Whitespace before an annotation comment always belongs to the new annotation
				const startOfComment1 = commentLine.indexOf(' // [!note')
				const endOfComment1 = commentLine.indexOf(' // [!test')
				validateParentComment({
					lines: [commentLine],
					contents: ['Annotation 1 content'],
					commentRange: { start: { line: 2, column: startOfComment1 }, end: { line: 2, column: endOfComment1 } },
				})
			})
			test('"someCode() // [!ins] // [!test] The first annotation had no content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				// Whitespace before an annotation comment always belongs to the new annotation
				const startOfComment1 = commentLine.indexOf(' // [!ins')
				const endOfComment1 = commentLine.indexOf(' // [!test')
				validateParentComment({
					lines: [commentLine],
					contents: [],
					commentRange: { start: { line: 2, column: startOfComment1 }, end: { line: 2, column: endOfComment1 } },
				})
			})
		})
		describe(`With content that looks almost like chaining, but isn't`, () => {
			test('"someCode() // [!note] These two slashes // are not followed by a tag"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				validateParentComment({
					lines: [commentLine],
					contents: ['These two slashes // are not followed by a tag'],
					commentRange: { start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } },
				})
			})
			test('"someCode() // [!note] Contents can include `// [!this]` due to the whitespace rule"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				validateParentComment({
					lines: [commentLine],
					contents: ['Contents can include `// [!this]` due to the whitespace rule'],
					commentRange: { start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } },
				})
			})
			test('"someCode() // [!note] Mismatching comment # [!syntax] also prevents chaining"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				validateParentComment({
					lines: [commentLine],
					contents: ['Mismatching comment # [!syntax] also prevents chaining'],
					commentRange: { start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } },
				})
			})
		})
		describe(`Allows multi-line content by repeating the same opening syntax`, () => {
			test('Single annotation comment with multi-line content', () => {
				const lines = [
					// Starts like a regular single-line annotation comment...
					'// [!note] Annotation content',
					// ...but continues on the next lines by repeating the comment opening syntax
					'// that spans multiple lines',
					// ...and can contain empty lines
					'//',
					'// until the comment ends',
					// ...and ends when the comment syntax is not repeated
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', '', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 5 } },
				})
			})
			test('Multi-line content ends when encountering a different comment syntax', () => {
				const lines = [
					// Starts like a regular single-line annotation comment...
					'// [!note] Annotation content',
					// ...but continues on the next line by repeating the comment opening syntax
					'// that spans multiple lines',
					// ...and ends when encountering a different comment syntax
					'# This is a regular comment and not part of the annotation',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines'],
					commentRange: { start: { line: 2 }, end: { line: 3 } },
				})
			})
			test('Multi-line content ends when encountering another annotation comment', () => {
				const lines = [
					// Starts like a regular single-line annotation comment...
					'// [!note] Annotation 1 content',
					// ...but continues on the next line by repeating the comment opening syntax
					'// that spans multiple lines',
					// ...and ends when encountering another annotation comment
					'// [!test] Annotation 2 content',
				]
				validateParentComment({
					lines,
					contents: ['Annotation 1 content', 'that spans multiple lines'],
					commentRange: { start: { line: 2 }, end: { line: 3 } },
				})
			})
			test('Multi-line content ends when encountering "---" on its own line', () => {
				const lines = [
					// Starts like a regular single-line annotation comment...
					'// [!note] Annotation content',
					// ...but continues on the next line by repeating the comment opening syntax
					'// that spans multiple lines',
					// ...and ends when encountering "---" on its own line
					'// ---',
					'// This is a regular comment and not part of the annotation',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines'],
					// Expect the "---" line to be included in the comment range
					// so it will be removed when the comment is removed
					commentRange: { start: { line: 2 }, end: { line: 4 } },
				})
			})
			test('Comments starting after code on the same line cannot be multi-line', () => {
				const lines = [
					// A regular single-line comment that starts after some code
					'someCode() // [!note] Annotation content',
					// ...cannot be continued on the next line
					'// This is a regular comment and not part of the annotation',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content'],
					commentRange: { start: { line: 2, column: lines[0].indexOf(' // [!') }, end: { line: 2 } },
				})
			})
		})
	})

	describe('Supports multi-line comments', () => {
		describe('Starting and ending at the same line', () => {
			describe('Without any code on the line', () => {
				const syntaxes = [
					// Starting at column 0, separated from inner content by spaces
					['/* ', ' */'],
					['<!-- ', ' -->'],
					['{ /* ', ' */ }'],
					// Starting at column 0, separated from inner content by a tab
					['/*<tab>', '<tab>*/'],
					['<!--<tab>', '<tab>-->'],
					['{ /*<tab>', '<tab>*/ }'],
					// Starting at column 2, indented by spaces
					['  /* ', ' */'],
					['  (* ', ' *)'],
					['  --[[ ', ' ]]'],
					// Starting at column 1, indented by a tab
					['<tab>/* ', ' */'],
					['<tab>(* ', ' *)'],
					['<tab>--[[ ', ' ]]'],
				]
				describe('Without content', () => {
					test.each(syntaxes)('"%s[!ins]%s"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!ins]${cs(closing)}`
						validateParentComment({
							lines: [commentLine],
							contents: [],
							commentRange: { start: { line: 2 }, end: { line: 2 } },
						})
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"%s[!note] Annotation content%s"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!note] Annotation content${cs(closing)}`
						validateParentComment({
							lines: [commentLine],
							contents: ['Annotation content'],
							commentRange: { start: { line: 2 }, end: { line: 2 } },
						})
					})
				})
			})
			describe('Before code', () => {
				const syntaxes = [
					// Separated from the code by a space
					['/* ', ' */ '],
					['<!-- ', ' --> '],
					['{ /* ', ' */ } '],
					// Separated from the code by 2 spaces
					['/* ', ' */  '],
					['(* ', ' *)  '],
					['--[[ ', ' ]]  '],
					// Separated from the code by a tab
					['/* ', ' */<tab>'],
					['(* ', ' *)<tab>'],
					['--[[ ', ' ]]<tab>'],
				]
				describe('Without content', () => {
					test.each(syntaxes)('"%s[!ins]%ssomeCode()"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!ins]${cs(closing)}someCode()`
						validateParentComment({
							lines: [commentLine],
							contents: [],
							// Expect all mandatory whitespace between the comment and the code
							// to be included in the comment range
							commentRange: { start: { line: 2 }, end: { line: 2, column: commentLine.indexOf('someCode') } },
						})
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"%s[!note] Annotation content%ssomeCode()"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!note] Annotation content${cs(closing)}someCode()`
						validateParentComment({
							lines: [commentLine],
							contents: ['Annotation content'],
							// Expect all mandatory whitespace between the comment and the code
							// to be included in the comment range
							commentRange: { start: { line: 2 }, end: { line: 2, column: commentLine.indexOf('someCode') } },
						})
					})
				})
				test('Does not capture indentation before the comment', () => {
					const commentLine = `  /* [!ins] */ someCode()`
					validateParentComment({
						lines: [commentLine],
						contents: [],
						// Expect all mandatory whitespace between the comment and the code
						// to be included in the comment range, BUT NOT the indentation
						commentRange: { start: { line: 2, column: commentLine.indexOf('/*') }, end: { line: 2, column: commentLine.indexOf('someCode') } },
					})
				})
			})
			describe('After code', () => {
				const syntaxes = [
					// Separated from the code by a space
					[' /* ', ' */'],
					[' <!-- ', ' -->'],
					[' { /* ', ' */ }'],
					// Separated from the code by 2 spaces
					['  /* ', ' */'],
					['  (* ', ' *)'],
					['  --[[ ', ' ]]'],
					// Separated from the code by a tab
					['<tab>/* ', ' */'],
					['<tab>(* ', ' *)'],
					['<tab>--[[ ', ' ]]'],
				]
				describe('Without content', () => {
					test.each(syntaxes)('"someCode()%s[!ins]%s"', (opening, closing) => {
						const commentLine = `someCode()${cs(opening)}[!ins]${cs(closing)}`
						validateParentComment({
							lines: [commentLine],
							contents: [],
							// Expect all mandatory whitespace between the code and the comment
							// to be included in the comment range
							commentRange: { start: { line: 2, column: commentLine.indexOf(cs(opening)) }, end: { line: 2 } },
						})
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"someCode()%s[!note] Annotation content%s"', (opening, closing) => {
						const commentLine = `someCode()${cs(opening)}[!note] Annotation content${cs(closing)}`
						validateParentComment({
							lines: [commentLine],
							contents: ['Annotation content'],
							// Expect all mandatory whitespace between the code and the comment
							// to be included in the comment range
							commentRange: { start: { line: 2, column: commentLine.indexOf(cs(opening)) }, end: { line: 2 } },
						})
					})
				})
			})
		})
		describe('Starting and ending at different lines', () => {
			test('Without newlines around inner comment range', () => {
				const lines = [
					// Tag and content start on the opening line
					'/* [!note] Annotation content',
					'that spans multiple lines',
					// Content ends on the closing line
					'until the comment ends */',
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 4 } },
				})
			})
			test('With newlines, tag and content not indented', () => {
				const lines = [
					'/*',
					// No indentation
					'[!note] Annotation content',
					'that spans multiple lines',
					'until the comment ends',
					'*/',
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
				})
			})
			test('With newlines, tag and content indented by two spaces', () => {
				const lines = [
					'/*',
					// Indented tag and content
					'  [!note] Annotation content',
					'  that spans multiple lines',
					'  until the comment ends',
					'*/',
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
				})
			})
			test('With newlines, tag and content indented by a tab', () => {
				const lines = [
					'/*',
					// Indented tag and content
					'\t[!note] Annotation content',
					'\tthat spans multiple lines',
					'\tuntil the comment ends',
					'*/',
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
				})
			})
			test('Removes whitespace-only lines from the beginning and end of the content', () => {
				const lines = [
					'/*',
					// Some empty lines
					'',
					'  [!note] Annotation content',
					'  that spans multiple lines',
					'  until the comment ends',
					'',
					'',
					'*/',
					'someCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 9 } },
				})
			})
		})
		describe('Handles special syntax requirements', () => {
			test('Excludes JSDoc continuation line syntax "*" from annotation content', () => {
				const lines = [
					// JSDoc example with the entire block being indented by a tab
					'\t/**',
					// '\t * Some JSDoc that is not part of the annotation comment.',
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
				})
			})
		})
		describe('Handles mixed comments with other content besides the annotation', () => {
			test('Excludes the outer comment syntax and all non-annotation lines', () => {
				const lines = [
					// Opening syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t/**',
					// Non-annotation content
					'\t * Some JSDoc that is not part of the annotation comment.',
					'\t *',
					// Annotation content - these are the only lines that should be included
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					// Closing syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					// Expect the comment range to include all lines that are part of the comment...
					commentRange: { start: { line: 2 }, end: { line: 8 } },
					// ...but the annotation range should only include the annotation content
					annotationRange: { start: { line: 5 }, end: { line: 7 } },
				})
			})
			test('Excludes non-annotation content even without a line break before it', () => {
				const lines = [
					// Non-annotation content directly after the opening syntax
					'\t/** Some JSDoc that is not part of the annotation comment.',
					// Annotation content
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					// Closing syntax
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
					// Expect the opening, non-annotation content and closing syntax not to be included
					// in the annotation range
					annotationRange: { start: { line: 3 }, end: { line: 5 } },
				})
			})
			test('Excludes the opening syntax even without a line break before it (1)', () => {
				const lines = [
					// Multi-line annotation starting directly after the opening syntax
					'\t/** [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					// Another annotation makes this a mixed comment
					'\t * [!ins]',
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
					// Expect the opening, other annotation and closing syntax not to be included
					// in the annotation range
					annotationRange: { start: { line: 2, column: lines[0].indexOf(' [!') }, end: { line: 4 } },
				})
			})
			test('Excludes the opening syntax even without a line break before it (2)', () => {
				const lines = [
					// Single-line annotation starting directly after the opening syntax
					'\t/** [!ins]',
					// Another annotation that makes this a mixed comment
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: [],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
					// Expect the opening, non-annotation content and closing syntax not to be included
					// in the annotation range
					annotationRange: { start: { line: 2, column: lines[0].indexOf(' [!') }, end: { line: 2 } },
				})
			})
			test('Excludes the closing syntax even without a line break before it', () => {
				const lines = [
					'\t/**',
					// Non-annotation content
					'\t * Some JSDoc that is not part of the annotation comment.',
					// Annotation content
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until the comment ends'],
					commentRange: { start: { line: 2 }, end: { line: 6 } },
					// Expect the opening, non-annotation content and closing syntax not to be included
					// in the annotation range
					annotationRange: { start: { line: 4 }, end: { line: 6, column: lines[4].indexOf('*/') } },
				})
			})
			test('Ends the annotation when encountering another annotation tag', () => {
				const lines = [
					// Opening syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t/**',
					// Annotation content - these are the lines that should be included
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until a new tag is encountered',
					// Second annotation
					'\t * [!test] Yet another annotation',
					// Closing syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until a new tag is encountered'],
					commentRange: { start: { line: 2 }, end: { line: 7 } },
					// Expect the second annotation not to be included in the annotation range
					annotationRange: { start: { line: 3 }, end: { line: 5 } },
				})
			})
			test('Ends the annotation when encountering "---" on its own line', () => {
				const lines = [
					// Opening syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t/**',
					// Annotation content - these are the lines that should be included
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until "---" is encountered',
					// Separator that is also considered part of the annotation comment range
					'\t * ---',
					// Non-annotation content
					'\t * Some JSDoc that is not part of the annotation comment.',
					// Closing syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t */',
					'\tsomeCode()',
				]
				validateParentComment({
					lines,
					contents: ['Annotation content', 'that spans multiple lines', 'until "---" is encountered'],
					commentRange: { start: { line: 2 }, end: { line: 8 } },
					annotationRange: { start: { line: 3 }, end: { line: 6 } },
				})
			})
		})
		describe('Picks the best comment range if multiple options are present', () => {
			describe('In case of multiple syntax options, prefers the one starting closest to the tag', () => {
				test('Nested multi-line syntax on a single line', () => {
					const lines = [
						'{ /* ',
						'This is some content inside a JSX-like comment',
						// Nested multi-line annotation comment
						'<!-- [!note] Look, a note! -->',
						// Other content follows
						'More content inside the JSX-like comment',
						'*/ }',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: ['Look, a note!'],
						commentRange: { start: { line: 4 }, end: { line: 4 } },
					})
				})
				test('Nested multi-line syntax on multiple lines', () => {
					const lines = [
						'{ /* ',
						'This is some content inside a JSX-like comment',
						// Nested multi-line annotation comment
						'<!--',
						'[!note] Look, a note!',
						'-->',
						// Other content follows
						'More content inside the JSX-like comment',
						'*/ }',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: ['Look, a note!'],
						commentRange: { start: { line: 4 }, end: { line: 6 } },
					})
				})
			})
			describe('If opening/closing options overlap, prefers the longest one', () => {
				test('"<div> { /* [!ins] */ }"', () => {
					const lines = [
						// JSX annotation comment following an HTML tag
						'<div> { /* [!ins] */ }',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: [],
						// Expect the space between the code and the comment to be included
						commentRange: { start: { line: 2, column: lines[0].indexOf(' { /*') }, end: { line: 2 } },
					})
				})
				test('"{ /* [!ins] */ } <div>"', () => {
					const lines = [
						// JSX annotation comment following an HTML tag
						'  { /* [!ins] */ } <div>',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: [],
						// Expect the space between the comment and the code to be included,
						// but not the indentation before the code
						commentRange: { start: { line: 2, column: 2 }, end: { line: 2, column: lines[0].indexOf('<div') } },
					})
				})
				test('"{ /* [!note] Annotation content */ }" on its own line', () => {
					const lines = [
						// Single-line variant
						'{ /* [!note] Annotation content */ }',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: ['Annotation content'],
						commentRange: { start: { line: 2 }, end: { line: 2 } },
					})
				})
				test('Multi-line comment including "{ /*", content lines, and "*/ }"', () => {
					const lines = [
						// Multi-line variant
						'{ /*',
						'  [!note] Annotation content',
						'  that spans multiple lines',
						'*/ }',
						'someCode()',
					]
					validateParentComment({
						lines,
						contents: ['Annotation content', 'that spans multiple lines'],
						commentRange: { start: { line: 2 }, end: { line: 5 } },
					})
				})
			})
		})
	})

	/**
	 * Converts special characters inside a test display name string to their actual values.
	 */
	function cs(displaySyntax: string) {
		return displaySyntax.replaceAll('<tab>', '\t')
	}

	function getTestCode(commentLine: string) {
		return `
import { someCode } from 'somewhere'

${commentLine}
console.log('Done!')
		`
	}

	function getParentComment(codeLines: string[]) {
		const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })
		expect(annotationTags.length, 'No annotation tag was found in test code').toBeGreaterThanOrEqual(1)
		expect(errorMessages, 'Unexpected error parsing annotation tags').toEqual([])
		const tag = annotationTags[0]
		return parseParentComment({ codeLines, tag })
	}

	function validateParentComment(options: { lines: string[]; contents: string[]; commentRange: SourceRange; annotationRange?: SourceRange | undefined }) {
		const codeLines = splitCodeLines(getTestCode(options.lines.join('\n')))
		const comment = getParentComment(codeLines) as AnnotationComment

		validateAnnotationComment(comment, codeLines, options)
	}
})
