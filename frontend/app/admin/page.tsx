'use client'

import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { useAppSelector } from '@/store'
import { selectUser, selectIsAuthenticated } from '@/store/slices/auth'

export default function AdminPage() {
  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-500">
            You must be logged in to access the admin panel.
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="mt-1 text-sm text-gray-500">
            System settings and user management.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Manage user accounts, roles, and permissions.
              </p>
              <Button variant="outline" className="mt-4">
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Configure system-wide settings and integrations.
              </p>
              <Button variant="outline" className="mt-4">
                Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">PPP Backend</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Presenton Backend</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current User Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">{user?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{user?.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{user?.id ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
