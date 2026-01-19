/**
 * Call Logs Service
 * Manages call log operations for compliance audit packages.
 * Provides CRUD operations and filtering for phone call history.
 */

import crypto from "crypto";
import databaseService from "./databaseService";
import logService from "./logService";
import type {
  CallLog,
  NewCallLog,
  UpdateCallLog,
  CallLogFilters,
  CallLogWithContacts,
  Contact,
} from "../types/models";

/**
 * Database row representation of a call log entry
 */
interface CallLogDbRow {
  id: string;
  user_id: string;
  transaction_id: string | null;
  external_id: string | null;
  source: string;
  caller_phone_e164: string | null;
  caller_phone_display: string | null;
  caller_name: string | null;
  caller_contact_id: string | null;
  recipient_phone_e164: string | null;
  recipient_phone_display: string | null;
  recipient_name: string | null;
  recipient_contact_id: string | null;
  direction: string | null;
  call_type: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  answered: number;
  outcome: string | null;
  voicemail_path: string | null;
  voicemail_duration_seconds: number | null;
  is_transaction_related: number | null;
  classification_confidence: number | null;
  classification_method: string | null;
  classified_at: string | null;
  notes: string | null;
  summary: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a database row to a CallLog object
 */
function rowToCallLog(row: CallLogDbRow): CallLog {
  return {
    id: row.id,
    user_id: row.user_id,
    transaction_id: row.transaction_id ?? undefined,
    external_id: row.external_id ?? undefined,
    source: row.source as CallLog["source"],
    caller_phone_e164: row.caller_phone_e164 ?? undefined,
    caller_phone_display: row.caller_phone_display ?? undefined,
    caller_name: row.caller_name ?? undefined,
    caller_contact_id: row.caller_contact_id ?? undefined,
    recipient_phone_e164: row.recipient_phone_e164 ?? undefined,
    recipient_phone_display: row.recipient_phone_display ?? undefined,
    recipient_name: row.recipient_name ?? undefined,
    recipient_contact_id: row.recipient_contact_id ?? undefined,
    direction: row.direction as CallLog["direction"],
    call_type: row.call_type as CallLog["call_type"],
    started_at: row.started_at ?? undefined,
    ended_at: row.ended_at ?? undefined,
    duration_seconds: row.duration_seconds,
    answered: row.answered === 1,
    outcome: row.outcome as CallLog["outcome"],
    voicemail_path: row.voicemail_path ?? undefined,
    voicemail_duration_seconds: row.voicemail_duration_seconds ?? undefined,
    is_transaction_related:
      row.is_transaction_related === null
        ? undefined
        : row.is_transaction_related === 1,
    classification_confidence: row.classification_confidence ?? undefined,
    classification_method: row.classification_method as CallLog["classification_method"],
    classified_at: row.classified_at ?? undefined,
    notes: row.notes ?? undefined,
    summary: row.summary ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class CallLogsService {
  /**
   * Create a new call log entry
   */
  async create(callLog: NewCallLog): Promise<CallLog> {
    const db = databaseService.getRawDatabase();
    const id = crypto.randomUUID();

    try {
      const stmt = db.prepare(`
        INSERT INTO call_logs (
          id, user_id, transaction_id, external_id, source,
          caller_phone_e164, caller_phone_display, caller_name, caller_contact_id,
          recipient_phone_e164, recipient_phone_display, recipient_name, recipient_contact_id,
          direction, call_type, started_at, ended_at, duration_seconds, answered,
          outcome, voicemail_path, voicemail_duration_seconds,
          is_transaction_related, classification_confidence, classification_method, classified_at,
          notes, summary, metadata
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `);

      stmt.run(
        id,
        callLog.user_id,
        callLog.transaction_id ?? null,
        callLog.external_id ?? null,
        callLog.source,
        callLog.caller_phone_e164 ?? null,
        callLog.caller_phone_display ?? null,
        callLog.caller_name ?? null,
        callLog.caller_contact_id ?? null,
        callLog.recipient_phone_e164 ?? null,
        callLog.recipient_phone_display ?? null,
        callLog.recipient_name ?? null,
        callLog.recipient_contact_id ?? null,
        callLog.direction ?? null,
        callLog.call_type,
        callLog.started_at ?? null,
        callLog.ended_at ?? null,
        callLog.duration_seconds ?? 0,
        callLog.answered ? 1 : 0,
        callLog.outcome ?? null,
        callLog.voicemail_path ?? null,
        callLog.voicemail_duration_seconds ?? null,
        callLog.is_transaction_related === undefined
          ? null
          : callLog.is_transaction_related
            ? 1
            : 0,
        callLog.classification_confidence ?? null,
        callLog.classification_method ?? null,
        callLog.classified_at ?? null,
        callLog.notes ?? null,
        callLog.summary ?? null,
        callLog.metadata ?? null,
      );

      const created = await this.getById(id);
      if (!created) {
        throw new Error("Failed to retrieve created call log");
      }

      logService.info("Call log created", "CallLogsService", {
        id,
        userId: callLog.user_id,
        direction: callLog.direction,
      });

      return created;
    } catch (error) {
      logService.error("Failed to create call log", "CallLogsService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a call log by ID
   */
  async getById(id: string): Promise<CallLog | null> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare("SELECT * FROM call_logs WHERE id = ?");
      const row = stmt.get(id) as CallLogDbRow | undefined;

      if (!row) {
        return null;
      }

      return rowToCallLog(row);
    } catch (error) {
      logService.error("Failed to get call log by ID", "CallLogsService", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all call logs for a user
   */
  async getByUserId(userId: string): Promise<CallLog[]> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare(
        "SELECT * FROM call_logs WHERE user_id = ? ORDER BY started_at DESC",
      );
      const rows = stmt.all(userId) as CallLogDbRow[];

      return rows.map(rowToCallLog);
    } catch (error) {
      logService.error("Failed to get call logs by user ID", "CallLogsService", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all call logs for a transaction
   */
  async getByTransactionId(transactionId: string): Promise<CallLog[]> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare(
        "SELECT * FROM call_logs WHERE transaction_id = ? ORDER BY started_at DESC",
      );
      const rows = stmt.all(transactionId) as CallLogDbRow[];

      return rows.map(rowToCallLog);
    } catch (error) {
      logService.error("Failed to get call logs by transaction ID", "CallLogsService", {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get call logs with contact details
   */
  async getWithContacts(userId: string): Promise<CallLogWithContacts[]> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare(`
        SELECT
          cl.*,
          cc.id as caller_c_id, cc.display_name as caller_c_name, cc.company as caller_c_company,
          rc.id as recipient_c_id, rc.display_name as recipient_c_name, rc.company as recipient_c_company
        FROM call_logs cl
        LEFT JOIN contacts cc ON cl.caller_contact_id = cc.id
        LEFT JOIN contacts rc ON cl.recipient_contact_id = rc.id
        WHERE cl.user_id = ?
        ORDER BY cl.started_at DESC
      `);

      const rows = stmt.all(userId) as (CallLogDbRow & {
        caller_c_id?: string;
        caller_c_name?: string;
        caller_c_company?: string;
        recipient_c_id?: string;
        recipient_c_name?: string;
        recipient_c_company?: string;
      })[];

      return rows.map((row) => {
        const callLog = rowToCallLog(row);
        const result: CallLogWithContacts = {
          ...callLog,
        };

        if (row.caller_c_id) {
          result.caller_contact = {
            id: row.caller_c_id,
            display_name: row.caller_c_name,
            company: row.caller_c_company,
          } as Contact;
        }

        if (row.recipient_c_id) {
          result.recipient_contact = {
            id: row.recipient_c_id,
            display_name: row.recipient_c_name,
            company: row.recipient_c_company,
          } as Contact;
        }

        return result;
      });
    } catch (error) {
      logService.error("Failed to get call logs with contacts", "CallLogsService", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get call logs with filters
   */
  async getFiltered(filters: CallLogFilters): Promise<CallLog[]> {
    const db = databaseService.getRawDatabase();

    try {
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      if (filters.user_id) {
        conditions.push("user_id = ?");
        params.push(filters.user_id);
      }

      if (filters.transaction_id) {
        conditions.push("transaction_id = ?");
        params.push(filters.transaction_id);
      }

      if (filters.direction) {
        conditions.push("direction = ?");
        params.push(filters.direction);
      }

      if (filters.call_type) {
        conditions.push("call_type = ?");
        params.push(filters.call_type);
      }

      if (filters.outcome) {
        conditions.push("outcome = ?");
        params.push(filters.outcome);
      }

      if (filters.is_transaction_related !== undefined) {
        conditions.push("is_transaction_related = ?");
        params.push(filters.is_transaction_related ? 1 : 0);
      }

      if (filters.start_date) {
        conditions.push("started_at >= ?");
        params.push(
          typeof filters.start_date === "string"
            ? filters.start_date
            : filters.start_date.toISOString(),
        );
      }

      if (filters.end_date) {
        conditions.push("started_at <= ?");
        params.push(
          typeof filters.end_date === "string"
            ? filters.end_date
            : filters.end_date.toISOString(),
        );
      }

      if (filters.caller_phone) {
        conditions.push("(caller_phone_e164 LIKE ? OR caller_phone_display LIKE ?)");
        const phonePattern = `%${filters.caller_phone}%`;
        params.push(phonePattern, phonePattern);
      }

      if (filters.recipient_phone) {
        conditions.push("(recipient_phone_e164 LIKE ? OR recipient_phone_display LIKE ?)");
        const phonePattern = `%${filters.recipient_phone}%`;
        params.push(phonePattern, phonePattern);
      }

      if (filters.contact_id) {
        conditions.push("(caller_contact_id = ? OR recipient_contact_id = ?)");
        params.push(filters.contact_id, filters.contact_id);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const stmt = db.prepare(
        `SELECT * FROM call_logs ${whereClause} ORDER BY started_at DESC`,
      );
      const rows = stmt.all(...params) as CallLogDbRow[];

      return rows.map(rowToCallLog);
    } catch (error) {
      logService.error("Failed to get filtered call logs", "CallLogsService", {
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update a call log entry
   */
  async update(callLogUpdate: UpdateCallLog): Promise<CallLog> {
    const db = databaseService.getRawDatabase();
    const { id, ...updates } = callLogUpdate;

    try {
      // Build dynamic update query
      const setClauses: string[] = [];
      const params: (string | number | null)[] = [];

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          if (key === "answered" || key === "is_transaction_related") {
            params.push(value ? 1 : 0);
          } else {
            params.push(value as string | number | null);
          }
        }
      }

      if (setClauses.length === 0) {
        const existing = await this.getById(id);
        if (!existing) {
          throw new Error(`Call log not found: ${id}`);
        }
        return existing;
      }

      params.push(id);

      const stmt = db.prepare(
        `UPDATE call_logs SET ${setClauses.join(", ")} WHERE id = ?`,
      );
      stmt.run(...params);

      const updated = await this.getById(id);
      if (!updated) {
        throw new Error(`Call log not found after update: ${id}`);
      }

      logService.info("Call log updated", "CallLogsService", { id });

      return updated;
    } catch (error) {
      logService.error("Failed to update call log", "CallLogsService", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete a call log entry
   */
  async delete(id: string): Promise<boolean> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare("DELETE FROM call_logs WHERE id = ?");
      const result = stmt.run(id);

      const deleted = result.changes > 0;

      if (deleted) {
        logService.info("Call log deleted", "CallLogsService", { id });
      }

      return deleted;
    } catch (error) {
      logService.error("Failed to delete call log", "CallLogsService", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Link a call log to a transaction
   */
  async linkToTransaction(callLogId: string, transactionId: string): Promise<CallLog> {
    return this.update({
      id: callLogId,
      transaction_id: transactionId,
      is_transaction_related: true,
    });
  }

  /**
   * Unlink a call log from a transaction
   */
  async unlinkFromTransaction(callLogId: string): Promise<CallLog> {
    return this.update({
      id: callLogId,
      transaction_id: undefined,
      is_transaction_related: false,
    });
  }

  /**
   * Get call log statistics for a user
   */
  async getStats(userId: string): Promise<{
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    missedCalls: number;
    totalDuration: number;
    transactionRelatedCalls: number;
  }> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare(`
        SELECT
          COUNT(*) as total_calls,
          SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_calls,
          SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_calls,
          SUM(CASE WHEN direction = 'missed' OR outcome = 'missed' THEN 1 ELSE 0 END) as missed_calls,
          SUM(duration_seconds) as total_duration,
          SUM(CASE WHEN is_transaction_related = 1 THEN 1 ELSE 0 END) as transaction_related_calls
        FROM call_logs
        WHERE user_id = ?
      `);

      const row = stmt.get(userId) as {
        total_calls: number;
        inbound_calls: number;
        outbound_calls: number;
        missed_calls: number;
        total_duration: number;
        transaction_related_calls: number;
      };

      return {
        totalCalls: row.total_calls || 0,
        inboundCalls: row.inbound_calls || 0,
        outboundCalls: row.outbound_calls || 0,
        missedCalls: row.missed_calls || 0,
        totalDuration: row.total_duration || 0,
        transactionRelatedCalls: row.transaction_related_calls || 0,
      };
    } catch (error) {
      logService.error("Failed to get call log stats", "CallLogsService", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get call log count for a transaction (for audit packages)
   */
  async getCountForTransaction(transactionId: string): Promise<number> {
    const db = databaseService.getRawDatabase();

    try {
      const stmt = db.prepare(
        "SELECT COUNT(*) as count FROM call_logs WHERE transaction_id = ?",
      );
      const row = stmt.get(transactionId) as { count: number };

      return row.count;
    } catch (error) {
      logService.error("Failed to get call log count", "CallLogsService", {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Bulk create call logs (for imports)
   */
  async bulkCreate(callLogs: NewCallLog[]): Promise<number> {
    const db = databaseService.getRawDatabase();

    try {
      const insert = db.prepare(`
        INSERT INTO call_logs (
          id, user_id, transaction_id, external_id, source,
          caller_phone_e164, caller_phone_display, caller_name, caller_contact_id,
          recipient_phone_e164, recipient_phone_display, recipient_name, recipient_contact_id,
          direction, call_type, started_at, ended_at, duration_seconds, answered,
          outcome, voicemail_path, voicemail_duration_seconds,
          is_transaction_related, classification_confidence, classification_method, classified_at,
          notes, summary, metadata
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `);

      const insertMany = db.transaction((logs: NewCallLog[]) => {
        let count = 0;
        for (const log of logs) {
          const id = crypto.randomUUID();
          insert.run(
            id,
            log.user_id,
            log.transaction_id ?? null,
            log.external_id ?? null,
            log.source,
            log.caller_phone_e164 ?? null,
            log.caller_phone_display ?? null,
            log.caller_name ?? null,
            log.caller_contact_id ?? null,
            log.recipient_phone_e164 ?? null,
            log.recipient_phone_display ?? null,
            log.recipient_name ?? null,
            log.recipient_contact_id ?? null,
            log.direction ?? null,
            log.call_type,
            log.started_at ?? null,
            log.ended_at ?? null,
            log.duration_seconds ?? 0,
            log.answered ? 1 : 0,
            log.outcome ?? null,
            log.voicemail_path ?? null,
            log.voicemail_duration_seconds ?? null,
            log.is_transaction_related === undefined
              ? null
              : log.is_transaction_related
                ? 1
                : 0,
            log.classification_confidence ?? null,
            log.classification_method ?? null,
            log.classified_at ?? null,
            log.notes ?? null,
            log.summary ?? null,
            log.metadata ?? null,
          );
          count++;
        }
        return count;
      });

      const count = insertMany(callLogs);

      logService.info("Bulk created call logs", "CallLogsService", {
        count,
      });

      return count;
    } catch (error) {
      logService.error("Failed to bulk create call logs", "CallLogsService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const callLogsService = new CallLogsService();
export default callLogsService;
