import { describe, expect, test } from 'vitest'
import type { AnnotationTag } from '../src/core/types'
import { parseAnnotationTags } from '../src/parsers/annotation-tags'
import { createGlobalRegExp } from '../src/internal/regexps'
import { splitCodeLines } from './utils'

describe('parseAnnotationTags()', () => {
	test('Returns an empty array when no annotation tags are found', () => {
		const codeLines = [
			// Example code without an annotation tag
			'// This is a simple comment.',
			'console.log("Some code");',
			'',
			'/*',
			'\t[TODO] Not an annotation tag.',
			'*/',
		]
		const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })

		expect(annotationTags).toEqual([])
		expect(errorMessages).toEqual([])
	})

	describe('Returns error messages when invalid annotation tags are found', () => {
		test('Single invalid regular expression', () => {
			const codeLines = [
				// The following regular expression should cause an error to be returned
				'// [!note:/(this|group|is|unclosed/] Note the invalid regexp in the search query.',
				'console.log("Some code");',
			]
			const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })

			expect(annotationTags).toEqual([])
			expect(errorMessages).toEqual([
				// Expect the line number and regexp contents to be called out
				expect.stringMatching(/line 1.*\(this\|group/),
			])
		})
		test('Multiple invalid regular expressions', () => {
			const codeLines = [
				// The following regular expression should cause an error to be returned
				'// [!note:/(this|group|is|unclosed/] Note the invalid regexp in the search query.',
				'console.log("Some code");',
				'// [!note:/te[st/] This regexp is also invalid.',
				'console.log("Some more code");',
			]
			const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })

			expect(annotationTags).toEqual([])
			expect(errorMessages).toEqual([
				// Expect both lines and regexp contents to be called out
				expect.stringMatching(/line 1.*\(this\|group/),
				expect.stringMatching(/line 3.*te\[st/),
			])
		})
		test('Valid tags are still parsed even if invalid ones are also present', () => {
			const codeLines = [
				// The following regular expression should cause an error to be returned
				'// [!note:/(this|group|is|unclosed/] Note the invalid regexp in the search query.',
				'console.log("Some code"); // [!tag] This is a valid tag.',
				'// [!note:/te[st/] This regexp is also invalid.',
				'console.log("Some more code");',
			]
			const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })

			expect(annotationTags).toEqual([
				expect.objectContaining({
					name: 'tag',
					targetSearchQuery: undefined,
					relativeTargetRange: undefined,
				}),
			])
			expect(errorMessages).toEqual([
				// Expect both lines and regexp contents to be called out
				expect.stringMatching(/line 1.*\(this\|group/),
				expect.stringMatching(/line 3.*te\[st/),
			])
		})
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

			test(`[!tag:"C:\\Users\\Test Path"]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: `C:\\Users\\Test Path`,
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

		describe('Tags with RegExp target search query', () => {
			test(`[!tag:/reg(exp)|regular (expression)/]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/reg(exp)|regular (expression)/),
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:/with escaped \\\\ backslash and \\/ slash/]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/with escaped \\ backslash and \/ slash/),
					relativeTargetRange: undefined,
				})
			})

			test(`[!tag:/regexp[s]?|"regular\\s+\\w{2}pressions?"/]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/regexp[s]?|"regular\s+\w{2}pressions?"/),
					relativeTargetRange: undefined,
				})
			})
		})

		describe('Tags with RegExp target search query and target range', () => {
			test(`[!tag:/reg(exp)|regular (expression)/:5]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/reg(exp)|regular (expression)/),
					relativeTargetRange: 5,
				})
			})

			test(`[!tag:/with escaped \\\\ backslash and \\/ slash/:-3]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/with escaped \\ backslash and \/ slash/),
					relativeTargetRange: -3,
				})
			})

			test(`[!tag:/regexp[s]?|"regular\\s+\\w{2}pressions?"/:1]`, ({ task }) => {
				performTagTest({
					rawTag: task.name,
					name: 'tag',
					targetSearchQuery: createGlobalRegExp(/regexp[s]?|"regular\s+\w{2}pressions?"/),
					relativeTargetRange: 1,
				})
			})
		})
	})

	function performTagTest(test: Required<Omit<AnnotationTag, 'range'>>) {
		const codeLines = splitCodeLines(`
// ${test.rawTag} Tag in a single-line comment
console.log('Some code'); // ${test.rawTag} Tag at the end of a line
/*
${test.rawTag} Tag in a multi-line comment
*/
		`)
		// Build array of expected tags by searching the raw tag in the code lines
		const expectedAnnotationTags = codeLines.reduce((acc, line, lineIndex) => {
			let startIndex = line.indexOf(test.rawTag)
			while (startIndex !== -1) {
				acc.push({
					name: test.name,
					rawTag: test.rawTag,
					relativeTargetRange: test.relativeTargetRange,
					targetSearchQuery: test.targetSearchQuery,
					range: {
						start: { line: lineIndex, column: startIndex },
						end: { line: lineIndex, column: startIndex + test.rawTag.length },
					},
				})
				startIndex = line.indexOf(test.rawTag, startIndex + 1)
			}
			return acc
		}, [] as AnnotationTag[])
		// Perform test
		const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })
		expect(annotationTags).toEqual(expectedAnnotationTags)
		expect(errorMessages).toEqual([])
	}
})
