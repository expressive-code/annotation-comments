import type { AnnotationComment, SourceRange } from '../../core/types'
import type { ParseParentCommentOptions } from '../parent-comment'
import { escapeRegExp } from '../../internal/escaping'
import { getTextContentInLine } from '../../internal/text-content'
import { createRange } from '../../internal/ranges'

const singleLineCommentSyntaxes: string[] = [
	// JS, TS, Java, C, C++, C#, F#, Rust, Go, etc.
	'//',
	// Python, Perl, Bash, PowerShell, etc.
	'#',
	// SQL, Lua, etc.
	'--',
]

const singleLineCommentRegex = new RegExp(
	[
		// Either the beginning of the line or required whitespace (captured)
		'(^|\\s+)',
		// Any of the supported single-line comment syntaxes (captured)
		`(${singleLineCommentSyntaxes.map((syntax) => escapeRegExp(syntax)).join('|')})`,
		// Required whitespace (captured)
		'(\\s+)',
	].join(''),
	'g'
)

/**
 * Attempts to find and parse a single-line comment that the given annotation tag is located in.
 *
 * See {@link parseParentComment} for more information.
 */
export function parseSingleLineParentComment(options: ParseParentCommentOptions): AnnotationComment | undefined {
	const { codeLines, tag } = options

	const tagLineIndex = tag.range.start.line
	const tagLine = codeLines[tagLineIndex]
	const tagEndColumn = tag.range.end.column ?? tagLine.length

	// Check the annotation tag line for known single-line comment syntaxes
	const singleLineCommentSyntaxMatches = [...tagLine.matchAll(singleLineCommentRegex)].map((match) => ({
		startColumn: match.index,
		endColumn: match.index + match[0].length,
		syntax: match[2],
	}))
	// If matches were found, check if any of them ends right before the annotation tag
	// (as required by the annotation comments syntax)
	const singleLineCommentSyntax = singleLineCommentSyntaxMatches.find((match) => match.endColumn === tag.range.start.column)
	if (singleLineCommentSyntax) {
		// We found a single-line annotation comment, so start collecting its details
		const commentRange = createRange({
			codeLines,
			start: { line: tagLineIndex },
			end: { line: tagLineIndex },
		})
		const contents: string[] = []
		const contentRanges: SourceRange[] = []
		// If there is code before the comment, remember the comment start column
		// to avoid deleting the entire line when removing the comment
		if (tagLine.slice(0, singleLineCommentSyntax.startColumn).trim() !== '') {
			commentRange.start.column = singleLineCommentSyntax.startColumn
		}
		// For common Shiki transformer syntax compatibility, support chaining multiple
		// single-line annotation comments on the same line
		const chainedSingleLineCommentSyntax = singleLineCommentSyntaxMatches.find(
			(match) =>
				// The new comment must start after the current tag...
				match.startColumn >= tagEndColumn &&
				// ...it must use the same single-line comment syntax...
				match.syntax == singleLineCommentSyntax.syntax &&
				// ...and it must be followed by another annotation tag opening sequence
				tagLine.slice(match.endColumn).startsWith('[!')
		)
		if (chainedSingleLineCommentSyntax) {
			commentRange.end.column = chainedSingleLineCommentSyntax.startColumn
		}
		// If there is any non-whitespace content between the end of the annotation tag
		// and the current end of the comment, add it to the contents and contentRanges arrays
		const tagLineContent = getTextContentInLine({ codeLines, lineIndex: tagLineIndex, startColumn: tagEndColumn, endColumn: commentRange.end.column })
		if (tagLineContent.content) {
			contents.push(tagLineContent.content)
			contentRanges.push(tagLineContent.contentRange)
		}
		// For supported annotation comments, allow expanding the comment end location
		// and annotation content to subsequent comment lines
		const allowMultiLineExpansion =
			// To allow expansion, the initial comment must start on its own line
			tagLine.slice(0, singleLineCommentSyntax.startColumn).trim() === '' &&
			// Chaining is not allowed
			!chainedSingleLineCommentSyntax &&
			// It doesn't make sense to expand annotation comments that don't support content
			tag.name !== 'ignore-tags'
		if (allowMultiLineExpansion) {
			for (let lineIndex = tagLineIndex + 1; lineIndex < codeLines.length; lineIndex++) {
				const line = codeLines[lineIndex]
				const commentStart = line.search(/\S/)
				// Stop if the line doesn't start with the same single-line comment syntax
				// plus at least one whitespace character or the end of the line
				const possibleContentStart = commentStart + singleLineCommentSyntax.syntax.length + 1
				const expectedCommentSyntaxPart = line.slice(commentStart, possibleContentStart)
				if (expectedCommentSyntaxPart.trimEnd() !== singleLineCommentSyntax.syntax) break
				// Extract the non-whitespace content of the line
				const lineContent = getTextContentInLine({ codeLines, lineIndex, startColumn: possibleContentStart })
				if (lineContent.content) {
					// Stop if the line has `---` as its only text content
					if (lineContent.content === '---') {
						// Make the line part of the comment, but don't add its content
						commentRange.end = { line: lineIndex }
						break
					}
					// Stop if the line starts with an annotation tag opening sequence `[!`
					if (lineContent.content.startsWith('[!')) break
					// Otherwise, add the content and expand the comment range
					// to cover the additional full line
					contents.push(lineContent.content)
					contentRanges.push(lineContent.contentRange)
					commentRange.end = { line: lineIndex }
				} else {
					// Comment lines without content are allowed, so an empty string to the content
					// and expand the comment range to cover the additional full line
					const column = Math.min(possibleContentStart, line.length)
					contents.push('')
					contentRanges.push(createRange({ codeLines, start: { line: lineIndex, column }, end: { line: lineIndex } }))
					commentRange.end = { line: lineIndex }
				}
			}
		}

		// For single-line comments, the annotation range is always equal to the comment range
		const annotationRange = createRange({ codeLines, start: commentRange.start, end: commentRange.end })

		return {
			tag,
			contents,
			commentRange,
			annotationRange,
			contentRanges,
			targetRanges: [],
		}
	}
}
