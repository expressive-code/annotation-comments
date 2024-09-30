import { describe, expect, test } from 'vitest'
import { parseAnnotationComments } from '../src/core/parse'
import { cleanCode, CleanCodeOptions } from '../src/core/clean'
import { splitCodeLines } from './utils'

describe('cleanCode()', () => {
	describe('Cleans single-line annotation comments', () => {
		describe('Without content', () => {
			test('At the beginning of the line', () => {
				const lines = [
					// Only multi-line annotation syntax is possible
					`/* [!ins] */ console.log('Inserted line')`,
				]
				const expectedResult = [
					// Expect full comment to be removed
					`console.log('Inserted line')`,
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
			test('On a separate line', () => {
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
		describe('With content not selected for removal', () => {
			test('At the beginning of the line', () => {
				const lines = [
					// Only multi-line annotation syntax is possible
					`/* [!ins] This should remain */ console.log('Inserted line')`,
				]
				const expectedResult = [
					// Expect only the tag to be removed
					`/* This should remain */ console.log('Inserted line')`,
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('After code', () => {
				const lines = [
					// Single-line annotation syntax
					`console.log('Inserted line') // [!ins] Add this line`,
					// Multi-line annotation syntax
					`testCode() /* [!mark] Call the function */`,
				]
				const expectedResult = [
					// Expect both tags to be removed
					`console.log('Inserted line') // Add this line`,
					`testCode() /* Call the function */`,
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('After a regular comment on the same line', () => {
				const lines = [
					// Single-line annotation syntax
					`console.log('Inserted line') // Some comment // [!ins] Add this`,
					// Multi-line annotation syntax
					`testCode() /* Another comment */ /* [!mark] Call this */`,
				]
				const expectedResult = [
					// Expect both tags to be removed
					`console.log('Inserted line') // Some comment // Add this`,
					`testCode() /* Another comment */ /* Call this */`,
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('On a separate line', () => {
				const lines = [
					// Single-line annotation syntax
					`// [!ins] Insert this`,
					`console.log('Inserted line')`,
					// Multi-line annotation syntax
					`/* [!mark] Call this */`,
					`testCode()`,
				]
				const expectedResult = [
					// Expect both tags to be removed
					`// Insert this`,
					`console.log('Inserted line')`,
					`/* Call this */`,
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('Chained single-line annotations', () => {
				const lines = [
					`console.log('Hello world')`,
					// Two chained annotations at the end of a line
					`testCode() // [!mark] Content 1 // [!test] Content 2`,
				]
				const expectedResult = [
					`console.log('Hello world')`,
					// Expect both tags to be removed
					`testCode() // Content 1 // Content 2`,
				]
				validateCleanedCode(lines, expectedResult)
			})
		})
		describe('With content selected for removal', () => {
			test('At the beginning of the line', () => {
				const lines = [
					// Only multi-line annotation syntax is possible
					`/* [!ins] Selected for removal */ console.log('Inserted line')`,
				]
				const expectedResult = [
					// Expect full comment to be removed
					`console.log('Inserted line')`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('After code', () => {
				const lines = [
					// Single-line annotation syntax
					`console.log('Inserted line') // [!ins] Add this line`,
					// Multi-line annotation syntax
					`testCode() /* [!mark] Call the function */`,
				]
				const expectedResult = [
					// Expect both comments to be removed
					`console.log('Inserted line')`,
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('After a regular comment on the same line', () => {
				const lines = [
					// Single-line annotation syntax
					`console.log('Inserted line') // Some comment // [!ins] Add this`,
					// Multi-line annotation syntax
					`testCode() /* Another comment */ /* [!mark] Call this */`,
				]
				const expectedResult = [
					// Expect both comments to be removed
					`console.log('Inserted line') // Some comment`,
					`testCode() /* Another comment */`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('On a separate line', () => {
				const lines = [
					// Single-line annotation syntax
					`// [!ins] Insert this`,
					`console.log('Inserted line')`,
					// Multi-line annotation syntax
					`/* [!mark] Call this */`,
					`testCode()`,
				]
				const expectedResult = [
					// Expect both comments to be removed
					`console.log('Inserted line')`,
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('Chained single-line annotations', () => {
				const lines = [
					`console.log('Hello world')`,
					// Two chained annotations at the end of a line
					`testCode() // [!mark] Content 1 // [!test] Content 2`,
				]
				const expectedResult = [
					`console.log('Hello world')`,
					// Expect both comments to be removed
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
		})
	})

	describe('Cleans multi-line annotation comments', () => {
		describe('Without content', () => {
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
			test('Comments containing annotations and other regular comment text', () => {
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
			test('Removes up to one empty line between other regular comment text and annotations', () => {
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
					// Also test with JSDoc syntax
					'/**',
					' * Regular comment',
					' * ',
					' * [!test]',
					' * [!ins]',
					' */',
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
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('Comments containing multiple annotations, but no other regular comment text', () => {
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
			test('JSDoc-style comments', () => {
				const lines = [
					// Test different line break locations
					'/** [!test]',
					' * ---',
					' * Regular comment',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test]',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test]',
					' * [!ins]',
					' */',
					'someCode()',
				]
				const expectedResult = [
					// Expect all annotation comments to be removed
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult)
			})
		})
		describe('With content not selected for removal', () => {
			test('Comments containing a single annotation with content', () => {
				const lines = [
					// Test different line break locations
					'/* [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  [!test] This is content */',
					'someCode()',
					'/*',
					'  [!test] This is content',
					'*/',
					'someCode()',
					// Additional empty lines around the tag
					'/*',
					'',
					'  [!test] This is content',
					'',
					'*/',
					'someCode()',
				]
				const expectedResult = [
					// Expect all annotation tags to be removed
					'/* This is content',
					'*/',
					'someCode()',
					'/*',
					'  This is content */',
					'someCode()',
					'/*',
					'  This is content',
					'*/',
					'someCode()',
					'/*',
					'',
					'  This is content',
					'',
					'*/',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('Comments containing annotations with content and other regular comment text', () => {
				const lines = [
					// Test different line break locations
					'/* Regular comment',
					'  [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!ins] This is content',
					'  [!test] This is content */',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!test] This is content',
					'  [!ins] This is content',
					'*/',
					'someCode()',
				]
				const expectedResult = [
					// Expect all annotation tags to be removed
					'/* Regular comment',
					'  This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  This is content',
					'  This is content */',
					'someCode()',
					'/*',
					'  Regular comment',
					'  This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  This is content',
					'  This is content',
					'*/',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('Repeated single-line comment syntax', () => {
				const lines = [
					// Content starting on a separate line
					`// [!test]`,
					`// This content belongs to the test annotation`,
					`console.log('Inserted test line')`,
					// Content starting in the tag line
					`// [!test] This content belongs to`,
					`// the test annotation`,
					`testCode()`,
					// Another one with a regular comment before the tag
					`// Regular comment text`,
					`// [!test]`,
					`// This content belongs to the test annotation`,
					`testCode()`,
				]
				const expectedResult = [
					// Expect all annotation tags to be removed
					`// This content belongs to the test annotation`,
					`console.log('Inserted test line')`,
					`// This content belongs to`,
					`// the test annotation`,
					`testCode()`,
					`// Regular comment text`,
					`// This content belongs to the test annotation`,
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult)
			})
			test('JSDoc-style comments', () => {
				const lines = [
					// Test different line break locations
					'/** Regular comment',
					' * [!test] This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test] This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test] This is content',
					' * which spans multiple lines',
					' *',
					' * [!ins] This is content',
					' */',
					'someCode()',
				]
				const expectedResult = [
					// Expect all annotation comments to be removed
					'/** Regular comment',
					' * This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * This is content',
					' * which spans multiple lines',
					' *',
					' * This is content',
					' */',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult)
			})
		})
		describe('With content selected for removal', () => {
			test('Comments containing a single annotation with content', () => {
				const lines = [
					// Test different line break locations
					'/* [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  [!test] This is content */',
					'someCode()',
					'/*',
					'  [!test] This is content',
					'*/',
					'someCode()',
					// Additional empty lines around the tag
					'/*',
					'',
					'  [!test] This is content',
					'',
					'*/',
					'someCode()',
				]
				const expectedResult = [
					// Expect full comments to be removed
					'someCode()',
					'someCode()',
					'someCode()',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('Comments containing annotations with content and other regular comment text', () => {
				const lines = [
					// Test different line break locations
					'/* Regular comment',
					'  [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!ins] This is content',
					'  [!test] This is content */',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!test] This is content',
					'*/',
					'someCode()',
					'/*',
					'  Regular comment',
					'  [!test] This is content',
					'  [!ins] This is content',
					'*/',
					'someCode()',
				]
				const expectedResult = [
					// Expect annotations to be removed, but not the regular comment text
					'/* Regular comment',
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
				validateCleanedCode(lines, expectedResult, true)
			})
			test('Repeated single-line comment syntax', () => {
				const lines = [
					// Content starting on a separate line
					`// [!test]`,
					`// This content belongs to the test annotation`,
					`console.log('Inserted test line')`,
					// Content starting in the tag line
					`// [!test] This content belongs to`,
					`// the test annotation`,
					`testCode()`,
					// Another one with a regular comment before the tag
					`// Regular comment text`,
					`// [!test]`,
					`// This content belongs to the test annotation`,
					`testCode()`,
				]
				const expectedResult = [
					// Expect all annotations to be removed
					`console.log('Inserted test line')`,
					`testCode()`,
					`// Regular comment text`,
					`testCode()`,
				]
				validateCleanedCode(lines, expectedResult, true)
			})
			test('JSDoc-style comments', () => {
				const lines = [
					// Test different line break locations
					'/** Regular comment',
					' * [!test] This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test] This is content',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' * [!test] This is content',
					' * which spans multiple lines',
					' *',
					' * [!ins] This is content',
					' */',
					'someCode()',
				]
				const expectedResult = [
					// Expect all annotations to be removed, but not the regular comment text
					'/** Regular comment',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
					'/**',
					' * Regular comment',
					' */',
					'someCode()',
				]
				validateCleanedCode(lines, expectedResult, true)
			})
		})
	})

	function validateCleanedCode(code: string[], expectedCode: string[], removeAnnotationContents: CleanCodeOptions['removeAnnotationContents'] = false) {
		const codeLines = Array.isArray(code) ? code : splitCodeLines(code)
		const { annotationComments, errorMessages } = parseAnnotationComments({ codeLines })
		expect(errorMessages, 'Test code failed to parse without errors').toEqual([])
		cleanCode({ codeLines, annotationComments, removeAnnotationContents })
		expect(codeLines.join('\n'), 'Unexpected cleaned code result').toEqual(expectedCode.join('\n'))
	}
})
