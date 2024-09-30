import { describe, expect, test } from 'vitest'
import { parseAnnotationComments } from '../src/core/parse'
import { cleanCode } from '../src/core/clean'
import { splitCodeLines } from './utils'

describe('cleanCode()', () => {
	describe('Cleans single-line annotation comments without content', () => {
		test('At the beginning of the line', () => {
			const lines = [
				// Only multi-line annotation syntax is possible
				`/* [!ins] */ console.log('Inserted line')`,
				`/* [!mark] */ testCode()`,
			]
			const expectedResult = [
				// Expect both syntaxes to be removed
				`console.log('Inserted line')`,
				`testCode()`,
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('After code', () => {
			const lines = [
				// Single-line annotation syntax
				`console.log('Inserted line') // [!ins]`,
				// Multi-line annotation syntax
				`testCode() /* [!mark] */`,
			]
			const expectedResult = [
				// Expect both syntaxes to be removed
				`console.log('Inserted line')`,
				`testCode()`,
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('After a regular comment on the same line', () => {
			const lines = [
				// Single-line annotation syntax
				`console.log('Inserted line') // Some comment // [!ins]`,
				// Multi-line annotation syntax
				`testCode() /* Another comment */ /* [!mark] */`,
			]
			const expectedResult = [
				// Expect both syntaxes to be removed
				`console.log('Inserted line') // Some comment`,
				`testCode() /* Another comment */`,
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('On their own line', () => {
			const lines = [
				// Single-line annotation syntax
				`// [!ins]`,
				`console.log('Inserted line')`,
				// Multi-line annotation syntax
				`/* [!mark] */`,
				`testCode()`,
			]
			const expectedResult = [
				// Expect both syntaxes to be removed
				`console.log('Inserted line')`,
				`testCode()`,
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('Chained single-line annotations', () => {
			const lines = [
				`console.log('Hello world')`,
				// Two chained annotations at the end of a line
				`testCode() // [!mark] // [!test]`,
			]
			const expectedResult = [
				`console.log('Hello world')`,
				// Expect both annotations to be removed
				`testCode()`,
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('Removes the entire line if it becomes empty through cleaning', () => {
			const lines = [
				// A line consisting of two chained annotations
				`// [!test] // [!ins]`,
				`console.log('Inserted test line')`,
				// Another one with some extra indentation
				`  // [!test]   // [!ins]`,
				`testCode()`,
			]
			const expectedResult = [
				// Expect all annotation lines to be removed
				`console.log('Inserted test line')`,
				`testCode()`,
			]
			validateCleanedCode(lines, expectedResult)
		})
	})

	describe('Cleans multi-line annotation comments without content', () => {
		test('Comments only containing a single annotation', () => {
			const lines = [
				// Test different line break locations
				'/* [!test]',
				'*/',
				'someCode()',
				'/*',
				'  [!test] */',
				'someCode()',
				'/*',
				'  [!test]',
				'*/',
				'someCode()',
				// Additional empty lines around the tag
				'/*',
				'',
				'  [!test]',
				'',
				'*/',
				'someCode()',
			]
			const expectedResult = [
				// Expect all annotation comments to be removed
				'someCode()',
				'someCode()',
				'someCode()',
				'someCode()',
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('Comments containing annotations and other content', () => {
			const lines = [
				// Test different line break locations
				'/* [!test]',
				'  ---',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'  [!ins]',
				'  [!test] */',
				'someCode()',
				'/*',
				'  Regular comment',
				'  [!test]',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'  [!test]',
				'  [!ins]',
				'*/',
				'someCode()',
			]
			const expectedResult = [
				// Expect all annotation comments to be removed
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('Removes up to one empty line between other content and annotations', () => {
			const lines = [
				// Test different amounts of annotations and whitespace
				'/*',
				'  Regular comment',
				'',
				'  [!test] */',
				'someCode()',
				'/*',
				'  Regular comment',
				'',
				'  [!ins]',
				'',
				'  [!test] */',
				'someCode()',
				'/*',
				'  Regular comment',
				'  ',
				'  [!test]',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'  ',
				'  [!test]',
				'  [!ins]',
				'*/',
				'someCode()',
			]
			const expectedResult = [
				// Expect all annotation comments to be removed
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
				'/*',
				'  Regular comment',
				'*/',
				'someCode()',
			]
			validateCleanedCode(lines, expectedResult)
		})
		test('Comments containing multiple annotations, but no other content', () => {
			const lines = [
				// Test different line break locations
				'/* [!test]',
				'  [!ins]',
				'*/',
				'someCode()',
				'/*',
				'  [!ins]',
				'  [!test] */',
				'someCode()',
				'/*',
				'  [!test]',
				'  [!ins]',
				'*/',
				'someCode()',
				// Additional empty lines around the tags
				'/*',
				'',
				'  [!test]',
				'',
				'  [!ins]',
				'',
				'*/',
				'someCode()',
			]
			const expectedResult = [
				// Expect all annotation comments to be removed
				'someCode()',
				'someCode()',
				'someCode()',
				'someCode()',
			]
			validateCleanedCode(lines, expectedResult)
		})
	})

	function validateCleanedCode(code: string[], expectedCode: string[]) {
		const codeLines = Array.isArray(code) ? code : splitCodeLines(code)
		const { annotationComments, errorMessages } = parseAnnotationComments({ codeLines })
		expect(errorMessages, 'Test code failed to parse without errors').toEqual([])
		cleanCode({ codeLines, annotationComments })
		expect(codeLines.join('\n'), 'Unexpected cleaned code result').toEqual(expectedCode.join('\n'))
	}
})
