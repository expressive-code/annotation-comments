import { coerceError } from './errors'

/**
 * Takes a string or existing regular expression as input and returns a regular expression
 * that has the global flag set.
 *
 * If supported by the platform this code is running on, it will also set the `d` flag that
 * enables capture group indices.
 */
export function createGlobalRegExp(pattern: string | RegExp, extraFlags?: string): RegExp {
	let regExp: RegExp | undefined
	try {
		// Try to use regular expressions with capture group indices
		regExp = new RegExp(pattern, 'gd' + (extraFlags || ''))
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_error) {
		try {
			// Use fallback if unsupported
			regExp = new RegExp(pattern, 'g' + (extraFlags || ''))
		} catch (error) {
			throw new Error(`Failed to parse \`${pattern}\` as regular expression: ${coerceError(error).message}`)
		}
	}
	return regExp
}

/**
 * Retrieves all group indices from the given RegExp match. Group indices are ranges
 * defined by start & end positions. The first group index refers to the full match,
 * and the following indices to RegExp capture groups (if any).
 *
 * If the RegExp flag `d` was enabled (and supported), it returns the native group indices.
 *
 * Otherwise, it uses fallback logic to manually search for the group contents inside the
 * full match. Note that this can be wrong if a group's contents can be found multiple times
 * inside the full match, but that's probably a rare case and still better than failing.
 */
export function getGroupIndicesFromRegExpMatch(match: RegExpMatchArray) {
	// Read the start and end ranges from the `indices` property,
	// which is made available through the RegExp flag `d`
	let groupIndices = match.indices as ([start: number, end: number] | null)[]
	/* v8 ignore start */
	if (groupIndices?.length) return groupIndices

	// We could not access native group indices, so we need to use fallback logic
	// to find the position of each capture group match inside the full match
	const fullMatchIndex = match.index as number
	groupIndices = match.map((groupValue) => {
		const groupIndex = groupValue ? match[0].indexOf(groupValue) : -1
		if (groupIndex === -1) return null
		const groupStart = fullMatchIndex + groupIndex
		const groupEnd = groupStart + groupValue.length
		return [groupStart, groupEnd]
	})

	return groupIndices
	/* v8 ignore end */
}

/**
 * Searches the given content for matches of the given regular expression,
 * and returns the column ranges of all matches.
 *
 * If the regular expression contains capture groups, it will use the column ranges
 * of the matched capture groups instead of the full match ranges.
 */
export function findRegExpMatchColumnRanges(content: string, regExp: RegExp) {
	const columnRanges: { start: number; end: number }[] = []
	const matches = content.matchAll(regExp)
	for (const match of matches) {
		const rawGroupIndices = getGroupIndicesFromRegExpMatch(match)
		// Remove null group indices
		let groupIndices = rawGroupIndices.flatMap((range) => (range ? [range] : []))
		// If there are no non-null indices, use the full match instead
		// (capture group feature fallback, impossible to cover in tests)
		/* c8 ignore start */
		if (!groupIndices.length) {
			groupIndices = [[match.index, match.index + match[0].length]]
		}
		/* c8 ignore end */
		// If there are multiple non-null indices, remove the first one
		// as it is the full match and we only want to mark capture groups
		if (groupIndices.length > 1) {
			groupIndices.shift()
		}
		// Create marked ranges from all remaining group indices
		groupIndices.forEach((range) => {
			columnRanges.push({
				start: range[0],
				end: range[1],
			})
		})
	}
	return columnRanges
}
