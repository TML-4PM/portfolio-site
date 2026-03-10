import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function fetchAll(client: any, table: string, query: string) {
  const rows: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await client.from(table).select(query).range(offset, offset + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if ((data?.length || 0) < 1000) break
    offset += 1000
  }
  return rows
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const report = searchParams.get('report') || 'summary'
  const client = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    if (report === 'summary') {
      // Director Loan: only true personal items (deduction_category = 'Director Loan' or 'Director Loan - Review')
      const dlData = await client.from('maat_transactions')
        .select('amount,deduction_category,subcategory,vendor')
        .in('deduction_category', ['Director Loan', 'Director Loan - Review'])
        .gt('amount', 0)
      
      // Interest: Housing category, raw_description contains 'Interest charged'
      const interestData = await client.from('maat_transactions')
        .select('amount')
        .eq('category', 'Housing')
        .ilike('raw_description', '%Interest charged%')
        .gt('amount', 100)

      // FBT: deduction_category starts with FBT
      const fbtData = await client.from('maat_transactions')
        .select('amount,deduction_category')
        .ilike('deduction_category', 'FBT%')

      // Health (potential FBT)
      const healthData = await client.from('maat_transactions')
        .select('amount,deduction_category')
        .eq('category', 'Health')
        .gt('amount', 0)

      // Entertainment (ENT-50 = 50% deductible, potential FBT)
      const entData = await client.from('maat_transactions')
        .select('amount')
        .eq('deduction_category', 'ENT-50')
        .gt('amount', 0)

      // Travel/Business
      const businessData = await client.from('maat_transactions')
        .select('amount')
        .eq('category', 'Business')
        .gt('amount', 0)

      const dlTotal = (dlData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const interestTotal = (interestData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const homeOffice = interestTotal * 0.15
      const div7aExposure = Math.max(0, dlTotal - homeOffice)

      const fbtTotal = (fbtData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const healthTotal = (healthData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)

      const fbtByType: Record<string, number> = {}
      for (const r of (fbtData.data || [])) {
        const dc = r.deduction_category as string
        fbtByType[dc] = (fbtByType[dc] || 0) + Number(r.amount)
      }
      // Add health as potential FBT
      if (healthTotal > 0) fbtByType['HEALTH (potential)'] = healthTotal

      const entTotal = (entData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const businessTotal = (businessData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)

      return NextResponse.json({
        report: 'summary',
        generated_at: new Date().toISOString(),
        data: {
          total_transactions: 3482,
          director_loan: Math.round(dlTotal),
          director_loan_count: dlData.data?.length || 0,
          mortgage_interest: Math.round(interestTotal),
          home_office_15pct: Math.round(homeOffice),
          div7a_exposure: Math.round(div7aExposure),
          fbt_total: Math.round(Math.abs(fbtTotal) + healthTotal),
          fbt_by_type: Object.fromEntries(Object.entries(fbtByType).map(([k, v]) => [k, Math.round(Math.abs(v))])),
          entertainment_50: Math.round(entTotal),
          business_total: Math.round(businessTotal),
          fbt_fy25_est: Math.round((Math.abs(fbtTotal) + healthTotal) * 0.6 * 2.0802 * 0.47),
          fbt_fy24_est: Math.round((Math.abs(fbtTotal) + healthTotal) * 0.4 * 2.0802 * 0.47),
        }
      })
    }

    if (report === 'director_loan') {
      const { data } = await client.from('maat_transactions')
        .select('posted_at,amount,vendor,subcategory,raw_description,deduction_category,category')
        .in('deduction_category', ['Director Loan', 'Director Loan - Review'])
        .gt('amount', 0)
        .order('amount', { ascending: false })
        .limit(500)

      const grouped: Record<string, { total: number; count: number }> = {}
      for (const r of (data || [])) {
        const key = r.deduction_category || r.subcategory || 'Uncategorised'
        if (!grouped[key]) grouped[key] = { total: 0, count: 0 }
        grouped[key].total += Number(r.amount)
        grouped[key].count++
      }

      return NextResponse.json({
        report: 'director_loan',
        generated_at: new Date().toISOString(),
        data: {
          transactions: data || [],
          grouped: Object.fromEntries(Object.entries(grouped).sort(([,a],[,b]) => b.total - a.total).map(([k,v]) => [k, { total: Math.round(v.total), count: v.count }]))
        }
      })
    }

    if (report === 'fbt') {
      // FBT-tagged + Health items
      const [fbtRows, healthRows] = await Promise.all([
        client.from('maat_transactions').select('posted_at,amount,vendor,subcategory,deduction_category,raw_description').ilike('deduction_category', 'FBT%').order('amount', { ascending: false }),
        client.from('maat_transactions').select('posted_at,amount,vendor,subcategory,deduction_category,raw_description').eq('category', 'Health').gt('amount', 0).order('amount', { ascending: false }),
      ])
      const transactions = [...(fbtRows.data || []), ...(healthRows.data || [])]
      return NextResponse.json({ report: 'fbt', generated_at: new Date().toISOString(), data: { transactions } })
    }

    if (report === 'entertainment') {
      const { data } = await client.from('maat_transactions')
        .select('posted_at,amount,vendor,subcategory,raw_description,deduction_category')
        .eq('deduction_category', 'ENT-50')
        .gt('amount', 0)
        .order('amount', { ascending: false })
        .limit(300)

      const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      return NextResponse.json({ report: 'entertainment', generated_at: new Date().toISOString(), data: { transactions: data || [], total: Math.round(total), deductible: Math.round(total * 0.5) } })
    }

    if (report === 'business') {
      const { data } = await client.from('maat_transactions')
        .select('posted_at,amount,vendor,subcategory,raw_description,category,deduction_category')
        .in('category', ['Business', 'Cloud/Infrastructure', 'AI/LLM Services', 'Development Tools', 'R&D Contractor', 'R&D Cloud', 'R&D Research'])
        .gt('amount', 0)
        .order('amount', { ascending: false })
        .limit(500)

      const byCategory: Record<string, number> = {}
      for (const r of (data || [])) {
        byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount)
      }

      return NextResponse.json({ report: 'business', generated_at: new Date().toISOString(), data: { transactions: data || [], by_category: byCategory } })
    }

    return NextResponse.json({ error: `Unknown report: ${report}` }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
