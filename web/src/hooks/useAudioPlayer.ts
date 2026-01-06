import { useEffect, useRef, useCallback, useState } from 'react'

interface AudioPlayerHookResult {
  playAudio: (audioBase64: string) => void
  stop: () => void
  isPlaying: boolean
}

export function useAudioPlayer(): AudioPlayerHookResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const scheduledTimeRef = useRef<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const currentGenerationRef = useRef(0)

  // Jitter buffer settings
  const BUFFER_DELAY_MS = 150 // Add 150ms delay to absorb network jitter

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

      // Schedule playback with jitter buffer
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)

      const currentTime = audioContextRef.current.currentTime
      const bufferDelay = BUFFER_DELAY_MS / 1000

      // If this is the first chunk or we've fallen behind, reset scheduling with buffer delay
      if (scheduledTimeRef.current <= currentTime) {
        scheduledTimeRef.current = currentTime + bufferDelay
      }

      const startTime = scheduledTimeRef.current

      // Track active source
      activeSourcesRef.current.add(source)
      setIsPlaying(true)

      // Remove from active sources when finished
      source.onended = () => {
        activeSourcesRef.current.delete(source)
        if (activeSourcesRef.current.size === 0) {
          setIsPlaying(false)
          console.log('[AudioPlayer] All audio finished playing')
        }
      }

      source.start(startTime)
      scheduledTimeRef.current = startTime + audioBuffer.duration

      console.log('[AudioPlayer] Scheduled chunk, duration:', audioBuffer.duration.toFixed(3), 's, at:', startTime.toFixed(3), 'current:', currentTime.toFixed(3))
    } catch (err) {
      console.error('[AudioPlayer] Error playing audio:', err)
    }
  }

  const handleTTSAudio = (audioBase64: string, generation: number) => {
    // Check if this is a new TTS generation
    if (generation > currentGenerationRef.current) {
      console.log('[AudioPlayer] New TTS generation:', generation)
      currentGenerationRef.current = generation

      // Reset scheduling for new generation
      if (audioContextRef.current) {
        scheduledTimeRef.current = 0
      }
    }

    // Play audio chunk directly - jitter buffer handles timing
    playAudioRef.current(audioBase64)
  }

  // Use ref to avoid stale closure in event listener
  const playAudioRef = useRef(playAudioImpl)
  playAudioRef.current = playAudioImpl

  useEffect(() => {
    // Initialize AudioContext
    audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    scheduledTimeRef.current = 0
    console.log('[AudioPlayer] AudioContext initialized')

    // Listen for TTS audio events from WebSocket
    const handleTTSAudioEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ audio: string; generation: number }>
      handleTTSAudio(customEvent.detail.audio, customEvent.detail.generation)
    }

    window.addEventListener('tts_audio', handleTTSAudioEvent)

    return () => {
      window.removeEventListener('tts_audio', handleTTSAudioEvent)
      audioContextRef.current?.close()
    }
  }, [])

  const playAudio = useCallback((audioBase64: string) => {
    playAudioRef.current(audioBase64)
  }, [])

  const stop = useCallback(() => {
    console.log('[AudioPlayer] Stopping all audio playback')

    // Stop all active sources
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop()
      } catch (e) {
        // Source may have already stopped
      }
    })
    activeSourcesRef.current.clear()

    // Reset scheduling
    scheduledTimeRef.current = 0

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    }

    setIsPlaying(false)
  }, [])

  return {
    playAudio,
    stop,
    isPlaying,
  }
}
