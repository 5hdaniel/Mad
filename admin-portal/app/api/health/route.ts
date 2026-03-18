/**
 * Health Check Endpoint - Admin Portal
 *
 * BACKLOG-1120: Basic health check for monitoring and load balancer probes.
 * Returns 200 with status info when the service is running.
 *
 * GET /api/health
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
  });
}
