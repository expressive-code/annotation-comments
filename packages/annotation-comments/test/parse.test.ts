import { describe, expect, test } from 'vitest'

describe('parseAnnotationComments()', () => {
	// TODO: We need to test if the parser properly skips processing the second annotation tag
	// in the following code, which requires checking the comment range of the previously processed
	// annotation comment and skipping all tags located before the end of the comment range:
	// "someCode() // [!note] Mismatching comment # [!syntax] also prevents chaining"
	test('Todo', () => {
		expect(true).toBe(true)
	})
})
