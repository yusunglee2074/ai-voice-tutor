declare global {
  interface Window {
    ActionCable: {
      createConsumer: (url: string) => any
    }
  }
}

export {}
