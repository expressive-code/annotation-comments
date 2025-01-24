import { describe, expect, test } from 'vitest'
import type { AnnotationComment } from '../src/core/types'
import { parseAnnotationComments } from '../src/core/parse'
import { cleanCode, CleanCodeOptions } from '../src/core/clean'
import { formatAnnotationComment, formatAnnotationComments, getArrayPermutations, splitCodeLines } from './utils'

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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
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
				validateCleanedCode(lines, expectedResult, { removeAnnotationContents: true })
			})
		})
	})

	describe('Supports allowCleaning() callback', () => {
		describe('When cleaning single-line annotation comments', () => {
			describe('Without content', () => {
				test('After code', () => {
					const lines = [
						// Single-line annotation syntax
						`console.log('Inserted line') // [!test]`,
						`console.log('Inserted line') // [!ins]`,
						// Multi-line annotation syntax
						`testCode() /* [!mark] */`,
						`testCode() /* [!test] */`,
					]
					const expectedResult = [
						// Expect both syntaxes to be removed
						`console.log('Inserted line')`,
						`console.log('Inserted line') // [!ins]`,
						`testCode() /* [!mark] */`,
						`testCode()`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
				test('After a regular comment on the same line', () => {
					const lines = [
						// Single-line annotation syntax
						`console.log('Inserted line') // Some comment // [!test]`,
						`console.log('Inserted line') // Some comment // [!ins]`,
						// Multi-line annotation syntax
						`testCode() /* Another comment */ /* [!mark] */`,
						`testCode() /* Another comment */ /* [!test] */`,
					]
					const expectedResult = [
						// Expect both syntaxes to be removed
						`console.log('Inserted line') // Some comment`,
						`console.log('Inserted line') // Some comment // [!ins]`,
						`testCode() /* Another comment */ /* [!mark] */`,
						`testCode() /* Another comment */`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
				test('On a separate line', () => {
					const lines = [
						// Single-line annotation syntax
						`// [!ins]`,
						`// [!test]`,
						`console.log('Inserted line')`,
						// Multi-line annotation syntax
						`/* [!test] */`,
						`/* [!mark] */`,
						`testCode()`,
					]
					const expectedResult = [
						// Expect both syntaxes to be removed
						`// [!ins]`,
						`console.log('Inserted line')`,
						`/* [!mark] */`,
						`testCode()`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
				test('Chained single-line annotations', () => {
					const lines = [
						`console.log('Hello world')`,
						// Two chained annotations at the end of a line
						`testCode() // [!test] // [!mark]`,
						`testCode() // [!mark] // [!test]`,
					]
					const expectedResult = [
						`console.log('Hello world')`,
						// Expect only the "test" annotations to be removed
						`testCode() // [!mark]`,
						`testCode() // [!mark]`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
				test('Removes the entire line if it becomes empty through cleaning', () => {
					const lines = [
						// A line consisting of two chained annotations
						`// [!ins] // [!test]`,
						`// [!test] // [!test]`,
						`console.log('Inserted test line')`,
						// Another one with some extra indentation
						`    // [!ins] // [!test]`,
						`    // [!test] // [!test]`,
						`    testCode()`,
					]
					const expectedResult = [
						// Expect all annotation lines to be removed and the indentation to match
						`// [!ins]`,
						`console.log('Inserted test line')`,
						`    // [!ins]`,
						`    testCode()`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
			describe('With content not selected for removal', () => {
				test('Chained single-line annotations', () => {
					const lines = [
						`console.log('Hello world')`,
						// Two chained annotations at the end of a line
						`testCode() // [!test] Content 1 // [!mark] Content 2`,
						`testCode() // [!mark] Content 1 // [!test] Content 2`,
					]
					const expectedResult = [
						`console.log('Hello world')`,
						// Expect "test" tags to be removed
						`testCode() // Content 1 // [!mark] Content 2`,
						`testCode() // [!mark] Content 1 // Content 2`,
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
			describe('With content selected for removal', () => {
				test('Chained single-line annotations', () => {
					const lines = [
						`console.log('Hello world')`,
						// Two chained annotations at the end of a line
						`testCode() // [!test] Content 1 // [!mark] Content 2`,
						`testCode() // [!mark] Content 1 // [!test] Content 2`,
					]
					const expectedResult = [
						`console.log('Hello world')`,
						// Expect test comments to be removed
						`testCode() // [!mark] Content 2`,
						`testCode() // [!mark] Content 1`,
					]
					validateCleanedCode(lines, expectedResult, {
						removeAnnotationContents: true,
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
		})
		describe('When cleaning multi-line annotation comments', () => {
			describe('Without content', () => {
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
						// Expect all [!test] annotations to be removed
						'/*',
						'  [!ins]',
						'*/',
						'someCode()',
						'/*',
						'  [!ins]',
						'*/',
						'someCode()',
						'/*',
						'  [!ins]',
						'*/',
						'someCode()',
						'/*',
						'',
						'  [!ins]',
						'',
						'*/',
						'someCode()',
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
			describe('With content not selected for removal', () => {
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
						'  [!ins] This is content',
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
						'  [!ins] This is content',
						'*/',
						'someCode()',
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
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
						' * [!ins] This is content',
						' */',
						'someCode()',
					]
					validateCleanedCode(lines, expectedResult, {
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
			describe('With content selected for removal', () => {
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
						'  [!ins] This is content',
						'*/',
						'someCode()',
						'/*',
						'  Regular comment',
						'*/',
						'someCode()',
						'/*',
						'  Regular comment',
						'  [!ins] This is content',
						'*/',
						'someCode()',
					]
					validateCleanedCode(lines, expectedResult, {
						removeAnnotationContents: true,
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
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
						' * [!ins] This is content',
						' */',
						'someCode()',
					]
					validateCleanedCode(lines, expectedResult, {
						removeAnnotationContents: true,
						allowCleaning: ({ comment }) => comment.tag.name === 'test',
					})
				})
			})
		})
	})

	function validateCleanedCode(code: string[], expectedCode: string[], options: Omit<CleanCodeOptions, 'codeLines' | 'annotationComments'> = {}) {
		const codeLines = Array.isArray(code) ? code : splitCodeLines(code)
		const { annotationComments, errorMessages } = parseAnnotationComments({ codeLines })
		expect(errorMessages, 'Test code failed to parse without errors').toEqual([])

		// First, test cleaning the annotations all at once
		const singlePassAnnotations = cloneAnnotationComments(annotationComments)
		const singlePassCleaningResult = [...codeLines]
		cleanCode({
			...options,
			codeLines: singlePassCleaningResult,
			annotationComments: singlePassAnnotations,
		})
		expect(singlePassCleaningResult.join('\n'), `Unexpected single-pass code cleaning result`).toEqual(expectedCode.join('\n'))

		// Then, test cleaning all possible subsets of annotations in multiple passes
		const allowedIndices = annotationComments
			.map((comment, index) => {
				const allowed = (typeof options.allowCleaning === 'function' ? options.allowCleaning({ comment }) : options.allowCleaning) ?? true
				return allowed ? index : -1
			})
			.filter((index) => index >= 0)
		for (let omitCount = 1; omitCount < allowedIndices.length - 1; omitCount++) {
			const firstPassIndices = getArrayPermutations(allowedIndices.length, omitCount)
			firstPassIndices.forEach((permutation) => {
				const indices = permutation.map((index) => allowedIndices[index])
				// Prepare an array of indices that are not in the first pass for one-by-one cleaning
				const oneByOneIndices = allowedIndices.filter((index) => !indices.includes(index))
				performMultiPassTest(indices, oneByOneIndices)
				// Also test the reverse order
				oneByOneIndices.reverse()
				performMultiPassTest(indices, oneByOneIndices)
			})
		}

		function performMultiPassTest(firstPassIndices: number[], oneByOneIndices: number[]) {
			const multiPassAnnotations = cloneAnnotationComments(annotationComments)
			const multiPassCleaningResult = [...codeLines]
			const snapshots: { code: string; annotations: AnnotationComment[] }[] = []
			const takeSnapshot = () => {
				snapshots.push({
					code: multiPassCleaningResult.join('\n'),
					annotations: cloneAnnotationComments(multiPassAnnotations),
				})
			}
			const formatCode = (code: string) =>
				code
					.split('\n')
					.map((line, index) => `${index.toString().padStart(2, ' ')}: ${line}`)
					.join('\n')
			const formatSnapshots = () =>
				`\n\nSnapshots:\n\n${snapshots.map(({ code, annotations }) => `${formatCode(code)}\n\n${formatAnnotationComments(annotations)}`).join('\n\n---\n\n')}`
			takeSnapshot()

			// First clean up to n-1 annotations in a batch
			cleanCode({
				...options,
				codeLines: multiPassCleaningResult,
				annotationComments: multiPassAnnotations,
				allowCleaning: ({ comment }) => firstPassIndices.includes(multiPassAnnotations.indexOf(comment)),
			})
			takeSnapshot()
			expect(
				multiPassCleaningResult.join('\n'),
				`First pass ${JSON.stringify(firstPassIndices)} from ${multiPassAnnotations.length} comments in multi-pass code cleaning cleaned too much`
			).not.toEqual(expectedCode.join('\n'))

			// Now clean the rest one by one
			oneByOneIndices.forEach((annotationIndex, oneByOneArrayIndex) => {
				const annotation = multiPassAnnotations[annotationIndex]
				let allowedCleaning = 0
				cleanCode({
					...options,
					codeLines: multiPassCleaningResult,
					annotationComments: multiPassAnnotations,
					allowCleaning: ({ comment }) => {
						const result = comment === annotation
						if (result) allowedCleaning++
						return result
					},
				})
				takeSnapshot()
				expect(allowedCleaning, 'Unexpected number of annotations allowed to clean').toEqual(1)
				expect(
					snapshots[snapshots.length - 2].code,
					`One-by-one pass of annotation ${multiPassAnnotations.indexOf(annotation)} (${formatAnnotationComment(annotation)}) after batch ${JSON.stringify(firstPassIndices)} from ${multiPassAnnotations.length} comments in multi-pass code cleaning did not change the code.${formatSnapshots()}`
				).not.toEqual(snapshots[snapshots.length - 1].code)
				if (oneByOneArrayIndex < oneByOneIndices.length - 1) {
					expect(
						multiPassCleaningResult.join('\n'),
						`One-by-one pass of annotation ${multiPassAnnotations.indexOf(annotation)} (${formatAnnotationComment(annotation)}) after batch ${JSON.stringify(firstPassIndices)} from ${multiPassAnnotations.length} comments in multi-pass code cleaning cleaned too much.${formatSnapshots()}`
					).not.toEqual(expectedCode.join('\n'))
				}
			})
			expect(
				multiPassCleaningResult.join('\n'),
				`Unexpected final result after multi-pass cleaning test with batch ${JSON.stringify(firstPassIndices)} from ${multiPassAnnotations.length} comments.${formatSnapshots()}`
			).toEqual(expectedCode.join('\n'))
		}
	}

	function cloneAnnotationComments(input: AnnotationComment[]) {
		return input.map((original) => {
			const cloned = JSON.parse(JSON.stringify(original)) as AnnotationComment
			if (original.commentSyntax.continuationLineStart) cloned.commentSyntax.continuationLineStart = new RegExp(original.commentSyntax.continuationLineStart.source)
			return cloned
		})
	}
})
