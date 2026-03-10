'use client'

import { useState, useEffect, useCallback } from 'react'

type SummaryData = {
  total_transactions: number
  director_loan: number
  mortgage_interest: number
  home_office_15pct: number
  div7a_exposure: number
  school_fees_paid: number
  fbt_total: number
  fbt_by_type: Record<string, number>
  travel_total: number
  fbt_fy25_est: number
  fbt_fy24_est: number
}

type DLData = { transactions: any[]; grouped: Record<string, { total: number; count: number }> }
type FBTData = { transactions: any[] }
type TravelData = { transactions: any[]; total: number; by_type: Record<string, number> }

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtN = (n: number) => Math.round(n).toLocaleString()

const REPORTS = [
  { id: 'summary', label: 'Overview', icon: '◈' },
  { id: 'director_loan', label: 'Director Loan', icon: '⟁' },
  { id: 'fbt', label: 'FBT Benefits', icon: '⬡' },
  { id: 'entertainment', label: 'Entertainment', icon: '◎' },
  { id: 'business', label: 'Business Expenses', icon: '▲' },
]

const GAPS = [
  { id: 'unidentified', label: '97 unidentified card purchases', amount: '$9,820', severity: 'high', action: 'Get ANZ NetBank CSV export' },
  { id: 'school_invoices', label: 'School fee invoices not in company name', amount: '$21,010', severity: 'high', action: 'Request SCECGS Redlands invoices in ABN name' },
  { id: 'benefit_agreement', label: 'Employee Benefit Agreement unsigned', amount: null, severity: 'high', action: 'Execute agreement (template in FBT doc)' },
  { id: 'home_office_pct', label: 'Home office floor area % unmeasured', amount: '$47,051 offset at risk', severity: 'high', action: 'Measure and document floor plan' },
  { id: 'fbt_2024', label: 'FBT 2024 lodgement status unknown', amount: '~$21K liability', severity: 'critical', action: 'Confirm with accountant — voluntary disclosure if not lodged' },
  { id: 'mortgage_allocation', label: 'Mortgage interest allocation method not chosen', amount: '$313,677 base', severity: 'medium', action: '15% vs 70% — choose and substantiate' },
  { id: 'travel_receipts', label: 'Travel not reconstructed from calendar', amount: '$31,702', severity: 'medium', action: 'Cross-reference calendar + invoices' },
  { id: 'personal_individuals', label: '$49K payments to individuals not reviewed', amount: '$49,000', severity: 'medium', action: 'Manual pass to classify' },
  { id: 'fy22_startup', label: 'FY22-23 startup costs not captured', amount: 'Unknown', severity: 'medium', action: 'Add supplementary costs tab' },
  { id: 'tx_ids', label: 'No transaction_id column', amount: null, severity: 'low', action: 'Add T4H-YYMM-#### format column' },
]

