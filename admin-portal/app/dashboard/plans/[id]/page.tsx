import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, CheckCircle2, XCircle } from 'lucide-react';
import { FeatureToggleList } from '../components/FeatureToggleList';
import { DeletePlanButton } from '../components/DeletePlanButton';
import { formatDate } from '@/lib/format';
import type { Plan, PlanFeature, FeatureDefinition } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

/**
 * Plan Detail Page - Admin Portal
 *
 * Server component that loads a plan with all feature definitions and assignments.
 * Passes data to FeatureToggleList client component for interactive editing.
 */
export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify internal role
  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  // Defense-in-depth: verify page-level permission
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'plans.view',
  });
  if (!hasPerm) {
    redirect('/dashboard?error=insufficient_permissions');
  }

  // Check manage permission
  const { data: canManage } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'plans.manage',
  });

  // Fetch plan, plan features, and all feature definitions in parallel
  const [planResult, planFeaturesResult, allFeaturesResult] = await Promise.all([
    supabase.from('plans').select('*').eq('id', id).single(),
    supabase
      .from('plan_features')
      .select('*, feature_definitions(*)')
      .eq('plan_id', id),
    supabase.from('feature_definitions').select('*').order('category').order('name'),
  ]);

  if (!planResult.data) {
    notFound();
  }

  const plan = planResult.data as unknown as Plan;
  const planFeatures = (planFeaturesResult.data ?? []) as unknown as PlanFeature[];
  const allFeatures = (allFeaturesResult.data ?? []) as unknown as FeatureDefinition[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back navigation */}
      <Link
        href="/dashboard/plans"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Plans
      </Link>

      {/* Plan header card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
              {plan.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <XCircle className="h-3 w-3" />
                  Inactive
                </span>
              )}
            </div>
            {plan.description && (
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{plan.tier}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Features Configured</dt>
            <dd className="mt-1 text-sm text-gray-900">{planFeatures.length} / {allFeatures.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(plan.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(plan.updated_at)}</dd>
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Feature Configuration
        </h2>
        <FeatureToggleList
          planId={plan.id}
          features={planFeatures}
          allFeatures={allFeatures}
          canManage={!!canManage}
        />
      </div>

      {/* Danger zone */}
      {canManage && (
        <div className="border border-red-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Deleting a plan is permanent. Plans with assigned organizations cannot be deleted.
          </p>
          <DeletePlanButton planId={plan.id} planName={plan.name} />
        </div>
      )}
    </div>
  );
}
