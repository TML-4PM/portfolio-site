import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { sql } = await req.json()
    if (!sql) return NextResponse.json({ error: 'No SQL provided' }, { status: 400 })
    
    const client = supabaseAdmin()
    const { data, error } = await client.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      // Fallback: try direct query if exec_sql RPC not available
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ rows: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
