"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SiteDetail } from "@/components/site-detail";
import { Card, CardContent } from "@/components/ui/card";

export default function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);

  return (
    <DashboardShell>
      {({ dashboards }) => {
        const dashboard = dashboards.find((d) => d.site.id === siteId);
        if (!dashboard) {
          return (
            <Card>
              <CardContent className="grid place-items-center gap-3 py-16 text-center">
                <p className="text-sm text-muted-foreground">Site &quot;{siteId}&quot; not found or not configured.</p>
                <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
                </Link>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
            </Link>
            <SiteDetail dashboard={dashboard} />
          </div>
        );
      }}
    </DashboardShell>
  );
}
