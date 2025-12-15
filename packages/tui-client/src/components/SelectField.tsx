import { Box, Text, useInput } from 'ink'

interface SelectOption {
	value: string
	label: string
}

interface SelectFieldProps {
	label: string
	value: string
	options: SelectOption[]
	onChange: (value: string) => void
	onSubmit?: () => void
	isFocused: boolean
}

export function SelectField({ label, value, options, onChange, onSubmit, isFocused }: SelectFieldProps) {
	const currentIndex = options.findIndex((opt) => opt.value === value)
	const currentLabel = options.find((opt) => opt.value === value)?.label ?? value

	useInput(
		(input, key) => {
			if (!isFocused) return

			if (key.leftArrow || input === 'h') {
				const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
				onChange(options[prevIndex]!.value)
			} else if (key.rightArrow || input === 'l') {
				const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
				onChange(options[nextIndex]!.value)
			} else if (key.return) {
				onSubmit?.()
			}
		},
		{ isActive: isFocused }
	)

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
					{isFocused ? '> ' : '  '}
					{label}:{' '}
				</Text>
				{isFocused ? (
					<Box>
						<Text color="gray">&lt; </Text>
						<Text color="cyan" bold>
							{currentLabel}
						</Text>
						<Text color="gray"> &gt;</Text>
					</Box>
				) : (
					<Text>{currentLabel}</Text>
				)}
			</Box>
			{isFocused && (
				<Box marginLeft={2}>
					<Text dimColor>Use left/right arrows to change</Text>
				</Box>
			)}
		</Box>
	)
}
