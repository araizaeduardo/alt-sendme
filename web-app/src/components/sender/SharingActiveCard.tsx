import { CheckCircle, Copy, Mail, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/react-i18next-compat'
import type {
	SharingControlsProps,
	TicketDisplayProps,
} from '../../types/sender'
import { TransferProgressBar } from '../common/TransferProgressBar'
import { StatusIndicator } from '../common/StatusIndicator'
import { Button } from '../ui/button'
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '../ui/alert-dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { toastManager } from '../ui/toast'

export function SharingActiveCard({
	selectedPath,
	pathType,
	ticket,
	copySuccess,
	transferProgress,
	isTransporting,
	isCompleted,
	isBroadcastMode,
	activeConnectionCount = 0,
	onCopyTicket,
	onStopSharing,
	onToggleBroadcast: _onToggleBroadcast,
}: SharingControlsProps) {
	const { t } = useTranslation()
	const onToggleBroadcast = () => {
		if (_onToggleBroadcast) {
			const isTurningOn = !isBroadcastMode
			_onToggleBroadcast()
			// Only show toast notification when turning broadcast mode ON, not for private sharing
			if (isTurningOn) {
				const toastId = crypto.randomUUID()
				toastManager.add({
					title: t('common:sender.broadcastMode.on.label'),
					id: toastId,
					description: t('common:sender.broadcastMode.on.description'),
					type: 'info',
					actionProps: {
						children: t('common:undo'),
						onClick: () => {
							_onToggleBroadcast?.()
							toastManager.close(toastId)
						},
					},
				})
				// Auto-close "You are broadcasting" notification after 1 seconds
				setTimeout(() => {
					toastManager.close(toastId)
				}, 1500)
			}
		}
	}

	const getStatusText = () => {
		if (isCompleted) return t('common:sender.transferCompleted')
		if (isTransporting) return t('common:sender.sharingInProgress')
		return t('common:sender.listeningForConnection')
	}

	const statusText = getStatusText()

	const [cumulativeBytesTransferred, setCumulativeBytesTransferred] =
		useState(0)
	const [transferStartTime, setTransferStartTime] = useState<number | null>(
		null
	)
	const previousBytesRef = useRef<number>(0)
	const maxBytesRef = useRef<number>(0)
	const isFolderTransfer = pathType === 'directory' && isTransporting

	useEffect(() => {
		if (isTransporting && pathType === 'directory') {
			setCumulativeBytesTransferred(0)
			setTransferStartTime(Date.now())
			previousBytesRef.current = 0
			maxBytesRef.current = 0
		}
	}, [isTransporting, pathType])

	useEffect(() => {
		if (
			isFolderTransfer &&
			typeof transferProgress?.bytesTransferred !== 'undefined'
		) {
			const currentBytes = transferProgress.bytesTransferred
			const previousBytes = previousBytesRef.current
			const maxBytes = maxBytesRef.current

			if (currentBytes > maxBytes) {
				maxBytesRef.current = currentBytes
			}

			if (
				previousBytes > 0 &&
				currentBytes < previousBytes * 0.5 &&
				maxBytes > 0
			) {
				setCumulativeBytesTransferred((prev) => prev + maxBytes)
				maxBytesRef.current = currentBytes
				previousBytesRef.current = currentBytes
			} else if (currentBytes === 0 && previousBytes > 0 && maxBytes > 0) {
				setCumulativeBytesTransferred((prev) => prev + maxBytes)
				maxBytesRef.current = 0
				previousBytesRef.current = 0
			} else if (currentBytes > previousBytes) {
				previousBytesRef.current = currentBytes
			} else if (
				currentBytes < previousBytes &&
				currentBytes >= previousBytes * 0.5
			) {
				previousBytesRef.current = currentBytes
			}
		}
	}, [isFolderTransfer, transferProgress?.bytesTransferred])

	const totalTransferredBytes =
		isFolderTransfer && transferProgress
			? cumulativeBytesTransferred + transferProgress.bytesTransferred
			: (transferProgress?.bytesTransferred ?? 0)

	const [calculatedSpeed, setCalculatedSpeed] = useState(0)

	useEffect(() => {
		if (isFolderTransfer && transferProgress && transferStartTime) {
			const updateSpeed = () => {
				const elapsed = (Date.now() - transferStartTime) / 1000.0
				const speed = elapsed > 0 ? totalTransferredBytes / elapsed : 0
				setCalculatedSpeed(speed)
			}

			updateSpeed()
			const interval = setInterval(updateSpeed, 500)
			return () => clearInterval(interval)
		} else if (transferProgress) {
			setCalculatedSpeed(transferProgress.speedBps)
		} else {
			setCalculatedSpeed(0)
		}
	}, [
		isFolderTransfer,
		transferProgress,
		transferStartTime,
		totalTransferredBytes,
	])

	// Calculate percentage and create progress object for folders
	const folderProgress =
		isFolderTransfer && transferProgress
			? {
					bytesTransferred: totalTransferredBytes,
					totalBytes: transferProgress.totalBytes,
					speedBps: calculatedSpeed,
					percentage:
						transferProgress.totalBytes > 0
							? (totalTransferredBytes / transferProgress.totalBytes) * 100
							: 0,
				}
			: null

	// Default progress object when transferProgress is not yet available
	const defaultProgress = {
		bytesTransferred: 0,
		totalBytes: 0,
		speedBps: 0,
		percentage: 0,
	}

	// Determine which progress object to use
	const progressToDisplay = isTransporting
		? folderProgress || transferProgress || defaultProgress
		: null

	return (
		<div className="space-y-4">
			<div className="p-4 rounded-lg absolute top-0 left-0">
				<p className="text-xs mb-4 max-w-120 truncate">
					<strong className="mr-1">{t('common:sender.fileLabel')}</strong>{' '}
					{selectedPath?.split('/').pop()}
				</p>

				<StatusIndicator
					isCompleted={isCompleted}
					isTransporting={isTransporting}
					statusText={statusText}
					activeConnectionCount={activeConnectionCount}
					isBroadcastMode={isBroadcastMode}
				/>
			</div>

			<p className="text-xs text-center">{t('common:sender.keepAppOpen')}</p>

			{!isTransporting && ticket && (
				<TicketDisplay
					ticket={ticket}
					copySuccess={copySuccess}
					onCopyTicket={onCopyTicket}
					isBroadcastMode={isBroadcastMode}
					onToggleBroadcast={onToggleBroadcast}
				/>
			)}

			{isTransporting && progressToDisplay && (
				<TransferProgressBar progress={progressToDisplay} />
			)}

			<Button
				size="icon-lg"
				type="button"
				onClick={onStopSharing}
				variant="destructive-outline"
				className="absolute top-0 right-6 rounded-full font-medium transition-colors not-disabled:not-active:not-data-pressed:before:shadow-none dark:not-disabled:before:shadow-none dark:not-disabled:not-active:not-data-pressed:before:shadow-none"
				aria-label="Stop sharing"
			>
				<Square className="w-4 h-4" fill="currentColor" />
			</Button>
		</div>
	)
}

export function TicketDisplay({
	ticket,
	copySuccess,
	onCopyTicket,
	isBroadcastMode,
	onToggleBroadcast,
}: TicketDisplayProps & {
	isBroadcastMode?: boolean
	onToggleBroadcast?: () => void
}) {
	const { t } = useTranslation()
	const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
	const [emailTo, setEmailTo] = useState('')
	const [emailError, setEmailError] = useState<string | null>(null)

	const isValidEmail = (value: string) => {
		const v = value.trim()
		if (!v) return false
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
	}

	const handleEmailClick = async () => {
		await onCopyTicket()
		setEmailError(null)
		setIsEmailDialogOpen(true)
	}

	const handleSendEmail = () => {
		const to = emailTo.trim()
		if (!isValidEmail(to)) {
			setEmailError('Please enter a valid email address')
			return
		}

		const subject = encodeURIComponent('AltSendme ticket')
		const body = encodeURIComponent(`Here is my AltSendme ticket:\n\n${ticket}\n`)
		const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`

		try {
			if (typeof IS_TAURI !== 'undefined' && IS_TAURI) {
				import('@tauri-apps/plugin-opener')
					.then((opener: any) => {
						const openFn = opener?.openUrl ?? opener?.open
						if (typeof openFn === 'function') {
							return openFn(mailtoUrl)
						}
						throw new Error('Tauri opener is not available')
					})
					.catch((error: unknown) => {
						console.error('Failed to open mail client:', error)
						toastManager.add({
							id: crypto.randomUUID(),
							title: 'Failed to open email client',
							description: String(error),
							type: 'error',
						})
					})
			} else {
				window.location.href = mailtoUrl
			}
		} finally {
			setIsEmailDialogOpen(false)
		}
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<p
					className="block text-sm font-medium"
					style={{ color: 'var(--app-main-view-fg)' }}
				>
					{t('common:sender.shareThisTicket')}
				</p>
				{isBroadcastMode !== undefined && onToggleBroadcast && (
					<div className="flex items-start gap-2">
						<Label htmlFor={'broadcast-toggle'}>
							{t('common:sender.broadcastMode.index')}
						</Label>
						<Switch
							checked={isBroadcastMode}
							onCheckedChange={onToggleBroadcast}
						/>
					</div>
				)}
			</div>
			<InputGroup>
				<InputGroupInput type="text" value={ticket} readOnly />
				<InputGroupAddon align="inline-end">
					<div className="flex items-center gap-1">
						<Button
							type="button"
							size="icon-xs"
							onClick={handleEmailClick}
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.1)',
								border: '1px solid rgba(255, 255, 255, 0.2)',
								color: 'var(--app-main-view-fg)',
							}}
							title="Send by email"
						>
							<Mail className="h-4 w-4" />
						</Button>
						<Button
							type="button"
							size="icon-xs"
							onClick={onCopyTicket}
							style={{
								backgroundColor: copySuccess
									? 'var(--app-primary)'
									: 'rgba(255, 255, 255, 0.1)',
								border: '1px solid rgba(255, 255, 255, 0.2)',
								color: copySuccess
									? 'var(--app-primary-fg)'
									: 'var(--app-main-view-fg)',
							}}
							title={t('common:sender.copyToClipboard')}
						>
							{copySuccess ? (
								<CheckCircle className="h-4 w-4" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>
				</InputGroupAddon>
			</InputGroup>
			<p className="text-xs text-muted-foreground">
				{t('common:sender.sendThisTicket')}
			</p>

			<AlertDialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Send ticket by email</AlertDialogTitle>
						<AlertDialogDescription>
							Enter the email address you want to send the ticket to.
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="px-6 pb-2">
						<Label htmlFor="email-to" className="text-sm">
							Email
						</Label>
						<div className="mt-2">
							<Input
								id="email-to"
								type="email"
								value={emailTo}
								onChange={(e) => {
									setEmailTo(e.target.value)
									if (emailError) setEmailError(null)
								}}
								placeholder="name@example.com"
								autoFocus
							/>
						</div>
						{emailError && (
							<p className="mt-2 text-xs text-destructive">{emailError}</p>
						)}
					</div>

					<AlertDialogFooter>
						<AlertDialogClose
							render={<Button variant="secondary" size="sm">Cancel</Button>}
							onClick={() => setIsEmailDialogOpen(false)}
						/>
						<Button size="sm" onClick={handleSendEmail}>
							Send
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
