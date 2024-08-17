import type { AnnotationTag } from 'annotation-comments'
import { describe, expect, test } from 'vitest'
import { parseAnnotationTags } from '../src/internal/tag-parser'

describe('parseAnnotationTags', () => {
	test('Returns an empty array when no annotation tags are found', () => {
		expect(
			getTags(`
// This is a simple comment.
console.log('Some code');

/*
	[TODO] Not an annotation tag.
*/
			`)
		).toEqual([])
	})

	describe('Parses tag names', () => {
		test(`[!tag]`, ({ task }) => {
			performTagTest({
				rawTag: task.name,
				name: 'tag',
				targetSearchQuery: undefined,
				relativeTargetRange: undefined,
			})
		})
		test(`[!code tag] (for Shiki transformer compatibility)`, ({ task }) => {
			performTagTest({
				rawTag: task.name.replace(/ \(.*?\)/, ''),
				name: 'tag',
				targetSearchQuery: undefined,
				relativeTargetRange: undefined,
			})
		})
	})

	describe('Parses relative target ranges', () => {
		test(`[!positive-range:3]`, ({ task }) => {
			performTagTest({
				rawTag: task.name,
				name: 'positive-range',
				targetSearchQuery: undefined,
				relativeTargetRange: 3,
			})
		})

		test(`[!negative-range:-2]`, ({ task }) => {
			performTagTest({
				rawTag: task.name,
				name: 'negative-range',
				targetSearchQuery: undefined,
				relativeTargetRange: -2,
			})
		})
	})

	describe('Parses target search queries', () => {
		describe('Tags with unquoted target search query', () => {
			test(`[!tag:search-term]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: 'search-term',
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:term with spaces and chars like .,;?!"'/-]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `term with spaces and chars like .,;?!"'/-`,
					relativeTargetRange: undefined,
				})
			})
		})

		describe('Tags with unquoted target search query and target range', () => {
			test(`[!tag:search-term:5]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: 'search-term',
					relativeTargetRange: 5,
				})
			})

			test(`[!tag:term with spaces and chars like .;/"'?!-, too:-2]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `term with spaces and chars like .;/"'?!-, too`,
					relativeTargetRange: -2,
				})
			})
		})

		describe('Tags with quoted target search query', () => {
			test(`[!tag:"double-quoted term"]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `double-quoted term`,
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:'single-quoted term']`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `single-quoted term`,
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:"double-quoted term with 'single quotes' inside"]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `double-quoted term with 'single quotes' inside`,
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:'single-quoted term with "double quotes" inside']`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `single-quoted term with "double quotes" inside`,
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:"escaped \\"same style quotes\\" inside"]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `escaped "same style quotes" inside`,
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:"wild / ' mix / of:3] chars"]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `wild / ' mix / of:3] chars`,
					relativeTargetRange: undefined,
				})
			})
		})

		describe('Tags with quoted target search query and target range', () => {
			test(`[!tag:"double-quoted term":10]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `double-quoted term`,
					relativeTargetRange: 10,
				})
			})

			test(`[!tag:'single-quoted term':-5]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `single-quoted term`,
					relativeTargetRange: -5,
				})
			})
		})
	})

	function performTagTest(test: Required<Omit<AnnotationTag, 'location'>>) {
		const codeLines = splitCodeLines(`
// ${test.rawTag} Tag in a single-line comment
console.log('Some code'); // ${test.rawTag} Tag at the end of a line
/*
${test.rawTag} Tag in a multi-line comment
*/
		`)
		// Build expected result by searching the raw tag in the code lines
		const expected = codeLines.reduce((acc, line, lineIndex) => {
			let startIndex = line.indexOf(test.rawTag)
			while (startIndex !== -1) {
				acc.push({
					name: test.name,
					rawTag: test.rawTag,
					relativeTargetRange: test.relativeTargetRange,
					targetSearchQuery: test.targetSearchQuery,
					location: {
						startLineIndex: lineIndex,
						endLineIndex: lineIndex,
						startColIndex: startIndex,
						endColIndex: startIndex + test.rawTag.length,
					},
				})
				startIndex = line.indexOf(test.rawTag, startIndex + 1)
			}
			return acc
		}, [] as AnnotationTag[])
		// Perform test
		expect(parseAnnotationTags({ codeLines })).toEqual(expected)
	}

	function getTags(code: string) {
		const codeLines = splitCodeLines(code)
		return parseAnnotationTags({ codeLines })
	}

	function splitCodeLines(code: string) {
		return code.trim().split(/\r?\n/)
	}
})
