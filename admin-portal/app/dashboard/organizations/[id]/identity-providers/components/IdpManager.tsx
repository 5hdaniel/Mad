'use client';

/**
 * IdpManager - Client-side orchestrator for identity provider CRUD and management.
 *
 * Receives initial data from the server component, manages local state,
 * and delegates mutations to server actions. Includes SCIM settings,
 * directory sync panel, group role mapping, and sync history.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield } from 'lucide-react';
import { IdpCard } from './IdpCard';
import { IdpForm } from './IdpForm';
import { ScimSettings } from './ScimSettings';
import { DirectorySyncPanel } from './DirectorySyncPanel';
import { GroupRoleMappingTable } from './GroupRoleMappingTable';
import { SyncHistoryLog } from './SyncHistoryLog';
import {
  createIdpAction,
  updateIdpAction,
  deleteIdpAction,
  toggleIdpActiveAction,
  generateScimTokenAction,
  revokeScimTokenAction,
  toggleDirectorySyncAction,
  triggerDirectorySyncAction,
  saveGroupRoleMappingAction,
  loadSyncHistoryAction,
  refreshSyncHistoryAction,
} from '../actions';
import type {
  IdentityProviderDisplay,
  IdpFormData,
  ScimTokenInfo,
  DirectorySyncStatus,
  GroupRoleMappingConfig,
  SyncLogEntry,
} from '@/lib/idp';

interface IdpManagerProps {
  organizationId: string;
  initialProviders: IdentityProviderDisplay[];
  orgTenantId: string | null;
  orgWorkspaceDomain: string | null;
  scimEndpointUrl: string;
  initialScimToken: ScimTokenInfo | null;
  initialSyncStatus: DirectorySyncStatus;
  initialGroupRoleMapping: GroupRoleMappingConfig;
  activeIdpId: string | null;
  initialSyncHistory: SyncLogEntry[];
  syncHistoryTotal: number;
}

export function IdpManager({
  organizationId,
  initialProviders,
  orgTenantId,
  orgWorkspaceDomain,
  scimEndpointUrl,
  initialScimToken,
  initialSyncStatus,
  initialGroupRoleMapping,
  activeIdpId,
  initialSyncHistory,
  syncHistoryTotal,
}: IdpManagerProps) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [showForm, setShowForm] = useState(false);
  const [editingIdp, setEditingIdp] = useState<IdentityProviderDisplay | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenCreate = useCallback(() => {
    setEditingIdp(null);
    setShowForm(true);
    setMessage(null);
  }, []);

  const handleEdit = useCallback((idp: IdentityProviderDisplay) => {
    setEditingIdp(idp);
    setShowForm(true);
    setMessage(null);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingIdp(null);
  }, []);

  const handleSave = useCallback(async (formData: IdpFormData) => {
    if (editingIdp) {
      // Update
      const result = await updateIdpAction(editingIdp.id, organizationId, formData);
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        setProviders((prev) =>
          prev.map((p) => (p.id === editingIdp.id ? result.data! : p))
        );
      }
      setMessage({ type: 'success', text: `"${formData.display_name}" updated successfully.` });
    } else {
      // Create
      const result = await createIdpAction(organizationId, formData);
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        setProviders((prev) => [...prev, result.data!]);
      }
      setMessage({ type: 'success', text: `"${formData.display_name}" created successfully.` });
    }
    setShowForm(false);
    setEditingIdp(null);
    router.refresh();
  }, [editingIdp, organizationId, router]);

  const handleToggleActive = useCallback(async (idpId: string, newState: boolean) => {
    setMessage(null);
    const result = await toggleIdpActiveAction(idpId, newState);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setProviders((prev) =>
      prev.map((p) => (p.id === idpId ? { ...p, is_active: newState } : p))
    );
    setMessage({
      type: 'success',
      text: `Provider ${newState ? 'activated' : 'deactivated'}.`,
    });
    router.refresh();
  }, [router]);

  const handleDelete = useCallback(async (idpId: string) => {
    setMessage(null);
    const result = await deleteIdpAction(idpId);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setProviders((prev) => prev.filter((p) => p.id !== idpId));
    setMessage({ type: 'success', text: 'Identity provider deleted.' });
    router.refresh();
  }, [router]);

  // --- SCIM Token handlers ---
  const handleGenerateToken = useCallback(async (description: string) => {
    return generateScimTokenAction(organizationId, description);
  }, [organizationId]);

  const handleRevokeToken = useCallback(async (tokenId: string) => {
    return revokeScimTokenAction(tokenId);
  }, []);

  // --- Directory Sync handlers ---
  const handleToggleSync = useCallback(async (enabled: boolean) => {
    return toggleDirectorySyncAction(organizationId, enabled);
  }, [organizationId]);

  const handleTriggerSync = useCallback(async () => {
    return triggerDirectorySyncAction(organizationId);
  }, [organizationId]);

  // --- Group Role Mapping handlers ---
  const handleSaveMapping = useCallback(async (config: GroupRoleMappingConfig) => {
    if (!activeIdpId) return false;
    return saveGroupRoleMappingAction(activeIdpId, config);
  }, [activeIdpId]);

  // --- Sync History handlers ---
  const handleLoadMoreHistory = useCallback(async (offset: number) => {
    return loadSyncHistoryAction(organizationId, offset);
  }, [organizationId]);

  const handleRefreshHistory = useCallback(async () => {
    return refreshSyncHistoryAction(organizationId);
  }, [organizationId]);

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Identity Providers ({providers.length})
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <IdpForm
          editingIdp={editingIdp}
          onSave={handleSave}
          onCancel={handleCancel}
          orgTenantId={orgTenantId}
          orgWorkspaceDomain={orgWorkspaceDomain}
        />
      )}

      {/* Provider cards */}
      {providers.length === 0 && !showForm ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            No identity providers configured for this organization.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((idp) => (
              <IdpCard
                key={idp.id}
                idp={idp}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Management panels (only when providers exist) */}
          <div className="space-y-6 pt-2">
            {/* Section divider */}
            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Provisioning & Sync
              </h2>
            </div>

            {/* SCIM Settings */}
            <ScimSettings
              organizationId={organizationId}
              scimEndpointUrl={scimEndpointUrl}
              existingToken={initialScimToken}
              onGenerateToken={handleGenerateToken}
              onRevokeToken={handleRevokeToken}
            />

            {/* Directory Sync */}
            <DirectorySyncPanel
              organizationId={organizationId}
              initialStatus={initialSyncStatus}
              onToggleSync={handleToggleSync}
              onTriggerSync={handleTriggerSync}
            />

            {/* Group Role Mapping */}
            {activeIdpId && (
              <GroupRoleMappingTable
                initialMapping={initialGroupRoleMapping}
                onSave={handleSaveMapping}
              />
            )}

            {/* Sync History */}
            <SyncHistoryLog
              initialEntries={initialSyncHistory}
              totalCount={syncHistoryTotal}
              onLoadMore={handleLoadMoreHistory}
              onRefresh={handleRefreshHistory}
            />
          </div>
        </>
      )}
    </div>
  );
}
