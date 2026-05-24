'use client'

import { use } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { useProject } from '@/lib/ppp-api'

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: project, isLoading, isError } = useProject(id)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500">
          <Link href="/projects" className="hover:text-gray-700">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">
            {isLoading ? '...' : project?.name ?? 'Not Found'}
          </span>
        </nav>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading project...</div>
        ) : isError || !project ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load project details.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {project.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {project.brand} · {project.category} · {project.platform}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/review/${id}`}>
                  <Button variant="outline">View Report</Button>
                </Link>
                <Link href={`/review/${id}/ppt`}>
                  <Button>Generate PPT</Button>
                </Link>
              </div>
            </div>

            {/* Project Info */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${
                      project.status === 'active'
                        ? 'bg-blue-100 text-blue-700'
                        : project.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {project.status}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Date Range
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-900">
                    {new Date(project.startDate).toLocaleDateString()} –{' '}
                    {new Date(project.endDate).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Last Updated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-900">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Modules / Metrics */}
            {project.modules && (
              <Card>
                <CardHeader>
                  <CardTitle>Report Modules</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">
                    {Object.keys(project.modules).length} modules configured for
                    this project.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
