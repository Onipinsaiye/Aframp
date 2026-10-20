import { fireEvent, render, screen } from '@testing-library/react'
import { ConnectivityBanner } from '../connectivity-banner'

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('appears when the browser goes offline and clears when it comes online', () => {
    render(<ConnectivityBanner />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i)

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})