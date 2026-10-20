'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyStateIllustration } from '@/components/ui/empty-state-illustration'
import { api, ApiError, type Remittance } from '@/lib/api'
import { formatStroops } from '@/lib/money'
import { useAuthenticatedSession } from '@/components/session-provider'
import { formatDateTime } from '@/lib/format-date'

const EXPLORER_BASE = 'https://stellar.expert/explorer/public/tx'
const PAGE_SIZE = 10
const FILTERABLE_STATUSES: Remittance['status'][] = ['pending', 'submitted', 'confirmed', 'failed']

const STATUS_LABEL: Record<Remittance['status'], string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

function statusVariant(status: Remittance['status']) {
  if (status === 'confirmed') return 'default' as const
  if (status === 'failed') return 'destructive' as const
  return 'secondary' as const
}

export default function RemittancesPage() {
  const { token } = useAuthenticatedSession()
  const [remittances, setRemittances] = useState<Remittance[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Remittance['status'] | 'all'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null)
      try {
        const nextRemittances = await api.listRemittances(token, 50, signal)
        setRemittances(nextRemittances)
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        if (cause instanceof ApiError && cause.status === 0) {
          setError('backend-down')
          return
        }
        setError(cause instanceof Error ? cause.message : 'Could not load your remittances')
      }
    },
    [token]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const filteredRemittances = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const end = toDate ? new Date(`${toDate}T00:00:00`) : null
    if (end) end.setDate(end.getDate() + 1)
    const endExclusive = end?.getTime() ?? null

    return (remittances ?? []).filter((remittance) => {
      const matchesQuery =
        !query ||
        [
          remittance.destination_address,
          remittance.tx_hash ?? '',
          remittance.memo ?? '',
          remittance.asset,
        ].some((value) => value.toLowerCase().includes(query))
      const createdAt = new Date(remittance.created_at).getTime()
      return (
        matchesQuery &&
        (statusFilter === 'all' || remittance.status === statusFilter) &&
        (!fromDate || (Number.isFinite(createdAt) && createdAt >= (start ?? 0))) &&
        (!toDate || (Number.isFinite(createdAt) && createdAt < (endExclusive ?? Infinity)))
      )
    })
  }, [remittances, searchQuery, statusFilter, fromDate, toDate])

  const pageCount = Math.ceil(filteredRemittances.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(pageCount, 1))
  const pageRemittances = filteredRemittances.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  if (error)
    return (
      <ErrorState
        message={
          error === 'backend-down'
            ? "We can't connect to the payment server right now. Please try again in a moment."
            : error
        }
        onRetry={() => void load()}
      />
    )
  if (!remittances) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Remittances</h1>
        <p className="text-dim text-sm">History of all money sends</p>
      </header>

      {remittances.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-12 text-center">
          <EmptyStateIllustration variant="empty" className="size-20" />
          <p className="text-dim text-sm">No remittances yet. Send money to get started.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="remittance-search">Search</Label>
              <Input
                id="remittance-search"
                type="search"
                placeholder="Destination, transaction hash, memo or asset"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="remittance-status">Status</Label>
              <select
                id="remittance-status"
                className="border-hairline bg-panel h-9 w-full rounded-md border px-2 text-sm"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as Remittance['status'] | 'all')
                  setPage(1)
                }}
              >
                <option value="all">All</option>
                {FILTERABLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="remittance-from">From</Label>
                <Input
                  id="remittance-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="remittance-to">To</Label>
                <Input
                  id="remittance-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
          </div>

          {filteredRemittances.length === 0 ? (
            <p className="text-dim mt-6 py-8 text-center text-sm">
              No remittances match the selected filters.
            </p>
          ) : (
            <ul className="border-hairline mt-6 divide-y">
              {pageRemittances.map((remittance) => (
            <li key={remittance.id} className="space-y-2 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-bold tabular-nums text-white">
                    {formatStroops(remittance.amount_stroops)} {remittance.asset}
                  </p>
                  <p className="text-dim text-xs font-mono truncate">
                    {remittance.destination_address}
                  </p>
                  <p className="text-dim text-xs">
                    {formatDateTime(remittance.created_at)}
                    {remittance.tx_hash && (
                      <>
                        {' '}
                        ·{' '}
                        <a
                          href={`${EXPLORER_BASE}/${remittance.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-bright underline underline-offset-2"
                        >
                          Receipt
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Badge variant={statusVariant(remittance.status)} className="flex-shrink-0">
                  {STATUS_LABEL[remittance.status] ?? remittance.status}
                </Badge>
              </div>
              {remittance.failure_reason && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 border border-destructive/20">
                  <p className="text-xs text-destructive font-medium">
                    Failure reason: {remittance.failure_reason}
                  </p>
                </div>
              )}
              {remittance.memo && (
                <p className="text-xs text-muted-foreground">Memo: {remittance.memo}</p>
              )}
            </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <nav
              aria-label="Remittance pagination"
              className="mt-4 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-dim text-sm" aria-live="polite">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}
                {'-'}
                {Math.min(currentPage * PAGE_SIZE, filteredRemittances.length)} of{' '}
                {filteredRemittances.length} remittances
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(value - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-dim text-sm">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => Math.min(value + 1, pageCount))}
                  disabled={currentPage === pageCount}
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
