import { AnnotationTag } from '../core/types'

type ParseAnnotationTagsOptions = {
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

export function parseAnnotationTags(options: ParseAnnotationTagsOptions): AnnotationTag[] {
	const { codeLines } = options
	const annotationTags: AnnotationTag[] = []

	codeLines.forEach((line, lineIndex) => {
		const matches = [...line.matchAll(annotationTagRegex)]
		matches.forEach((match) => {
			const [, name, targetSearchQuery, relativeTargetRange] = match
			const rawTag = match[0]
			const startColIndex = match.index
			const endColIndex = startColIndex + rawTag.length
			annotationTags.push({
				name,
				targetSearchQuery,
				relativeTargetRange: relativeTargetRange !== undefined ? Number(relativeTargetRange) : undefined,
				rawTag,
				location: {
					startLineIndex: lineIndex,
					endLineIndex: lineIndex,
					startColIndex,
					endColIndex,
				},
			})
		})
	})

	return annotationTags
}
