'use client'

import { use } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { useReport, useGenerateReport, useExportPdf, useExportWord } from '@/lib/ppp-api'

export default function ReviewReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: report, isLoading, isError } = useReport(id)
  const generateReport = useGenerateReport()
  const exportPdf = useExportPdf()
  const exportWord = useExportWord()

  const handleGenerate = () => {
    generateReport.mutate(id)
  }

  const handleExportPdf = () => {
    exportPdf.mutate(id)
  }

  const handleExportWord = () => {
    exportWord.mutate(id)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500">
          <Link href="/projects" className="hover:text-gray-700">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${id}`} className="hover:text-gray-700">
            Project
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Review Report</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Marketing review report for project {id}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={exportPdf.isPending || !report}
            >
              {exportPdf.isPending ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportWord}
              disabled={exportWord.isPending || !report}
            >
              {exportWord.isPending ? 'Exporting...' : 'Export Word'}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading report...</div>
        ) : isError || !report ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                No report generated yet. Click &quot;Generate Report&quot; to create one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Report metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Report Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Generated At
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {new Date(report.generatedAt).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Modules
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {Object.keys(report.modules).length} modules
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Module cards */}
            {Object.entries(report.modules).map(([key, moduleData]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>Module {key}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">
                    Module data available. View full report for details.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
