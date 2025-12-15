import { Box, Text } from 'ink'

export function Footer() {
	return (
		<Box borderStyle="single" paddingX={1}>
			<Text dimColor>
				j/k: navigate | a: add | e: edit | d: delete | r: refresh | ?: help | q: quit
			</Text>
		</Box>
	)
}
