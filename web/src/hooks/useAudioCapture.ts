import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioCaptureHookResult {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  error: string | null
}

interface AudioCaptureHookProps {
  onAudioData: (audioData: ArrayBuffer) => void
}

export function useAudioCapture({ onAudioData }: AudioCaptureHookProps): AudioCaptureHookResult {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

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

      // Handle messages from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          onAudioData(event.data.data)
        }
      }

      // Connect audio pipeline
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(workletNode)
      workletNode.connect(audioContext.destination)

      setIsRecording(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording'
      setError(errorMessage)
      console.error('Error starting recording:', err)
    }
  }, [onAudioData])

  const stopRecording = useCallback(() => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Disconnect and close audio nodes
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsRecording(false)
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
  }
}
