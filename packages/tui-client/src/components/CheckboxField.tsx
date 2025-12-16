import { Box, Text } from 'ink'

interface CheckboxOption {
	value: string
	label: string
}

interface CheckboxFieldProps {
	label: string
	options: CheckboxOption[]
	selected: string[]
	onChange: (selected: string[]) => void
	isFocused: boolean
	focusedIndex: number
	error?: string | null
}

export function CheckboxField({
	label,
	options,
	selected,
	onChange,
	isFocused,
	focusedIndex,
	error,
}: CheckboxFieldProps) {
	const toggle = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value))
		} else {
			onChange([...selected, value])
		}
	}

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
				{isFocused ? '> ' : '  '}
				{label}:
			</Text>
			<Box flexWrap="wrap" paddingLeft={2} marginTop={0}>
				{options.map((option, index) => {
					const isChecked = selected.includes(option.value)
					const isHighlighted = isFocused && index === focusedIndex

					return (
						<Box key={option.value} marginRight={2}>
							<Text
								inverse={isHighlighted}
								color={isChecked ? 'green' : 'gray'}
							>
								[{isChecked ? '\u2713' : ' '}] {option.label}
							</Text>
						</Box>
					)
				})}
			</Box>
			{error && (
				<Box marginLeft={2}>
					<Text color="red">{error}</Text>
				</Box>
			)}
		</Box>
	)
}

// Helper to toggle selection when Space is pressed
export function toggleCheckbox(
	options: CheckboxOption[],
	selected: string[],
	focusedIndex: number,
): string[] {
	const option = options[focusedIndex]
	if (!option) return selected

	if (selected.includes(option.value)) {
		return selected.filter((v) => v !== option.value)
	}
	return [...selected, option.value]
}
