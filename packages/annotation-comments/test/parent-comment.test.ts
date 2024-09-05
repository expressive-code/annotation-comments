import { describe, expect, test } from 'vitest'
import type { AnnotationComment } from '../src/core/types'
import { parseAnnotationTags } from '../src/parsers/annotation-tags'
import { parseParentComment } from '../src/parsers/parent-comment'
import { splitCodeLines } from './utils'

describe('parseParentComment()', () => {
	describe('Returns undefined when no valid parent comment is found', () => {
		describe('Single-line comment syntax', () => {
			test('No comment syntax in the same line', () => {
				expect(getParentComment(`console.log('This is [!ins] in a string')`)).toEqual(undefined)
			})
			test('Comment syntax located after the annotation tag', () => {
				expect(getParentComment(`console.log('More [!test] text') // Hi!`)).toEqual(undefined)
			})
			test('Missing whitespace before comment opening syntax', () => {
				expect(getParentComment(`someCode()// [!note] Invalid syntax`)).toEqual(undefined)
			})
			test('Missing whitespace before annotation tag', () => {
				expect(getParentComment(`someCode() //[!note] Invalid syntax`)).toEqual(undefined)
			})
			test('Content between comment opening and annotation tag', () => {
				expect(getParentComment(`someCode() // Hi [!note] This won't work`)).toEqual(undefined)
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
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([])
					expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([])
				})
			})
			describe('With content', () => {
				test.each(syntaxes)('"%s[!note] Annotation content"', (syntax) => {
					const commentLine = `${cs(syntax)}[!note] Annotation content`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual(['Annotation content'])
					expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2 } }])
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
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([])
					expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(syntax) }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([])
				})
			})
			describe('With content', () => {
				test.each(cases)(`"someCode()%s[!note] Let's run it!"`, (syntax) => {
					syntax = cs(syntax)
					const commentLine = `someCode()${syntax}[!note] Let's run it!`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([`Let's run it!`])
					expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(syntax) }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf(`Let's`) }, end: { line: 2 } }])
				})
			})
		})
		describe('After a regular comment on the same line', () => {
			test('"someCode() // Regular comment // [!note] Annotation content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content'])
				// Expect the whitespace before the annotation comment to be included in the comment range
				expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(' // [!') }, end: { line: 2 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2 } }])
			})
		})
		describe('Before another chained annotation comment on the same line', () => {
			test('"someCode() // [!note] Annotation 1 content // [!test] Annotation 2 content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation 1 content'])
				// Whitespace before an annotation comment always belongs to the new annotation
				const startOfComment1 = commentLine.indexOf(' // [!note')
				const endOfComment1 = commentLine.indexOf(' // [!test')
				expect(comment.commentRange).toEqual({ start: { line: 2, column: startOfComment1 }, end: { line: 2, column: endOfComment1 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2, column: endOfComment1 } }])
			})
			test('"someCode() // [!ins] // [!test] The first annotation had no content"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual([])
				// Whitespace before an annotation comment always belongs to the new annotation
				const startOfComment1 = commentLine.indexOf(' // [!ins')
				const endOfComment1 = commentLine.indexOf(' // [!test')
				expect(comment.commentRange).toEqual({ start: { line: 2, column: startOfComment1 }, end: { line: 2, column: endOfComment1 } })
				expect(comment.contentRanges).toEqual([])
			})
		})
		describe(`With content that looks almost like chaining, but isn't`, () => {
			test('"someCode() // [!note] These two slashes // are not followed by a tag"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual(['These two slashes // are not followed by a tag'])
				expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('These') }, end: { line: 2 } }])
			})
			test('"someCode() // [!note] Contents can include `// [!this]` due to the whitespace rule"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual(['Contents can include `// [!this]` due to the whitespace rule'])
				expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Contents') }, end: { line: 2 } }])
			})
			test('"someCode() // [!note] Mismatching comment # [!syntax] also prevents chaining"', ({ task }) => {
				const commentLine = task.name.slice(1, -1)
				const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
				expect(comment.contents).toEqual(['Mismatching comment # [!syntax] also prevents chaining'])
				expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(' //') }, end: { line: 2 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Mismatching') }, end: { line: 2 } }])
			})
		})
		describe(`Allows multi-line content by repeating the same opening syntax`, () => {
			test('Single annotation comment with multi-line content', () => {
				const lines = [
					// Starts like a regular single-line annotation comment...
					'// [!note] Annotation content',
					// ...but continues on the next lines by repeating the comment opening syntax
					'// that spans multiple lines',
					'// until the comment ends',
					// ...and ends when the comment syntax is not repeated
					'someCode()',
				]
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 4 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } },
					{ start: { line: 3, column: lines[1].indexOf('that') }, end: { line: 3 } },
					{ start: { line: 4, column: lines[2].indexOf('until') }, end: { line: 4 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 3 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } },
					{ start: { line: 3, column: lines[1].indexOf('that') }, end: { line: 3 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation 1 content', 'that spans multiple lines'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 3 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } },
					{ start: { line: 3, column: lines[1].indexOf('that') }, end: { line: 3 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines'])
				// Expect the "---" line to be included in the comment range
				// so it will be removed when the comment is removed
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 4 } })
				// However, it must not be included in the content ranges
				expect(comment.contentRanges).toEqual([
					{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } },
					{ start: { line: 3, column: lines[1].indexOf('that') }, end: { line: 3 } },
				])
			})
			test('Comments starting after code on the same line cannot be multi-line', () => {
				const lines = [
					// A regular single-line comment that starts after some code
					'someCode() // [!note] Annotation content',
					// ...cannot be continued on the next line
					'// This is a regular comment and not part of the annotation',
				]
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content'])
				expect(comment.commentRange).toEqual({ start: { line: 2, column: lines[0].indexOf(' // [!') }, end: { line: 2 } })
				expect(comment.contentRanges).toEqual([{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } }])
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
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual([])
						expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
						expect(comment.contentRanges).toEqual([])
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"%s[!note] Annotation content%s"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!note] Annotation content${cs(closing)}`
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual(['Annotation content'])
						expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
						expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2, column: commentLine.indexOf('content') + 7 } }])
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
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual([])
						// Expect all mandatory whitespace between the comment and the code
						// to be included in the comment range
						expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2, column: commentLine.indexOf('someCode') } })
						expect(comment.contentRanges).toEqual([])
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"%s[!note] Annotation content%ssomeCode()"', (opening, closing) => {
						const commentLine = `${cs(opening)}[!note] Annotation content${cs(closing)}someCode()`
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual(['Annotation content'])
						// Expect all mandatory whitespace between the comment and the code
						// to be included in the comment range
						expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2, column: commentLine.indexOf('someCode') } })
						expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2, column: commentLine.indexOf('content') + 7 } }])
					})
				})
				test('Does not capture indentation before the comment', () => {
					const commentLine = `  /* [!ins] */ someCode()`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([])
					// Expect all mandatory whitespace between the comment and the code
					// to be included in the comment range, BUT NOT the indentation
					expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf('/*') }, end: { line: 2, column: commentLine.indexOf('someCode') } })
					expect(comment.contentRanges).toEqual([])
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
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual([])
						// Expect all mandatory whitespace between the code and the comment
						// to be included in the comment range
						expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(cs(opening)) }, end: { line: 2 } })
						expect(comment.contentRanges).toEqual([])
					})
				})
				describe('With content', () => {
					test.each(syntaxes)('"someCode()%s[!note] Annotation content%s"', (opening, closing) => {
						const commentLine = `someCode()${cs(opening)}[!note] Annotation content${cs(closing)}`
						const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
						expect(comment.contents).toEqual(['Annotation content'])
						// Expect all mandatory whitespace between the code and the comment
						// to be included in the comment range
						expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(cs(opening)) }, end: { line: 2 } })
						expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2, column: commentLine.indexOf('content') + 7 } }])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 4 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 2, column: lines[0].indexOf('Annotation') }, end: { line: 2 } },
					{ start: { line: 3 }, end: { line: 3 } },
					{ start: { line: 4 }, end: { line: 4, column: lines[2].indexOf(' */') } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 6 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4 }, end: { line: 4 } },
					{ start: { line: 5 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 6 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 2 }, end: { line: 4 } },
					{ start: { line: 5, column: 2 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 6 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 1 }, end: { line: 4 } },
					{ start: { line: 5, column: 1 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 6 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 4 }, end: { line: 4 } },
					{ start: { line: 5, column: 4 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 5 }, end: { line: 7 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 5, column: lines[3].indexOf('Annotation') }, end: { line: 5 } },
					{ start: { line: 6, column: 4 }, end: { line: 6 } },
					{ start: { line: 7, column: 4 }, end: { line: 7 } },
				])
			})
			test('Excludes non-annotation content even without a line break before it', () => {
				const lines = [
					// Non-annotation content directly after the opening syntax
					'\t/** Some JSDoc that is not part of the annotation comment.',
					// Annotation content
					'\t * [!note] Annotation content',
					'\t * that spans multiple lines',
					'\t * until the comment ends',
					// Closing syntax that should not be included in the comment range
					// as the comment also contains non-annotation content
					'\t */',
					'\tsomeCode()',
				]
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				expect(comment.commentRange).toEqual({ start: { line: 3 }, end: { line: 5 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 4 }, end: { line: 4 } },
					{ start: { line: 5, column: 4 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until the comment ends'])
				// Expect the closing syntax not to be included in the comment range
				// as the comment also contains non-annotation content
				expect(comment.commentRange).toEqual({ start: { line: 4 }, end: { line: 6, column: lines[4].indexOf(' */') } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 4, column: lines[2].indexOf('Annotation') }, end: { line: 4 } },
					{ start: { line: 5, column: 4 }, end: { line: 5 } },
					{ start: { line: 6, column: 4 }, end: { line: 6, column: lines[4].indexOf(' */') } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until a new tag is encountered'])
				// Do not include the second annotation in the comment range
				expect(comment.commentRange).toEqual({ start: { line: 3 }, end: { line: 5 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 4 }, end: { line: 4 } },
					{ start: { line: 5, column: 4 }, end: { line: 5 } },
				])
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
				const comment = getParentComment(getTestCode(lines.join('\n'))) as AnnotationComment
				expect(comment.contents).toEqual(['Annotation content', 'that spans multiple lines', 'until "---" is encountered'])
				expect(comment.commentRange).toEqual({ start: { line: 3 }, end: { line: 6 } })
				expect(comment.contentRanges).toEqual([
					{ start: { line: 3, column: lines[1].indexOf('Annotation') }, end: { line: 3 } },
					{ start: { line: 4, column: 4 }, end: { line: 4 } },
					{ start: { line: 5, column: 4 }, end: { line: 5 } },
				])
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

	function getParentComment(code: string) {
		const codeLines = splitCodeLines(code)
		const annotationTags = parseAnnotationTags({ codeLines })
		expect(annotationTags.length, 'No annotation tag was found in test code').toBeGreaterThanOrEqual(1)
		const tag = annotationTags[0]
		return parseParentComment({ codeLines, tag })
	}
})
