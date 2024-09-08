import type { AnnotationComment, AnnotationTag, SourceRange } from '../../core/types'
import type { ParseParentCommentOptions } from '../parent-comment'
import { escapeRegExp } from '../../internal/escaping'
import { compareRanges, createRange } from '../../internal/ranges'
import { getTextContentInLine } from '../text-content'

type MultiLineCommentSyntax = {
	opening: string
	closing: string
	continuationLineStart?: RegExp | undefined
}

type MultiLineCommentSyntaxMatch = {
	openingRange: SourceRange
	openingRangeWithWhitespace: SourceRange
	closingRange: SourceRange
	closingRangeWithWhitespace: SourceRange
	/**
	 * This flag gets set to `true` while looking for an opening/closing syntax pair
	 * if the current syntax has requirements that were not met on at least one line,
	 * e.g. a specific `continuationLineStart` syntax that was not found.
	 */
	invalid: boolean
}

const multiLineCommentSyntaxes: MultiLineCommentSyntax[] = [
	// JSDoc, JavaDoc - a leading `*` that is not part of the content is expected on each new line
	{ opening: '/**', closing: '*/', continuationLineStart: /^\s*\*(?=\s|$)/ },
	// JS, TS, CSS, Java, C, C++, C#, Rust, Go, SQL, etc.
	{ opening: '/*', closing: '*/' },
	// HTML, XML
	{ opening: '<!--', closing: '-->' },
	// JSX, TSX
	{ opening: '{/*', closing: '*/}' },
	{ opening: '{ /*', closing: '*/ }' },
	// Pascal, ML, F#, etc.
	{ opening: '(*', closing: '*)' },
	// Lua
	{ opening: '--[[', closing: ']]' },
]

const multiLineCommentOpeningRegex = createCommentDelimiterRegExp(multiLineCommentSyntaxes, 'opening')
const multiLineCommentClosingRegex = createCommentDelimiterRegExp(multiLineCommentSyntaxes, 'closing')

/**
 * Attempts to find and parse a multi-line comment that the given annotation tag is located in.
 *
 * See {@link parseParentComment} for more information.
 */
export function parseMultiLineParentComment(options: ParseParentCommentOptions): AnnotationComment | undefined {
	const { codeLines, tag } = options

	const tagLineIndex = tag.range.start.line
	const tagLine = codeLines[tagLineIndex]
	const tagStartColumn = tag.range.start.column ?? 0
	const tagEndColumn = tag.range.end.column ?? tagLine.length

	const commentSyntaxMatches: Partial<MultiLineCommentSyntaxMatch>[] = Array.from({ length: multiLineCommentSyntaxes.length }, () => ({}))
	let scannedForClosings = false

	// Check for a matching pair of beginning and ending multi-line comment syntaxes around the tag
	// by first walking backwards from the tag to find potential opening sequences
	// and then walking forwards to find matching closing sequences
	for (let openingLineIndex = tagLineIndex; openingLineIndex >= 0; openingLineIndex--) {
		if (
			findCommentSyntaxMatches({
				type: 'opening',
				commentSyntaxMatches,
				codeLines,
				lineIndex: openingLineIndex,
				endColumn: openingLineIndex === tagLineIndex ? tagStartColumn : undefined,
			})
		) {
			// If we have a matching opening/closing pair now, return it
			const comment = getCommentFromMatchingSyntaxPair({
				codeLines,
				tag,
				commentSyntaxMatches,
			})
			if (comment) return comment

			// Otherwise, walk forwards once to find all possible closing sequences,
			// stopping early if a matching pair is found
			if (!scannedForClosings) {
				scannedForClosings = true
				let foundAnyClosings = false
				for (let closingLineIndex = tagLineIndex; closingLineIndex < codeLines.length; closingLineIndex++) {
					if (
						findCommentSyntaxMatches({
							type: 'closing',
							commentSyntaxMatches,
							codeLines,
							lineIndex: closingLineIndex,
							startColumn: closingLineIndex === tagLineIndex ? tagEndColumn : undefined,
						})
					) {
						foundAnyClosings = true
						// If we have a matching opening/closing pair now, return it
						const comment = getCommentFromMatchingSyntaxPair({
							codeLines,
							tag,
							commentSyntaxMatches,
						})
						if (comment) return comment
					}
				}
				// If we didn't find any closing sequences, there cannot be a matching pair
				if (!foundAnyClosings) return undefined
			}
		}
	}

	return undefined
}