export default function MaatDashboard() {
  const [activeReport, setActiveReport] = useState('summary')
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [dlData, setDlData] = useState<DLData | null>(null)
  const [fbtData, setFbtData] = useState<FBTData | null>(null)
  const [travelData, setTravelData] = useState<TravelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)

  const fetchReport = useCallback(async (report: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/report?report=${report}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      if (report === 'summary') setSummaryData(json.data)
      if (report === 'director_loan') setDlData(json.data)
      if (report === 'fbt') setFbtData(json.data)
      if (report === 'travel') setTravelData(json.data)
      setLastRefresh(new Date().toLocaleTimeString('en-AU'))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport('summary') }, [fetchReport])
  useEffect(() => { if (activeReport !== 'summary') fetchReport(activeReport) }, [activeReport, fetchReport])

  const generateDoc = async (type: string) => {
    setGenerating(type)
    try {
      const res = await fetch(`/api/generate?type=${type}`)
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'div7a' ? `Div7A_${new Date().toISOString().slice(0,10)}.txt` : `FBT_${new Date().toISOString().slice(0,10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { setError(`Doc gen failed: ${e.message}`) }
    finally { setGenerating(null) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #00d4aa, #7c6af7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#000' }}>M</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>MAAT Reporting Terminal</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>Tech4Humanity Pty Ltd · lzfgigiyqpuuxslsygjt</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>refreshed {lastRefresh}</span>}
          <button onClick={() => fetchReport(activeReport)} disabled={loading} style={{ background: 'var(--border)', border: 'none', borderRadius: 6, padding: '6px 12px', color: loading ? 'var(--muted)' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
            {loading ? '⟳ loading' : '⟳ refresh'}
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <nav style={{ width: 210, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: 6, paddingLeft: 8 }}>REPORTS</div>
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ background: activeReport === r.id ? 'rgba(0,212,170,0.1)' : 'transparent', border: activeReport === r.id ? '1px solid rgba(0,212,170,0.25)' : '1px solid transparent', borderRadius: 7, padding: '9px 11px', cursor: 'pointer', color: activeReport === r.id ? '#00d4aa' : 'var(--muted)', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'DM Sans', sans-serif" }}>
              <span>{r.icon}</span> {r.label}
            </button>
          ))}
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: 6, paddingLeft: 8, marginTop: 20 }}>1-TOUCH DOCUMENTS</div>
          <button onClick={() => generateDoc('div7a')} disabled={generating === 'div7a'} style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 7, padding: '9px 11px', cursor: 'pointer', color: '#00d4aa', fontSize: 12, textAlign: 'left', fontFamily: "'DM Mono', monospace" }}>
            {generating === 'div7a' ? '⟳ building...' : '↓ Div 7A Report'}
          </button>
          <button onClick={() => generateDoc('fbt')} disabled={generating === 'fbt'} style={{ background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.3)', borderRadius: 7, padding: '9px 11px', cursor: 'pointer', color: '#7c6af7', fontSize: 12, textAlign: 'left', fontFamily: "'DM Mono', monospace" }}>
            {generating === 'fbt' ? '⟳ building...' : '↓ FBT Workpapers'}
          </button>
        </nav>

        <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>⚠ {error}</div>}
          {activeReport === 'summary' && <SummaryView data={summaryData} loading={loading} />}
          {activeReport === 'director_loan' && <DLView data={dlData} loading={loading} />}
          {activeReport === 'fbt' && <FBTView data={fbtData} loading={loading} />}
          {activeReport === 'travel' && <TravelView data={travelData} loading={loading} />}
        </main>
      </div>
    </div>
  )
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', borderTop: accent ? `2px solid ${accent}` : undefined }}>
    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
    {children}
  </div>
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return <div>
    <div style={{ fontSize: 22, fontWeight: 600, color: color || 'var(--text)', letterSpacing: '-0.02em', fontFamily: "'DM Mono', monospace" }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, opacity: 0.6 }}>{sub}</div>}
  </div>
}

function SummaryView({ data, loading }: { data: SummaryData | null; loading: boolean }) {
  if (loading && !data) return <Loader />
  if (!data) return <Empty />
  const div7aOk = data.div7a_exposure === 0
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Financial Overview</h1>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{fmtN(data.total_transactions)} tx</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <Card title="Director Loan" accent="#f59e0b"><Stat label="gross balance" value={fmt(data.director_loan)} color="#f59e0b" /></Card>
      <Card title="Div 7A Exposure" accent={div7aOk ? '#00d4aa' : '#ef4444'}>
        <Stat label={div7aOk ? 'NIL — offset covers it' : 'after home office offset'} value={div7aOk ? 'NIL' : fmt(data.div7a_exposure)} color={div7aOk ? '#00d4aa' : '#ef4444'} />
      </Card>
      <Card title="FBT ~2yr Total" accent="#7c6af7"><Stat label={`FY24 ${fmt(data.fbt_fy24_est)} + FY25 ${fmt(data.fbt_fy25_est)}`} value={fmt(data.fbt_fy24_est + data.fbt_fy25_est)} color="#7c6af7" /></Card>
      <Card title="Travel" accent="#00d4aa"><Stat label="all business deductible" value={fmt(data.travel_total)} color="#00d4aa" /></Card>
    </div>
    <Card title="Div 7A Offset Calculation">
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Director Loan</span><span style={{ color: '#f59e0b' }}>{fmt(data.director_loan)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Less: mortgage interest × 15%</span><span style={{ color: '#00d4aa' }}>({fmt(data.home_office_15pct)})</span></div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 7, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Net Exposure</span><span style={{ color: div7aOk ? '#00d4aa' : '#ef4444' }}>{div7aOk ? 'NIL' : fmt(data.div7a_exposure)}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mortgage base: {fmt(data.mortgage_interest)} · Basis: TR 93/30</div>
      </div>
    </Card>
    <Card title="FBT Benefits by Type">
      {Object.entries(data.fbt_by_type).sort(([,a],[,b]) => b - a).map(([type, amount]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", width: 170 }}>{type}</div>
          <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#7c6af7', width: `${(amount / data.fbt_total * 100).toFixed(1)}%` }} />
          </div>
          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#7c6af7', width: 80, textAlign: 'right' }}>{fmt(amount)}</div>
        </div>
      ))}
    </Card>
    <Card title="Reporting Gaps">
      {GAPS.map(g => (
        <div key={g.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 7, marginBottom: 6, background: g.severity === 'critical' ? 'rgba(239,68,68,0.06)' : g.severity === 'high' ? 'rgba(245,158,11,0.06)' : 'rgba(100,116,139,0.04)', border: `1px solid ${g.severity === 'critical' ? 'rgba(239,68,68,0.2)' : g.severity === 'high' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2, background: g.severity === 'critical' ? 'rgba(239,68,68,0.2)' : g.severity === 'high' ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)', color: g.severity === 'critical' ? '#ef4444' : g.severity === 'high' ? '#f59e0b' : 'var(--muted)', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', alignSelf: 'flex-start' }}>{g.severity}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{g.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{g.action}</div>
          </div>
          {g.amount && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", flexShrink: 0, alignSelf: 'center' }}>{g.amount}</div>}
        </div>
      ))}
    </Card>
  </div>
}

