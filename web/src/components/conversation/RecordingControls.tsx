import type { SessionState } from './types'

interface RecordingControlsProps {
  state: SessionState
  audioLevel: number
}

export function RecordingControls({
  state,
  audioLevel,
}: RecordingControlsProps) {
  // Generate waveform visualization
  const barHeights = Array.from({ length: 20 }).map((_, i) => {
    const baseHeight = Math.sin((i / 20) * Math.PI * 2) * 0.5 + 0.5
    const randomFactor = Math.sin(Date.now() / 200 + i) * 0.3 + 0.7
    const audioFactor = audioLevel * 2

    const height = Math.max(0.2, Math.min(1, baseHeight * randomFactor * audioFactor))
    return height * 100
  })

  // State display configuration
  const stateConfig = {
    disconnected: { icon: '🔌', text: '연결 끊김', color: 'text-gray-500' },
    listening: { icon: '🎤', text: '듣는 중...', color: 'text-green-600' },
    processing: { icon: '💭', text: '생각하는 중...', color: 'text-blue-600' },
    speaking: { icon: '🔊', text: '말하는 중...', color: 'text-purple-600' },
  }

  const config = stateConfig[state]

  return (
    <div className="px-6 py-6 flex flex-col items-center justify-center min-h-[160px]">
      {/* Waveform Visualization */}
      <div className="flex items-center justify-center gap-1 h-16 mb-4">
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

      {/* State Indicator */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{config.icon}</span>
        <span className={`text-lg font-semibold ${config.color}`}>
          {config.text}
        </span>
      </div>
    </div>
  )
}
