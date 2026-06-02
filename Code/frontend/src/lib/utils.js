import { differenceInDays, parseISO, format, addYears, isAfter } from 'date-fns'

export function formatUGX(amount) {
  if (amount == null) return 'UGX 0'
  return `UGX ${Number(amount).toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function leaseDays(startDate, endDate) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
  return differenceInDays(end, start) + 1
}

export function calcLeaseCost(assetType, startDate, endDate, rates) {
  const rate = assetType === 'pda' ? (rates?.pda ?? 5000) : (rates?.laptop ?? 20000)
  const days = leaseDays(startDate, endDate)
  return { rate, days, total: rate * days }
}

export function calcDepreciation(purchaseCost, purchaseDate, usefulLifeYears) {
  const now = new Date()
  const purchase = typeof purchaseDate === 'string' ? parseISO(purchaseDate) : purchaseDate
  const monthsSincePurchase = Math.floor(differenceInDays(now, purchase) / 30.44)
  const totalMonths = usefulLifeYears * 12
  const monthlyDep = purchaseCost / totalMonths
  const accumulated = Math.min(purchaseCost, monthlyDep * monthsSincePurchase)
  const bookValue = Math.max(0, purchaseCost - accumulated)
  const fullyDepreciatedDate = addYears(purchase, usefulLifeYears)
  const isFullyDepreciated = !isAfter(fullyDepreciatedDate, now)
  return { accumulated, bookValue, isFullyDepreciated, fullyDepreciatedDate }
}

export function downloadCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h] ?? ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadPDF(title, columns, rows, filename) {
  import('jspdf').then(({ default: jsPDF }) => {
    import('jspdf-autotable').then(() => {
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.text(`${ORG_NAME} — ${title}`, 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22)
      doc.autoTable({
        startY: 28,
        head: [columns],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      })
      doc.save(filename)
    })
  })
}

import { ORG_NAME } from './constants'

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
