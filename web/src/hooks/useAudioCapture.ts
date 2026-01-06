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
  onSilenceDetected?: () => void
  onSpeechDetected?: () => void
  silenceTimeoutMs?: number
}

export function useAudioCapture({
  onAudioData,
  onSilenceDetected,
  onSpeechDetected,
  silenceTimeoutMs = 1000
}: AudioCaptureHookProps): AudioCaptureHookResult {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const lastAudioTimestampRef = useRef<number>(0)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onSilenceDetectedRef = useRef(onSilenceDetected)
  const onSpeechDetectedRef = useRef(onSpeechDetected)

  // Keep callback refs fresh
  useEffect(() => {
    onSilenceDetectedRef.current = onSilenceDetected
    onSpeechDetectedRef.current = onSpeechDetected
  }, [onSilenceDetected, onSpeechDetected])

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(dataArray)

    // Calculate RMS (Root Mean Square) for more accurate volume
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }
    const rms = Math.sqrt(sum / dataArray.length)
    const normalizedLevel = Math.min(rms * 3, 1) // Amplify and normalize to 0-1

    setAudioLevel(normalizedLevel)

    // Use ref to avoid stale closure - state would capture old value
    if (isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [])

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
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      // Handle messages from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          const audioBuffer = event.data.data as ArrayBuffer
          const samples = new Int16Array(audioBuffer)

          // Check if audio is silent (max amplitude below threshold)
          // 16-bit PCM range: -32768 to 32767
          const SILENCE_THRESHOLD = 200 // For silence detection (not used currently)
          const SPEECH_THRESHOLD = 500 // High threshold for barge-in detection
          let maxLevel = 0
          for (let i = 0; i < samples.length; i++) {
            const absValue = Math.abs(samples[i])
            if (absValue > maxLevel) {
              maxLevel = absValue
            }
          }

          // Log audio levels for debugging (only when above threshold)
          if (maxLevel > SPEECH_THRESHOLD) {
            console.log('[AudioCapture] High audio level detected:', maxLevel, 'threshold:', SPEECH_THRESHOLD)
          }

          if (maxLevel < SILENCE_THRESHOLD) {
            // Silent audio - start/continue silence timer
            if (silenceTimerRef.current === null && lastAudioTimestampRef.current > 0) {
              // Start silence timer
              console.log('[AudioCapture] Starting silence timer, level:', maxLevel)
              silenceTimerRef.current = setTimeout(() => {
                console.log('[AudioCapture] Silence detected after', silenceTimeoutMs, 'ms')
                onSilenceDetectedRef.current?.()
                silenceTimerRef.current = null
              }, silenceTimeoutMs)
            }
            // Skip sending silent audio to reduce server traffic
            return
          }

          // Speech detected
          const now = Date.now()
          const hadPreviousAudio = lastAudioTimestampRef.current > 0
          lastAudioTimestampRef.current = now

          // Clear silence timer if it exists
          if (silenceTimerRef.current !== null) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }

          // Trigger speech detection callback for barge-in (only if above higher threshold)
          if (maxLevel >= SPEECH_THRESHOLD && hadPreviousAudio) {
            onSpeechDetectedRef.current?.()
          }

          console.log('[AudioCapture] Sending audio data:', audioBuffer.byteLength, 'bytes, level:', maxLevel)
          onAudioData(audioBuffer)
        }
      }

      // Connect audio pipeline
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      source.connect(workletNode)
      // Don't connect to destination to avoid feedback
      // workletNode.connect(audioContext.destination)

      setIsRecording(true)
      isRecordingRef.current = true

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

    // Stop the animation loop first
    isRecordingRef.current = false

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    // Reset audio timestamp
    lastAudioTimestampRef.current = 0

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
