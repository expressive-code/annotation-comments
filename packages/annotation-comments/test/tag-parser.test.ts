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

	test('Name only: `[!tag]`', () => {
		expect(
			getTags(`
// [!some-tag] This is a simple tag.
console.log('Some code'); // [!end-of-line]

/*
[!start-of-line]
*/
			`)
		).toMatchObject([
			{
				name: 'some-tag',
				rawTag: '[!some-tag]',
				relativeTargetRange: undefined,
				targetSearchQuery: undefined,
				location: {
					startLineIndex: 0,
					endLineIndex: 0,
					startColIndex: 3,
					endColIndex: 14,
				},
			},
			{
				name: 'end-of-line',
				rawTag: '[!end-of-line]',
				relativeTargetRange: undefined,
				targetSearchQuery: undefined,
				location: {
					startLineIndex: 1,
					endLineIndex: 1,
					startColIndex: 29,
					endColIndex: 43,
				},
			},
			{
				name: 'start-of-line',
				rawTag: '[!start-of-line]',
				relativeTargetRange: undefined,
				targetSearchQuery: undefined,
				location: {
					startLineIndex: 4,
					endLineIndex: 4,
					startColIndex: 0,
					endColIndex: 16,
				},
			},
		])
	})

	test('With relative target range: `[!tag:3]`, `[!tag:-2]`', () => {
		expect(
			getTags(`
// [!tag:3] This is a tag with a relative target range.
console.log('Some code'); // [!lookback-range:-2]
			`)
		).toMatchObject([
			{
				name: 'tag',
				rawTag: '[!tag:3]',
				relativeTargetRange: 3,
				targetSearchQuery: undefined,
				location: {
					startLineIndex: 0,
					endLineIndex: 0,
					startColIndex: 3,
					endColIndex: 11,
				},
			},
			{
				name: 'lookback-range',
				rawTag: '[!lookback-range:-2]',
				relativeTargetRange: -2,
				targetSearchQuery: undefined,
				location: {
					startLineIndex: 1,
					endLineIndex: 1,
					startColIndex: 29,
					endColIndex: 49,
				},
			},
		])
	})

	test('With unquoted target search query: `[!tag:search-term]`', () => {
		expect(
			getTags(`
// [!tag:search-term] This is a tag with a plaintext target search query.
console.log('Some code'); // [!search:it can contain chars like .,;?!- as well]
			`)
		).toMatchObject([
			{
				name: 'tag',
				rawTag: '[!tag:search-term]',
				relativeTargetRange: undefined,
				targetSearchQuery: 'search-term',
				location: {
					startLineIndex: 0,
					endLineIndex: 0,
					startColIndex: 3,
					endColIndex: 21,
				},
			},
			{
				name: 'search',
				rawTag: '[!search:it can contain chars like .,;?!- as well]',
				relativeTargetRange: undefined,
				targetSearchQuery: 'it can contain chars like .,;?!- as well',
				location: {
					startLineIndex: 1,
					endLineIndex: 1,
					startColIndex: 29,
					endColIndex: 79,
				},
			},
		])
	})

	test('With unquoted target search query and target range: `[!tag:search-term:5]`', () => {
		expect(
			getTags(`
// [!tag:search-term:5] This is a tag with a plaintext target search query and relative target range.
console.log('Some code'); // [!search:it can contain chars like .,;?!- as well:-2]
			`)
		).toMatchObject([
			{
				name: 'tag',
				rawTag: '[!tag:search-term:5]',
				relativeTargetRange: 5,
				targetSearchQuery: 'search-term',
				location: {
					startLineIndex: 0,
					endLineIndex: 0,
					startColIndex: 3,
					endColIndex: 23,
				},
			},
			{
				name: 'search',
				rawTag: '[!search:it can contain chars like .,;?!- as well:-2]',
				relativeTargetRange: -2,
				targetSearchQuery: 'it can contain chars like .,;?!- as well',
				location: {
					startLineIndex: 1,
					endLineIndex: 1,
					startColIndex: 29,
					endColIndex: 82,
				},
			},
		])
	})

	test('With double-quoted target search query: `[!tag:"search term"]`', () => {
		expect(
			getTags(`
// [!tag:"search term"] This is a tag with a double-quoted target search query.
console.log('Some code'); // [!search:"it can contain chars like .,;:?!- as well"]
			`)
		).toMatchObject([
			{
				name: 'tag',
				rawTag: '[!tag:"search term"]',
				relativeTargetRange: undefined,
				targetSearchQuery: '"search term"',
				location: {
					startLineIndex: 0,
					endLineIndex: 0,
					startColIndex: 3,
					endColIndex: 23,
				},
			},
			{
				name: 'search',
				rawTag: '[!search:"it can contain chars like .,;:?!- as well"]',
				relativeTargetRange: undefined,
				targetSearchQuery: '"it can contain chars like .,;:?!- as well"',
				location: {
					startLineIndex: 1,
					endLineIndex: 1,
					startColIndex: 29,
					endColIndex: 82,
				},
			},
		])
	})

	function getTags(code: string) {
		const codeLines = code.trim().split(/\r?\n/)
		return parseAnnotationTags({ codeLines })
	}
})
