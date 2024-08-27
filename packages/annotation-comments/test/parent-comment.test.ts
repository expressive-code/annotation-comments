import { describe, expect, test } from 'vitest'
import type { AnnotationTag, AnnotationComment } from '../src/core/types'
import { parseAnnotationTags } from '../src/parsers/annotation-tags'
import { parseParentComment } from '../src/parsers/parent-comment'
import { splitCodeLines } from './utils'

describe('parseParentComment', () => {
	test('Returns undefined when no parent comment is found', () => {
		expect(
			getParentComment(`
// This comment is not on the same line as the tag
console.log('Some code containing [!ins] outside of a comment');
			`)
		).toEqual(undefined)
	})

	describe('Single-line comments', () => {
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
