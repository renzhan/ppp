'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Card, CardContent, Button, Input } from '@/components/ui'
import { useProjects } from '@/lib/ppp-api'
import { useState, useMemo } from 'react'

export default function ProjectsListPage() {
  const { data: projects, isLoading, isError } = useProjects()
  const [search, setSearch] = useState('')

  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage all marketing review projects.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>New Project</Button>
          </Link>
        </div>

        {/* Search */}
        <div className="max-w-sm">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading projects...</div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load projects. Please try again.
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {search ? 'No projects match your search.' : 'No projects yet.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Brand</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Platform</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{project.brand}</td>
                    <td className="px-4 py-3 text-gray-700">{project.category}</td>
                    <td className="px-4 py-3 text-gray-700">{project.platform}</td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
