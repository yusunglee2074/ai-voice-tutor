import { useEffect, useRef, useCallback } from 'react'

interface AudioPlayerHookResult {
  playAudio: (audioBase64: string) => void
  stop: () => void
}

export function useAudioPlayer(): AudioPlayerHookResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const scheduledTimeRef = useRef<number>(0)
  const audioQueueRef = useRef<AudioBuffer[]>([])

  const playAudioImpl = (audioBase64: string) => {
    if (!audioContextRef.current) {
      console.warn('[AudioPlayer] AudioContext not initialized')
      return
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }

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
      console.log('[AudioPlayer] Playing audio chunk, duration:', audioBuffer.duration.toFixed(3), 's')
    } catch (err) {
      console.error('[AudioPlayer] Error playing audio:', err)
    }
  }

  // Use ref to avoid stale closure in event listener
  const playAudioRef = useRef(playAudioImpl)
  playAudioRef.current = playAudioImpl

  useEffect(() => {
    // Initialize AudioContext
    audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    scheduledTimeRef.current = audioContextRef.current.currentTime
    console.log('[AudioPlayer] AudioContext initialized')

    // Listen for TTS audio events from WebSocket
    const handleTTSAudio = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      console.log('[AudioPlayer] Received tts_audio event')
      playAudioRef.current(customEvent.detail)
    }

    window.addEventListener('tts_audio', handleTTSAudio)

    return () => {
      window.removeEventListener('tts_audio', handleTTSAudio)
      audioContextRef.current?.close()
    }
  }, [])

  const playAudio = useCallback((audioBase64: string) => {
    playAudioRef.current(audioBase64)
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