function DLView({ data, loading }: { data: DLData | null; loading: boolean }) {
  if (loading && !data) return <Loader />
  if (!data) return <Empty />
  const total = Object.values(data.grouped).reduce((s, v) => s + v.total, 0)
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Director Loan Register</h1>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="Gross Balance" accent="#f59e0b"><Stat label={`${data.transactions.length} transactions`} value={fmt(total)} color="#f59e0b" /></Card>
      <Card title="Net After Offset" accent="#00d4aa"><Stat label="15% × $313,677 interest" value={total <= 47051 ? 'NIL' : fmt(total - 47051)} color={total <= 47051 ? '#00d4aa' : '#f59e0b'} /></Card>
    </div>
    <Card title="By Category">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Category', 'Tx', 'Total', '%'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 8px', color: 'var(--muted)', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{h}</th>)}</tr></thead>
        <tbody>
          {Object.entries(data.grouped).map(([cat, { total: amt, count }]) => (
            <tr key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '9px 8px', color: 'var(--text)' }}>{cat}</td>
              <td style={{ padding: '9px 8px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{count}</td>
              <td style={{ padding: '9px 8px', color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>{fmt(amt)}</td>
              <td style={{ padding: '9px 8px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{(amt / total * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
    <Card title="Transactions (top 50)">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Date', 'Vendor', 'Category', 'Amount'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 8px', color: 'var(--muted)', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{h}</th>)}</tr></thead>
        <tbody>
          {data.transactions.slice(0, 50).map((tx, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(30,30,46,0.7)' }}>
              <td style={{ padding: '7px 8px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', fontSize: 11 }}>{tx.posted_at ? new Date(tx.posted_at).toLocaleDateString('en-AU') : '—'}</td>
              <td style={{ padding: '7px 8px', color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.vendor || '—'}</td>
              <td style={{ padding: '7px 8px', color: 'var(--muted)', fontSize: 11 }}>{tx.subcategory || '—'}</td>
              <td style={{ padding: '7px 8px', color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>{fmt(Number(tx.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
}

function FBTView({ data, loading }: { data: FBTData | null; loading: boolean }) {
  if (loading && !data) return <Loader />
  if (!data) return <Empty />
  const grouped: Record<string, { total: number; items: any[] }> = {}
  for (const tx of data.transactions) { const k = tx.deduction_category || 'Other'; if (!grouped[k]) grouped[k] = { total: 0, items: [] }; grouped[k].total += Number(tx.amount); grouped[k].items.push(tx) }
  const grand = Object.values(grouped).reduce((s, v) => s + v.total, 0)
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>FBT Benefits Register</h1>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      <Card title="FBT Base" accent="#7c6af7"><Stat label={`${data.transactions.length} benefits`} value={fmt(grand)} color="#7c6af7" /></Card>
      <Card title="Est. FBT (~2yr)" accent="#ef4444"><Stat label="2.0802 × 47%" value={fmt(grand * 2.0802 * 0.47)} color="#ef4444" /></Card>
      <Card title="Candor Medical" accent="#00d4aa"><Stat label="→ Director Loan. S58M N/A" value="Reclassified" color="#00d4aa" /></Card>
    </div>
    {Object.entries(grouped).sort(([,a],[,b]) => b.total - a.total).map(([type, { total, items }]) => (
      <Card key={type} title={type}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} transactions</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#7c6af7', fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {items.slice(0, 10).map((tx, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(30,30,46,0.7)' }}>
                <td style={{ padding: '6px 0', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", width: 90, fontSize: 11 }}>{tx.posted_at ? new Date(tx.posted_at).toLocaleDateString('en-AU') : '—'}</td>
                <td style={{ padding: '6px 0', color: 'var(--text)', paddingLeft: 10 }}>{tx.vendor || '—'}</td>
                <td style={{ padding: '6px 0', color: '#7c6af7', fontFamily: "'DM Mono', monospace", textAlign: 'right' }}>{fmt(Number(tx.amount))}</td>
              </tr>
            ))}
            {items.length > 10 && <tr><td colSpan={3} style={{ padding: '6px 0', color: 'var(--muted)', fontSize: 11 }}>+ {items.length - 10} more</td></tr>}
          </tbody>
        </table>
      </Card>
    ))}
  </div>
}

function TravelView({ data, loading }: { data: TravelData | null; loading: boolean }) {
  if (loading && !data) return <Loader />
  if (!data) return <Empty />
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Travel Register</h1>
    <Card title="Total" accent="#00d4aa"><Stat label={`${data.transactions.length} transactions — business deductible`} value={fmt(data.total)} color="#00d4aa" /></Card>
    <Card title="By Type">
      {Object.entries(data.by_type).map(([type, amount]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", width: 160 }}>{type}</div>
          <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: '#00d4aa', width: `${(amount / data.total * 100).toFixed(1)}%` }} /></div>
          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#00d4aa', width: 80, textAlign: 'right' }}>{fmt(amount)}</div>
        </div>
      ))}
    </Card>
    <Card title="Transactions">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Date', 'Vendor', 'Type', 'Amount'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 8px', color: 'var(--muted)', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{h}</th>)}</tr></thead>
        <tbody>
          {data.transactions.map((tx, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(30,30,46,0.7)' }}>
              <td style={{ padding: '7px 8px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{tx.posted_at ? new Date(tx.posted_at).toLocaleDateString('en-AU') : '—'}</td>
              <td style={{ padding: '7px 8px', color: 'var(--text)' }}>{tx.vendor || '—'}</td>
              <td style={{ padding: '7px 8px', color: 'var(--muted)', fontSize: 11 }}>{tx.subcategory || '—'}</td>
              <td style={{ padding: '7px 8px', color: '#00d4aa', fontFamily: "'DM Mono', monospace" }}>{fmt(Number(tx.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
}

function Loader() { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>⟳ querying Supabase...</div> }
function Empty() { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>No data — set SUPABASE_SERVICE_KEY in Vercel env vars</div> }
