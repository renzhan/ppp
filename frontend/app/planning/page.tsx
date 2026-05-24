'use client'

import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

export default function PlanningPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Planning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plan and manage marketing campaigns and strategies.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Content Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Schedule and organize content across platforms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Manage campaign budgets and spending forecasts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KOL Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Track influencer partnerships and deliverables.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Planning features are being integrated. Check back soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
