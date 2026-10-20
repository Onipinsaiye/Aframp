import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api, ApiError, type Remittance } from '@/lib/api'
import RemittancesPage from '../page'

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message)
      this.name = 'ApiError'
    }
  }
  return {
    api: {
      listRemittances: jest.fn(),
    },
    ApiError,
  }
})

jest.mock('@/components/session-provider', () => ({
  useAuthenticatedSession: () => ({ token: 'test-token' }),
}))

describe('RemittancesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', async () => {
    ;(api.listRemittances as jest.Mock).mockImplementation(() => new Promise(() => {}))
    const { container } = render(<RemittancesPage />)
    await waitFor(() => {
      // Check for spinner element
      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  it('renders empty state when no remittances', async () => {
    ;(api.listRemittances as jest.Mock).mockResolvedValue([])
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(screen.getByText(/No remittances yet/)).toBeInTheDocument()
    })
  })

  it('displays remittances list', async () => {
    const remittances: Remittance[] = [
      {
        id: '1',
        merchant_id: 'merchant-1',
        destination_address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount_stroops: 1000000n,
        asset: 'XLM',
        memo: 'test memo',
        status: 'confirmed',
        tx_hash: 'txhash123',
        failure_reason: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    ;(api.listRemittances as jest.Mock).mockResolvedValue(remittances)
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(screen.getByText(/0.1 XLM/)).toBeInTheDocument()
      expect(screen.getByText(/GXXXXXXX/)).toBeInTheDocument()
    })
  })

  it('displays failure reason for failed remittances', async () => {
    const remittances: Remittance[] = [
      {
        id: '1',
        merchant_id: 'merchant-1',
        destination_address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount_stroops: 1000000n,
        asset: 'XLM',
        memo: null,
        status: 'failed',
        tx_hash: null,
        failure_reason: 'Insufficient funds in destination account',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    ;(api.listRemittances as jest.Mock).mockResolvedValue(remittances)
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/Failure reason: Insufficient funds in destination account/)
      ).toBeInTheDocument()
    })
  })

  it('does not show failure reason box for successful remittances', async () => {
    const remittances: Remittance[] = [
      {
        id: '1',
        merchant_id: 'merchant-1',
        destination_address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount_stroops: 1000000n,
        asset: 'XLM',
        memo: null,
        status: 'confirmed',
        tx_hash: 'txhash123',
        failure_reason: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    ;(api.listRemittances as jest.Mock).mockResolvedValue(remittances)
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(screen.getByText(/0.1 XLM/)).toBeInTheDocument()
      expect(screen.queryByText(/Failure reason:/)).not.toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    ;(api.listRemittances as jest.Mock).mockRejectedValue(
      new ApiError('Failed to load remittances', 500)
    )
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(screen.getByText('Failed to load remittances')).toBeInTheDocument()
    })
  })

  it('handles backend down error', async () => {
    ;(api.listRemittances as jest.Mock).mockRejectedValue(new ApiError('Network error', 0))
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/We can't connect to the payment server right now/)
      ).toBeInTheDocument()
    })
  })

  it('displays multiple remittances with mixed statuses', async () => {
    const remittances: Remittance[] = [
      {
        id: '1',
        merchant_id: 'merchant-1',
        destination_address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount_stroops: 1000000n,
        asset: 'XLM',
        memo: null,
        status: 'confirmed',
        tx_hash: 'txhash1',
        failure_reason: null,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      {
        id: '2',
        merchant_id: 'merchant-1',
        destination_address: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
        amount_stroops: 2000000n,
        asset: 'XLM',
        memo: null,
        status: 'failed',
        tx_hash: null,
        failure_reason: 'Invalid destination address',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    ;(api.listRemittances as jest.Mock).mockResolvedValue(remittances)
    render(<RemittancesPage />)
    await waitFor(() => {
      expect(screen.getByText(/0.1 XLM/)).toBeInTheDocument()
      expect(screen.getByText(/0.2 XLM/)).toBeInTheDocument()
      expect(screen.getByText(/Failure reason: Invalid destination address/)).toBeInTheDocument()
      expect(screen.getAllByText('Confirmed')).toHaveLength(2)
      expect(screen.getAllByText('Failed')).toHaveLength(2)
    })
  })

  it('filters remittances and paginates the filtered results', async () => {
    const remittances: Remittance[] = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      merchant_id: 'merchant-1',
      destination_address: `Destination ${index + 1}`,
      amount_stroops: 1000000n,
      asset: 'XLM',
      memo: null,
      status: index === 0 ? 'failed' : 'confirmed',
      tx_hash: null,
      failure_reason: null,
      created_at: `2024-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      updated_at: `2024-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    ;(api.listRemittances as jest.Mock).mockResolvedValue(remittances)
    render(<RemittancesPage />)

    expect(await screen.findByText('Showing 1-10 of 12 remittances')).toBeInTheDocument()
    expect(screen.queryByText('Destination 11')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Destination 11')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } })
    expect(screen.getByText('Destination 1')).toBeInTheDocument()
    expect(screen.queryByText('Destination 11')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Remittance pagination' })).not.toBeInTheDocument()
  })
})