/**
 * Searches the given line for any multi-line comment syntax opening or closing sequences,
 * and updates the `commentSyntaxMatches` array accordingly.
 *
 * If any matches are found, checks the `commentSyntaxMatches` array for the matched syntax
 * entries and adds the new opening or closing range in case it was undefined before.
 * Matches are ordered to ensure the ones closest to the tag are processed first.
 *
 * Also validates the requirements of all syntaxes for the given line and sets the `invalid` flag
 * if any requirements were not met (e.g. the `continuationLineStart` syntax was not found).
 *
 * Returns `true` if there were new matches, or `false` otherwise.
 */
function findCommentSyntaxMatches(options: {
	type: 'opening' | 'closing'
	commentSyntaxMatches: Partial<MultiLineCommentSyntaxMatch>[]
	codeLines: string[]
	lineIndex: number
	startColumn?: number | undefined
	endColumn?: number | undefined
}): boolean {
	const { type, commentSyntaxMatches, codeLines, lineIndex, startColumn = 0, endColumn } = options
	const line = codeLines[lineIndex]

	// Look for opening/closing sequences in the given line
	const regex = type === 'opening' ? multiLineCommentOpeningRegex : multiLineCommentClosingRegex
	const sequences = findAllCommentDelimiters(regex, line, startColumn, endColumn)
	let foundNewMatches = false
	if (sequences.length) {
		// If we're looking for opening sequences, we need to reverse the matches
		// to ensure we process the ones closest to the tag first
		if (type === 'opening') sequences.reverse()

		// Now go through the matches and update the `commentSyntaxMatches` array if needed
		const delimiterProp = type === 'opening' ? 'openingRange' : 'closingRange'
		const whitespaceProp = type === 'opening' ? 'openingRangeWithWhitespace' : 'closingRangeWithWhitespace'
		sequences.forEach((sequence) => {
			commentSyntaxMatches.forEach((match, index) => {
				const syntax = multiLineCommentSyntaxes[index]
				// Skip matches that are invalid or already have defined ranges
				if (match.invalid || match[delimiterProp]) return
				// Skip matches where the respective syntax differs from the current sequence
				if (syntax[type] !== sequence.delimiter) return
				// Otherwise, set the ranges and mark the array as updated
				match[delimiterProp] = createRange({
					line,
					lineIndex,
					startColumn: sequence.index,
					endColumn: sequence.index + sequence.delimiter.length,
				})
				match[whitespaceProp] = createRange({
					line,
					lineIndex,
					startColumn: sequence.index - sequence.leadingWhitespace.length,
					endColumn: sequence.index + sequence.delimiter.length + sequence.trailingWhitespace.length,
				})
				foundNewMatches = true
			})
		})
	}

	// Validate all syntax requirements for the given line
	commentSyntaxMatches.forEach((match, index) => {
		const syntax = multiLineCommentSyntaxes[index]
		// If the current syntax has a continuation line start requirement,
		// validate it on non-opening and non-closing lines
		if (
			!match.invalid &&
			syntax.continuationLineStart &&
			// Only check the requirement on non-opening and non-closing lines
			lineIndex !== match.openingRange?.start.line &&
			lineIndex !== match.closingRange?.start.line &&
			// If the line doesn't match the continuation syntax, mark the syntax match as invalid
			!line.match(syntax.continuationLineStart)
		) {
			match.invalid = true
		}
		// If we're looking for an opening sequence and we're on the tag line,
		// validate that there is no content (except whitespace) before the tag
		if (
			!match.invalid &&
			type === 'opening' &&
			// Only check the tag line (which is the one with `endColumn` defined)
			endColumn !== undefined
		) {
			// Get content between the opening sequence (if found on this line) and the tag
			const openingEndColumn = match.openingRangeWithWhitespace?.end.line === lineIndex ? match.openingRangeWithWhitespace?.end.column : undefined
			let contentBeforeTag = line.slice(openingEndColumn, endColumn)
			// Strip the continuation line start syntax if it's present
			if (!openingEndColumn && syntax.continuationLineStart) {
				contentBeforeTag = contentBeforeTag.replace(syntax.continuationLineStart, '')
			}
			// If there is non-whitespace content before the tag, mark the syntax match as invalid
			if (contentBeforeTag.trim()) match.invalid = true
		}
	})

	return foundNewMatches
}

