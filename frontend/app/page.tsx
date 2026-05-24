'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useProjects } from '@/lib/ppp-api'
import { useAppSelector } from '@/store'
import { selectUser } from '@/store/slices/auth'

export default function DashboardPage() {
  const user = useAppSelector(selectUser)
  const { data: projects, isLoading } = useProjects()

  const totalProjects = projects?.length ?? 0
  const activeProjects = projects?.filter((p) => p.status === 'active').length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'completed').length ?? 0
  const draftProjects = projects?.filter((p) => p.status === 'draft').length ?? 0

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user ? `Welcome back, ${user.name}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your marketing review projects and presentations.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {isLoading ? '—' : totalProjects}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {isLoading ? '—' : activeProjects}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {isLoading ? '—' : completedProjects}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-400">
                {isLoading ? '—' : draftProjects}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/projects" className="block">
            <Card className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle>Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  View and manage all marketing review projects.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/planning" className="block">
            <Card className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle>Planning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Campaign planning and strategy tools.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/sentiment" className="block">
            <Card className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle>Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Monitor brand sentiment and social listening.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Projects */}
        {projects && projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between py-3 transition hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-sm text-gray-500">
                        {project.brand} · {project.category}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        project.status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : project.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {project.status}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
