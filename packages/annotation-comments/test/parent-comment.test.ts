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
		describe('Starting at the beginning of the line', () => {
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
					syntax = syntax.replaceAll('<tab>', '\t')
					const commentLine = `${syntax}[!ins]`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([])
					expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([])
				})
			})
			describe('With content', () => {
				test.each(syntaxes)('"%s[!note] Annotation content"', (syntax) => {
					syntax = syntax.replaceAll('<tab>', '\t')
					const commentLine = `${syntax}[!note] Annotation content`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual(['Annotation content'])
					expect(comment.commentRange).toEqual({ start: { line: 2 }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([{ start: { line: 2, column: commentLine.indexOf('Annotation') }, end: { line: 2 } }])
				})
			})
		})
		describe('Starting after some code', () => {
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
					syntax = syntax.replaceAll('<tab>', '\t')
					const commentLine = `someCode()${syntax}[!del]`
					const comment = getParentComment(getTestCode(commentLine)) as AnnotationComment
					expect(comment.contents).toEqual([])
					expect(comment.commentRange).toEqual({ start: { line: 2, column: commentLine.indexOf(syntax) }, end: { line: 2 } })
					expect(comment.contentRanges).toEqual([])
				})
			})
			describe('With content', () => {
				test.each(cases)(`"someCode()%s[!note] Let's run it!"`, (syntax) => {
					syntax = syntax.replaceAll('<tab>', '\t')
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
