/**
 * Transaction Service Module
 * Re-exports the TransactionService singleton, standalone utilities, and types
 * for backward compatibility.
 * Consumers can continue importing from "services/transactionService".
 */

export { default } from "./transactionService";
export { getEarliestCommunicationDate } from "./getEarliestCommunicationDate";
export type { AuditedTransactionData, TransactionWithDetails } from "./types";
