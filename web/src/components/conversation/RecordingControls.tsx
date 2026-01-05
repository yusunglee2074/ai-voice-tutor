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
          <div className="flex items-center justify-center gap-1.5 h-12 mb-8">
            {Array.from({ length: 7 }).map((_, i) => {
              const height = Math.max(
                24,
                Math.min(
                  48,
                  24 + Math.sin((i / 7) * Math.PI) * audioLevel * 100
                )
              )
              return (
                <div
                  key={i}
                  className="w-1.5 bg-violet-500 rounded-sm transition-all duration-75"
                  style={{ height: `${height}px` }}
                />
              )
            })}
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
