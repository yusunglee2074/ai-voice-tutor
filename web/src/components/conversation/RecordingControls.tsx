import type { SessionState } from './types'

interface RecordingControlsProps {
  isRecording: boolean
  state: SessionState
  audioLevel: number
  onStartRecording: () => Promise<void>
  onStopRecording: () => void
  onCancel: () => void
}

export function RecordingControls({
  isRecording,
  state,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onCancel,
}: RecordingControlsProps) {
  // Generate random variations for each bar to create more natural waveform
  const barHeights = Array.from({ length: 20 }).map((_, i) => {
    // Create a wave pattern with some randomness
    const baseHeight = Math.sin((i / 20) * Math.PI * 2) * 0.5 + 0.5
    const randomFactor = Math.sin(Date.now() / 200 + i) * 0.3 + 0.7
    const audioFactor = audioLevel * 2 // Amplify audio level for better visibility

    // Calculate height: minimum 20%, maximum 100%
    const height = Math.max(0.2, Math.min(1, baseHeight * randomFactor * audioFactor))
    return height * 100
  })

  return (
    <div className="px-6 py-6 flex flex-col items-center justify-center min-h-[160px]">
      {!isRecording ? (
        <button
          onClick={onStartRecording}
          disabled={state !== 'idle'}
          className={`w-[72px] h-[72px] rounded-full border-none text-white text-2xl flex items-center justify-center cursor-pointer shadow-[0_10px_15px_-3px_rgba(91,33,182,0.3)] transition-colors ${state !== 'idle'
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-violet-800 hover:bg-violet-900'
            }`}
        >
          {state === 'processing' ? '💬' : '🎤'}
        </button>
      ) : (
        <div className="w-full flex flex-col items-center">
          {/* Waveform Visualization */}
          <div className="flex items-center justify-center gap-1 h-16 mb-6">
            {barHeights.map((height, i) => (
              <div
                key={i}
                className="w-1 bg-violet-500 rounded-full transition-all duration-100 ease-out"
                style={{
                  height: `${height}%`,
                  opacity: 0.6 + (audioLevel * 0.4)
                }}
              />
            ))}
          </div>

          <div className="flex gap-4 w-full">
            <button
              onClick={onCancel}
              className="flex-1 p-3.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-base font-semibold cursor-pointer hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={onStopRecording}
              className="flex-1 p-3.5 rounded-xl border-none bg-violet-900 text-white text-base font-semibold cursor-pointer shadow-md hover:bg-violet-800"
            >
              답변 완료
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
