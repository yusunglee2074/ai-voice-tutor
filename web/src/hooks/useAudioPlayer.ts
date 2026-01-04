import { useEffect, useRef, useCallback } from 'react'

interface AudioPlayerHookResult {
  playAudio: (audioBase64: string) => void
  stop: () => void
}

export function useAudioPlayer(): AudioPlayerHookResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const scheduledTimeRef = useRef<number>(0)
  const audioQueueRef = useRef<AudioBuffer[]>([])

  useEffect(() => {
    // Initialize AudioContext
    audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    scheduledTimeRef.current = audioContextRef.current.currentTime

    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  const playAudio = useCallback((audioBase64: string) => {
    if (!audioContextRef.current) return

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Convert PCM Int16 to Float32 AudioBuffer
      const pcmData = new Int16Array(bytes.buffer)
      const audioBuffer = audioContextRef.current.createBuffer(
        1, // mono
        pcmData.length,
        24000 // sample rate
      )

      const channelData = audioBuffer.getChannelData(0)
      for (let i = 0; i < pcmData.length; i++) {
        // Convert Int16 to Float32 [-1, 1]
        channelData[i] = pcmData[i] / (pcmData[i] < 0 ? 0x8000 : 0x7FFF)
      }

      // Schedule playback
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)

      const currentTime = audioContextRef.current.currentTime
      const startTime = Math.max(currentTime, scheduledTimeRef.current)

      source.start(startTime)
      scheduledTimeRef.current = startTime + audioBuffer.duration

      audioQueueRef.current.push(audioBuffer)
    } catch (err) {
      console.error('Error playing audio:', err)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      scheduledTimeRef.current = audioContextRef.current.currentTime
      audioQueueRef.current = []
    }
  }, [])

  return {
    playAudio,
    stop,
  }
}
