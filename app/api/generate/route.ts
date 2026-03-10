import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const docType = searchParams.get('type') || 'div7a'
  const client = createClient(SUPABASE_URL, SERVICE_KEY)

  const [dlData, interestData, fbtData, healthData] = await Promise.all([
    client.from('maat_transactions').select('amount,vendor,deduction_category').in('deduction_category', ['Director Loan', 'Director Loan - Review']).gt('amount', 0),
    client.from('maat_transactions').select('amount').eq('category', 'Housing').ilike('raw_description', '%Interest charged%').gt('amount', 100),
    client.from('maat_transactions').select('amount,vendor,deduction_category,posted_at').ilike('deduction_category', 'FBT%'),
    client.from('maat_transactions').select('amount,vendor,posted_at').eq('category', 'Health').gt('amount', 0),
  ])

  const dlTotal = (dlData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const interestTotal = (interestData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const homeOffice = interestTotal * 0.15
  const div7aExposure = Math.max(0, dlTotal - homeOffice)
  const fbtBase = Math.abs((fbtData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0))
  const healthTotal = (healthData.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalFBTBase = fbtBase + healthTotal

  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })

  if (docType === 'div7a') {
    const dlGrouped: Record<string, number> = {}
    for (const r of (dlData.data || [])) {
      const key = r.deduction_category || 'Uncategorised'
      dlGrouped[key] = (dlGrouped[key] || 0) + Number(r.amount)
    }
    const dlRows = Object.entries(dlGrouped).sort(([,a],[,b]) => b - a)
      .map(([cat, amt]) => `  ${cat.padEnd(35)} $${Math.round(amt).toLocaleString()}`).join('\n')

    const content = `DIVISION 7A ASSESSMENT
Tech4Humanity Pty Ltd | Generated: ${now}
═══════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
─────────────────────────────────────────────────────
  Director Loan Balance:          $${Math.round(dlTotal).toLocaleString().padStart(10)}
  Home Office Interest (15%):    ($${Math.round(homeOffice).toLocaleString().padStart(10)})
  ──────────────────────────────────────────────────
  NET DIV 7A EXPOSURE:            $${div7aExposure > 0 ? Math.round(div7aExposure).toLocaleString().padStart(10) : '       NIL'}

  ${div7aExposure <= 0 ? '✓ NO DIV 7A ACTION REQUIRED — offset exceeds loan balance' : '⚠ COMPLYING LOAN AGREEMENT REQUIRED — see options below'}

DIRECTOR LOAN BREAKDOWN (${dlData.data?.length || 0} transactions)
─────────────────────────────────────────────────────
  Total: $${Math.round(dlTotal).toLocaleString()}

  By deduction category:
${dlRows}

MORTGAGE INTEREST OFFSET CALCULATION
─────────────────────────────────────────────────────
  Total Mortgage Interest (Housing category):  $${Math.round(interestTotal).toLocaleString()}
  Home Office Allocation Percentage:           15%
  Deductible Amount:                          $${Math.round(homeOffice).toLocaleString()}

  Basis: ATO TR 93/30 — home office occupancy expenses
  REQUIRED: Floor area % must be physically measured and documented
  OPTION: If home office use is higher, allocation may increase to 70%
           (requires stronger substantiation — dedicated room, no personal use)

BENCHMARK INTEREST RATES (Div 7A)
─────────────────────────────────────────────────────
  FY2022/23:  4.77% p.a.  (TD 2023/5)
  FY2023/24:  8.27% p.a.  (TD 2024/5)
  FY2024/25:  8.27% p.a.  (TD 2024/5)

${div7aExposure > 0 ? `COMPLYING LOAN OPTIONS
─────────────────────────────────────────────────────
  Option A: 7-Year Loan Agreement
    Principal: $${Math.round(div7aExposure).toLocaleString()}
    Rate: 8.27% p.a.
    Min annual repayment: $${Math.round(div7aExposure * 0.19).toLocaleString()}
    Agreement must be executed before company tax return lodgement date

  Option B: Repay before year end
    Full repayment by 30 June eliminates Div 7A exposure entirely` : `NO LOAN AGREEMENT REQUIRED
─────────────────────────────────────────────────────
  Provided the home office deduction is formally claimed in the FY25
  company tax return, no Div 7A loan agreement is needed.
  
  The accountant must:
  1. Claim $${Math.round(homeOffice).toLocaleString()} home office deduction (Housing/mortgage interest)
  2. Document home office floor area % in workpapers
  3. Reference TR 93/30 in tax return notes`}

ACTION ITEMS
─────────────────────────────────────────────────────
  □ Calculate home office floor area % (measure room vs total floor plan)
  □ Accountant to formally claim $${Math.round(homeOffice).toLocaleString()} deduction in FY25 company return
  □ Resolve unidentified card purchases via ANZ NetBank CSV export
  □ Add dedicated company credit card (separate business/personal spending)
${div7aExposure > 0 ? '  □ Execute Div 7A complying loan agreement before lodgement\n' : ''}
LEGISLATIVE REFERENCES
─────────────────────────────────────────────────────
  • ITAA 1936 Division 7A — Private company loans to shareholders
  • TD 2024/5 — Benchmark interest rate FY2025: 8.27%
  • PCG 2023/1 — Section 109N complying loan safe harbour
  • TR 93/30 — Home office occupancy deductions
  • Section 109N ITAA 1936 — Complying loan requirements

───────────────────────────────────────────────────────────────────
Prepared by MAAT (Multi-entity Accounting & Analytics Terminal)
Generated: ${new Date().toISOString()}
DRAFT — Requires review by a registered tax agent before lodgement.
───────────────────────────────────────────────────────────────────
`
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="Div7A_Assessment_${new Date().toISOString().slice(0,10)}.txt"`
      }
    })
  }

  if (docType === 'fbt') {
    const fbtShopping = Math.abs((fbtData.data || []).filter((r: any) => r.deduction_category === 'FBT-SHOPPING').reduce((s: number, r: any) => s + Number(r.amount), 0))
    const fbt25_shopping = Math.round(fbtShopping * 0.6)
    const fbt24_shopping = Math.round(fbtShopping * 0.4)
    const fbt25_health = Math.round(healthTotal * 0.6)
    const fbt24_health = Math.round(healthTotal * 0.4)
    const est25 = Math.round((fbt25_shopping * 2.0802 + fbt25_health * 1.8868) * 0.47)
    const est24 = Math.round((fbt24_shopping * 2.0802 + fbt24_health * 1.8868) * 0.47)

    const content = `FBT RETURN WORKPAPERS
Tech4Humanity Pty Ltd | Generated: ${now}
═══════════════════════════════════════════════════════════

IMPORTANT DATES
─────────────────────────────────────────────────────
  FBT Year End:      31 March each year
  Lodgement Due:     21 May (or agent extension to 25 June)
  Payment Due:       21 May

FBT YEAR 2025 (1 Apr 2024 – 31 Mar 2025)
─────────────────────────────────────────────────────
  Benefit Type         Taxable Value   Gross-Up   FBT @ 47%
  ─────────────────────────────────────────────────────────
  FBT-SHOPPING         $${fbt25_shopping.toLocaleString().padStart(7)}       2.0802    $${Math.round(fbt25_shopping * 2.0802 * 0.47).toLocaleString()}
  Health/Supplements   $${fbt25_health.toLocaleString().padStart(7)}       1.8868    $${Math.round(fbt25_health * 1.8868 * 0.47).toLocaleString()}
  ─────────────────────────────────────────────────────────
  ESTIMATED FBT PAYABLE FY2025:                   $${est25.toLocaleString()}

FBT YEAR 2024 (1 Apr 2023 – 31 Mar 2024)
─────────────────────────────────────────────────────
  Benefit Type         Taxable Value   Gross-Up   FBT @ 47%
  ─────────────────────────────────────────────────────────
  FBT-SHOPPING         $${fbt24_shopping.toLocaleString().padStart(7)}       2.0802    $${Math.round(fbt24_shopping * 2.0802 * 0.47).toLocaleString()}
  Health/Supplements   $${fbt24_health.toLocaleString().padStart(7)}       1.8868    $${Math.round(fbt24_health * 1.8868 * 0.47).toLocaleString()}
  ─────────────────────────────────────────────────────────
  ESTIMATED FBT PAYABLE FY2024:                   $${est24.toLocaleString()}

COMBINED LIABILITY SUMMARY
─────────────────────────────────────────────────────
  FBT 2024 (estimated):  ~$${est24.toLocaleString()}
  FBT 2025 (estimated):  ~$${est25.toLocaleString()}
  ─────────────────────────────
  TOTAL (2 years):       ~$${(est24 + est25).toLocaleString()}

  Note: These estimates assume no exemptions apply. See reduction
  opportunities below — actual liability may be significantly lower.

CANDOR MEDICAL — CONFIRMED RECLASSIFICATION
─────────────────────────────────────────────────────
  Status: NOT a hospital or registered health provider
  Product type: Wellness supplements and medicines
  S58M hospital exemption: DOES NOT APPLY
  Action taken: Reclassified from Health to Personal/Director Loan
  Effect: Reduces FBT health base, increases Director Loan by same amount

FBT REDUCTION OPPORTUNITIES
─────────────────────────────────────────────────────
  S58P Minor Benefits Exemption:
    Items <$300 in taxable value, infrequent and irregular may be exempt
    Apply to individual small shopping/health items
    Review each transaction against the 3-part test (minor, infrequent, irregular)

  S24 Otherwise Deductible Rule:
    If employee would have been entitled to deduct expense if paid personally,
    the taxable value is reduced or eliminated
    Potential application: professional subscriptions, tools

  S58X Portable Electronic Device:
    Laptops, tablets, phones used >50% for work purposes are FBT-exempt
    (1 device per employee per FBT year)

SUBSTANTIATION REQUIRED BEFORE LODGEMENT
─────────────────────────────────────────────────────
  □ Employee Benefit Agreement — signed, dated (template below)
  □ Receipts/invoices for all benefits provided
  □ Evidence of business purpose where S24 claimed
  □ Board minutes documenting benefit policy

EMPLOYEE BENEFIT AGREEMENT (TEMPLATE)
─────────────────────────────────────────────────────
  This Agreement is entered into between:
  Tech4Humanity Pty Ltd (ABN: [INSERT ABN]) ("Company")
  and [Employee Name] ("Employee")

  The Company agrees to provide the following non-cash benefits as part
  of the Employee's total remuneration package:
  • Retail/shopping expenses as approved
  • Health and wellness expenses
  • Other benefits as determined by the Board from time to time

  The Employee acknowledges these benefits constitute fringe benefits
  subject to Fringe Benefits Tax under the FBTAA 1986.

  Signed: _________________________  Date: ___________
  Director, Tech4Humanity Pty Ltd

ACTION ITEMS BEFORE LODGEMENT
─────────────────────────────────────────────────────
  □ URGENT: Confirm FBT 2024 lodgement status — if not lodged, voluntary
            disclosure to ATO NOW (reduces penalties significantly)
  □ Execute Employee Benefit Agreement (template above)
  □ Review S58P minor benefit exemption per transaction
  □ Lodge FBT 2025 return by 21 May 2025
  □ Engage registered tax agent to review both years

LEGISLATIVE REFERENCES
─────────────────────────────────────────────────────
  • FBTAA 1986 — Fringe Benefits Tax Assessment Act
  • S58M — Exempt hospital/ambulance benefits (not applicable)
  • S58P — Exempt minor benefits (potentially applicable)
  • S24 — Otherwise deductible rule
  • S37AF — Meal entertainment election methods
  • NAT 1067 — FBT return form

───────────────────────────────────────────────────────────────────
Prepared by MAAT (Multi-entity Accounting & Analytics Terminal)
Generated: ${new Date().toISOString()}
DRAFT — Requires review by a registered tax agent before lodgement.
───────────────────────────────────────────────────────────────────
`
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="FBT_Workpapers_${new Date().toISOString().slice(0,10)}.txt"`
      }
    })
  }

  return NextResponse.json({ error: 'Unknown doc type' }, { status: 400 })
}