/**
 * Checks the `commentSyntaxMatches` array for matching pairs of opening and closing
 * multi-line comment syntaxes. If any pairs are found, determines the innermost one
 * and returns the corresponding comment.
 */
function getCommentFromMatchingSyntaxPair(options: {
	codeLines: string[]
	tag: AnnotationTag
	commentSyntaxMatches: Partial<MultiLineCommentSyntaxMatch>[]
}): AnnotationComment | undefined {
	const { codeLines, tag, commentSyntaxMatches } = options

	const bestMatchIndex = commentSyntaxMatches.reduce((previousBestIndex, match, index) => {
		// If the new match isn't a valid pair (yet?), skip it
		if (!isValidFullMatch(match)) return previousBestIndex

		// If we don't have a previous best pair yet, use the new match
		if (previousBestIndex === -1) return index

		const previousBestMatch = commentSyntaxMatches[previousBestIndex] as MultiLineCommentSyntaxMatch

		// Check if the new match is a better pair than the previous one
		if (
			// It's better if its opening sequence ends after the previous one,
			compareRanges(previousBestMatch.openingRange, match.openingRange, 'end') > 0 ||
			// ...or if its closing sequence starts before the previous one
			compareRanges(previousBestMatch.closingRange, match.closingRange, 'start') < 0
		) {
			return index
		}

		return previousBestIndex
	}, -1)

	if (bestMatchIndex > -1) {
		// We found a matching opening/closing comment syntax pair,
		// so build the AnnotationComment object and return it
		const match = commentSyntaxMatches[bestMatchIndex] as MultiLineCommentSyntaxMatch
		const syntax = multiLineCommentSyntaxes[bestMatchIndex]
		const isOnSingleLine = match.openingRange.start.line === match.closingRange.end.line
		const isOnSingleLineBeforeCode = isOnSingleLine && match.closingRangeWithWhitespace.end.column
		const commentRange: SourceRange = {
			start: isOnSingleLineBeforeCode ? match.openingRange.start : match.openingRangeWithWhitespace.start,
			end: match.closingRangeWithWhitespace.end,
		}
		const innerRange: SourceRange = {
			start: match.openingRangeWithWhitespace.end,
			end: match.closingRangeWithWhitespace.start,
		}
		// If the opening sequence ends at a line boundary, adjust the inner range to exclude it
		if (!innerRange.start.column && !isOnSingleLine) {
			innerRange.start = { line: innerRange.start.line + 1 }
		}
		// If the closing sequence starts on a line boundary, adjust the inner range to exclude it
		if (!innerRange.end.column && !isOnSingleLine) {
			innerRange.end = { line: innerRange.end.line - 1 }
		}
		const contents: string[] = []
		const contentRanges: SourceRange[] = []

		for (let lineIndex = innerRange.start.line; lineIndex <= innerRange.end.line; lineIndex++) {
			const startColumn = lineIndex === tag.range.end.line ? tag.range.end.column : lineIndex === innerRange.start.line ? innerRange.start.column : undefined
			const endColumn = lineIndex === innerRange.end.line ? innerRange.end.column : undefined

			const lineContent = getTextContentInLine({
				codeLines,
				lineIndex,
				startColumn,
				endColumn,
				continuationLineStart: syntax.continuationLineStart,
			})
			if (lineIndex < tag.range.end.line) {
				// If the current comment line has content and is located before the annotation tag,
				// we need to reduce the comment range to exclude any non-annotation content
				// including the opening and closing comment syntaxes, so removing the annotation
				// later doesn't break the commment
				if (lineContent.content.length) {
					commentRange.start = { line: tag.range.start.line }
					commentRange.end = { ...innerRange.end }
				}
			} else if (lineIndex >= tag.range.end.line && lineContent.content === '---') {
				// We encountered a separator line after the annotation tag, so this is a mixed
				// comment with multiple pieces of content and we must limit the comment range
				// to the current annotation (however, we still include the separator line)
				commentRange.start = { line: tag.range.start.line }
				commentRange.end = { line: lineIndex }
				break
			} else if (lineIndex >= tag.range.end.line && lineContent.content.startsWith('[!')) {
				// We encountered the beginning of another annotation tag, so this is a mixed
				// comment with multiple pieces of content and we must limit the comment range
				// to the current annotation
				commentRange.start = { line: tag.range.start.line }
				commentRange.end = { line: lineIndex - 1 }
				break
			} else {
				contents.push(lineContent.content)
				contentRanges.push(lineContent.contentRange)
			}
		}

		// Remove empty lines from the beginning and end of the content arrays
		while (contents.length && !contents[0].length) {
			contents.shift()
			contentRanges.shift()
		}
		while (contents.length && !contents[contents.length - 1].length) {
			contents.pop()
			contentRanges.pop()
		}

		return {
			tag,
			contents,
			commentRange,
			contentRanges,
			targetRanges: [],
		}
	}
}

