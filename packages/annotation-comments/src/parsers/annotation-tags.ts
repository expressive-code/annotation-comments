import type { AnnotationTag } from '../core/types'
import { coerceError } from '../internal/errors'
import { getEscapeSequenceRegExp } from '../internal/escaping'
import { createGlobalRegExp } from '../internal/regexps'

export type ParseAnnotationTagsOptions = {
	codeLines: string[]
}

export type ParseAnnotationTagsResult = {
	annotationTags: AnnotationTag[]
	errorMessages: string[]
}

const annotationTagRegex = new RegExp(
	[
		// Opening sequence
		'\\[!',
		// Optional `code ` prefix
		'(?:code )?',
		// Annotation name (captured)
		// that must not contain a colon, closing bracket or whitespace
		'([^:\\]\\s]+)',
		// Optional target search query
		[
			// Start of non-capturing optional group
			'(?:',
			// Search query opening character
			':',
			// Start of search query capture group
			'(',
			// List of alternative query types
			[
				// Three different delimited query types:
				// double-quoted, single-quoted, regular expression
				...[`"`, `'`, `/`].map((delimiter) =>
					[
						// Value start delimiter
						delimiter,
						// Value string (captured, can be an empty string),
						// consisting of any of the following parts:
						// - any character that is not a backslash
						// - a backslash followed by any character
						`(?:[^\\\\]|\\\\.)*?`,
						// Value end delimiter
						delimiter,
					].join('')
				),
			].join('|'),
			// End of capture group
			')',
			// End of non-capturing optional group
			')?',
		],
		// Optional relative target range
		[
			// Start of non-capturing optional group
			'(?:',
			// Colon separator
			':',
			// Relative target range (captured)
			'(',
			[
				// Numeric range, defined by a positive or negative number
				'-?\\d+',
				// Anything else that is not a closing bracket
				'[^\\]]+',
			].join('|'),
			// End of relative target range capture group
			')',
			// End of non-capturing optional group
			')?',
		],
		// Closing character
		'\\]',
	]
		.flat()
		.join(''),
	'g'
)

const plainValueEscapeSequence = getEscapeSequenceRegExp('\\', ':', ']')
const delimitedValueEscapeSequences = new Map<string, RegExp>([
	['"', getEscapeSequenceRegExp('\\', '"')],
	["'", getEscapeSequenceRegExp('\\', "'")],
	['/', getEscapeSequenceRegExp('/')],
])

function parseTargetSearchQuery(rawTargetSearchQuery: string | undefined): string | RegExp | undefined {
	if (rawTargetSearchQuery === undefined || rawTargetSearchQuery === '') return
	const delimiter = rawTargetSearchQuery[0]
	const delimitedValueEscapeSequence = delimitedValueEscapeSequences.get(delimiter)
	const escapeSequenceRegExp = delimitedValueEscapeSequence || plainValueEscapeSequence
	const undelimitedQuery = delimitedValueEscapeSequence === undefined ? rawTargetSearchQuery : rawTargetSearchQuery.slice(1, -1)
	const unescapedQuery = undelimitedQuery.replace(escapeSequenceRegExp, '$1')

	// If the delimiter was a slash, try to parse the value as a regular expression and return it
	if (delimiter === '/') {
		return createGlobalRegExp(unescapedQuery)
	}

	// Otherwise, return the unescaped query as a string
	return unescapedQuery
}

function parseRelativeTargetRange(rawInput: string | undefined): AnnotationTag['relativeTargetRange'] {
	if (rawInput === undefined) return undefined
	if (rawInput === 'start' || rawInput === 'begin') return 'start'
	if (rawInput === 'end') return 'end'
	return Number(rawInput)
}

export function parseAnnotationTags(options: ParseAnnotationTagsOptions): ParseAnnotationTagsResult {
	const { codeLines } = options
	const annotationTags: AnnotationTag[] = []
	const errorMessages: string[] = []

	codeLines.forEach((line, lineIndex) => {
		const matches = [...line.matchAll(annotationTagRegex)]
		matches.forEach((match) => {
			try {
				const [, name, rawTargetSearchQuery, rawRelativeTargetRange] = match
				const rawTag = match[0]
				const startColIndex = match.index
				const endColIndex = startColIndex + rawTag.length

				const targetSearchQuery = parseTargetSearchQuery(rawTargetSearchQuery)
				const relativeTargetRange = parseRelativeTargetRange(rawRelativeTargetRange)
				if (Number.isNaN(relativeTargetRange)) {
					if (targetSearchQuery === undefined)
						throw new Error(`Unexpected text "${rawRelativeTargetRange}" in tag. If you intended to specify a search query, it must be enclosed in quotes.`)
					throw new Error(`Unexpected text "${rawRelativeTargetRange}" in relative target range. Expected a number or the keywords "start", "begin" or "end".`)
				}

				annotationTags.push({
					name,
					targetSearchQuery,
					relativeTargetRange,
					rawTag,
					range: {
						start: { line: lineIndex, column: startColIndex },
						end: { line: lineIndex, column: endColIndex },
					},
				})
			} catch (error) {
				const msg = coerceError(error).message
				errorMessages.push(`Failed to parse annotation tag in line ${lineIndex + 1}: ${msg}`)
			}
		})
	})

	return {
		annotationTags,
		errorMessages,
	}
}
