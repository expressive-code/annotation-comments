import { AnnotationTag } from '../core/types'
import { getEscapeSequenceRegExp } from '../internal/escaping'
import { createGlobalRegExp } from '../internal/regexps'

export type ParseAnnotationTagsOptions = {
	codeLines: string[]
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
				// Last alternative: Non-quoted query string
				[
					// It must not start with a digit, optionally preceded by a dash:
					'(?!-?\\d)',
					// It must contain at least one of the following parts:
					// - any character that is not a backslash, colon, or closing bracket
					// - a backslash followed by any character
					`(?:[^\\\\:\\]]|\\\\.)+?`,
				].join(''),
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
			'(-?\\d+)',
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

export function parseAnnotationTags(options: ParseAnnotationTagsOptions): AnnotationTag[] {
	const { codeLines } = options
	const annotationTags: AnnotationTag[] = []

	codeLines.forEach((line, lineIndex) => {
		const matches = [...line.matchAll(annotationTagRegex)]
		matches.forEach((match) => {
			const [, name, rawTargetSearchQuery, relativeTargetRange] = match
			const rawTag = match[0]
			const startColIndex = match.index
			const endColIndex = startColIndex + rawTag.length
			const targetSearchQuery = parseTargetSearchQuery(rawTargetSearchQuery)
			annotationTags.push({
				name,
				targetSearchQuery,
				relativeTargetRange: relativeTargetRange !== undefined ? Number(relativeTargetRange) : undefined,
				rawTag,
				range: {
					start: { line: lineIndex, column: startColIndex },
					end: { line: lineIndex, column: endColIndex },
				},
			})
		})
	})

	return annotationTags
}
