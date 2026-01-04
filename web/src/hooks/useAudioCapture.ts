import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioCaptureHookResult {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  error: string | null
  audioLevel: number
}

interface AudioCaptureHookProps {
  onAudioData: (audioData: ArrayBuffer) => void
}

export function useAudioCapture({ onAudioData }: AudioCaptureHookProps): AudioCaptureHookResult {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1) // Normalize to 0-1

    setAudioLevel(normalizedLevel)

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      })

      streamRef.current = stream

      // Create AudioContext
      const audioContext = new AudioContext({ sampleRate: 48000 })
      audioContextRef.current = audioContext

      // Load AudioWorklet processor
      await audioContext.audioWorklet.addModule('/audio-processor.js')

      // Create AudioWorklet node
      const workletNode = new AudioWorkletNode(audioContext, 'audio-downsampler-processor')
      workletNodeRef.current = workletNode

      // Create analyser for visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      // Handle messages from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          console.log('[AudioCapture] Sending audio data:', event.data.data.byteLength, 'bytes')
          onAudioData(event.data.data)
        }
      }

      // Connect audio pipeline
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      source.connect(workletNode)
      // Don't connect to destination to avoid feedback
      // workletNode.connect(audioContext.destination)

      setIsRecording(true)

      // Start audio level monitoring
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)

      console.log('[AudioCapture] Recording started')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording'
      setError(errorMessage)
      console.error('Error starting recording:', err)
    }
  }, [onAudioData, updateAudioLevel])

  const stopRecording = useCallback(() => {
    console.log('[AudioCapture] Stopping recording')

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Disconnect and close audio nodes
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsRecording(false)
    setAudioLevel(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    audioLevel,
  }
}
