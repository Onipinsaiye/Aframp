'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function ConnectivityBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine)
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>You&apos;re offline. Some actions may not work until you reconnect.</span>
    </div>
  )
}