function createCommentDelimiterRegExp(syntaxes: MultiLineCommentSyntax[], delimiterType: 'opening' | 'closing') {
	const sequences = syntaxes.map((syntax) => escapeRegExp(syntax[delimiterType]))
	const uniqueSortedSequences = [...new Set(sequences)].sort((a, b) => b.length - a.length)
	return new RegExp(
		[
			// Either the beginning of the line or required whitespace (captured)
			'(?<=^|(\\s+))',
			// Any of the supported multi-line comment opening sequences (captured)
			`(${uniqueSortedSequences.join('|')})`,
			// Either the end of the line or required whitespace (captured)
			`(?=$|(\\s+))`,
		].join(''),
		'g'
	)
}

/**
 * Finds all matches of the given comment delimiter regular expression in the given line,
 * including partially overlapping matches. Returns an array of match objects that
 * each contain an index, the leading whitespace, the delimiter and the trailing whitespace.
 */
function findAllCommentDelimiters(regExp: RegExp, line: string, startColumn: number | undefined, endColumn: number | undefined) {
	const matches: { index: number; leadingWhitespace: string; delimiter: string; trailingWhitespace: string }[] = []
	let match: RegExpExecArray | null
	regExp.lastIndex = startColumn ?? 0
	while ((match = regExp.exec(line))) {
		const leadingWhitespace = match[1] ?? ''
		const delimiter = match[2] ?? ''
		const trailingWhitespace = match[3] ?? ''
		if (endColumn && match.index + delimiter.length > endColumn) break
		matches.push({
			index: match.index,
			leadingWhitespace,
			delimiter,
			trailingWhitespace,
		})
		regExp.lastIndex = match.index + 1
	}
	return matches
}

function isValidFullMatch(match: Partial<MultiLineCommentSyntaxMatch>): match is MultiLineCommentSyntaxMatch {
	// If the match is invalid or the opening/closing ranges are missing, it's not a full match
	if (match.invalid || !match.openingRange || !match.closingRange) return false

	// Validate multi-line comment rules
	// (Note: Columns are only set if they don't match the beginning or end of the line)
	const startsAndEndsOnSameLine = match.openingRange.start.line === match.closingRange.end.line
	const hasCodeBeforeStart = match.openingRangeWithWhitespace?.start.column !== undefined
	const hasCodeAfterEnd = match.closingRangeWithWhitespace?.end.column !== undefined

	// If the comment starts and ends on the same line, it must not be surrounded by code
	if (startsAndEndsOnSameLine && hasCodeBeforeStart && hasCodeAfterEnd) return false

	// If the comment spans multiple lines, the opening and closing line may not contain code
	if (!startsAndEndsOnSameLine && (hasCodeBeforeStart || hasCodeAfterEnd)) return false

	return true
}
