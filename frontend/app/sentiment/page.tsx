'use client'

import { AppShell } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

export default function SentimentPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sentiment Analysis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor brand sentiment and social listening across platforms.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Overall Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">Positive</p>
              <p className="mt-1 text-sm text-gray-500">
                Based on recent social media mentions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mentions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">—</p>
              <p className="mt-1 text-sm text-gray-500">
                Total brand mentions this period.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trending Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">—</p>
              <p className="mt-1 text-sm text-gray-500">
                Active discussion topics.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Sentiment monitoring features are being integrated. Check back soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
