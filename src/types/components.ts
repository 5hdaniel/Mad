/**
 * React Component Types for Magic Audit
 * These types are used throughout the React frontend
 */

import type { ReactNode } from 'react';
import type {
  User,
  Contact,
  Transaction,
  Communication,
  TransactionType,
  
  
  ExportFormat,
  CommunicationType,
  OAuthProvider,
} from '../../electron/types/models';

// ============================================
// COMMON COMPONENT PROPS
// ============================================

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadingProps {
  loading?: boolean;
  loadingText?: string;
}

export interface ErrorProps {
  error?: string | null;
  onErrorDismiss?: () => void;
}

// ============================================
// TRANSACTION COMPONENT PROPS
// ============================================

export interface TransactionListProps extends BaseComponentProps, LoadingProps, ErrorProps {
  transactions: Transaction[];
  selectedTransactionId?: string;
  onSelectTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transactionId: string) => void;
  onExportTransaction?: (transactionId: string, format: ExportFormat) => void;
}

export interface TransactionDetailsProps extends BaseComponentProps, LoadingProps, ErrorProps {
  transaction: Transaction | null;
  contacts?: Contact[];
  communications?: Communication[];
  onUpdateTransaction?: (transactionId: string, updates: Partial<Transaction>) => void;
  onLinkContact?: (transactionId: string, contactId: string, role?: string) => void;
  onUnlinkContact?: (transactionId: string, contactId: string) => void;
  onExport?: (format: ExportFormat) => void;
}

export interface TransactionFormProps extends BaseComponentProps {
  transaction?: Transaction;
  userId: string;
  onSubmit: (transactionData: Partial<Transaction>) => void;
  onCancel?: () => void;
}

export interface TransactionCardProps extends BaseComponentProps {
  transaction: Transaction;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onExport?: (format: ExportFormat) => void;
}

// ============================================
// CONTACT COMPONENT PROPS
// ============================================

export interface ContactListProps extends BaseComponentProps, LoadingProps, ErrorProps {
  contacts: Contact[];
  selectedContactId?: string;
  onSelectContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string) => void;
  onCreateContact?: () => void;
}

export interface ContactDetailsProps extends BaseComponentProps, LoadingProps, ErrorProps {
  contact: Contact | null;
  transactions?: Transaction[];
  onUpdateContact?: (contactId: string, updates: Partial<Contact>) => void;
  onDeleteContact?: (contactId: string) => void;
}

export interface ContactFormProps extends BaseComponentProps {
  contact?: Contact;
  userId: string;
  onSubmit: (contactData: Partial<Contact>) => void;
  onCancel?: () => void;
}

export interface ContactCardProps extends BaseComponentProps {
  contact: Contact;
  selected?: boolean;
  onClick?: () => void;
  showEmail?: boolean;
  showPhone?: boolean;
}

// ============================================
// COMMUNICATION COMPONENT PROPS
// ============================================

export interface ConversationListProps extends BaseComponentProps, LoadingProps, ErrorProps {
  communications: Communication[];
  selectedCommunicationId?: string;
  onSelectCommunication?: (communication: Communication) => void;
  filter?: {
    type?: CommunicationType;
    dateRange?: { start: Date; end: Date };
  };
}

export interface EmailViewProps extends BaseComponentProps {
  communication: Communication;
  onClose?: () => void;
}

export interface CommunicationFilterProps extends BaseComponentProps {
  onFilterChange: (filter: {
    type?: CommunicationType;
    dateRange?: { start: Date; end: Date };
    hasAttachments?: boolean;
  }) => void;
}

// ============================================
// DASHBOARD COMPONENT PROPS
// ============================================

export interface DashboardProps extends BaseComponentProps {
  user: User;
}

export interface DashboardStats {
  totalTransactions: number;
  activeTransactions: number;
  totalContacts: number;
  totalCommunications: number;
  recentActivity: Array<{
    type: 'transaction' | 'contact' | 'communication';
    id: string;
    description: string;
    timestamp: Date | string;
  }>;
}

export interface DashboardStatsProps extends BaseComponentProps {
  stats: DashboardStats;
  loading?: boolean;
}

// ============================================
// FORM COMPONENTS
// ============================================

export interface InputFieldProps {
  label: string;
  name: string;
  value: string | number;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'password';
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
}

export interface SelectFieldProps<T = string> {
  label: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export interface TextAreaFieldProps {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  rows?: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export interface DatePickerProps {
  label: string;
  value: Date | string | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

// ============================================
// MODAL COMPONENTS
// ============================================

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closeOnOverlayClick?: boolean;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger' | 'warning';
}

// ============================================
// BUTTON COMPONENTS
// ============================================

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  icon?: ReactNode;
}

// ============================================
// SETTINGS COMPONENT PROPS
// ============================================

export interface SettingsProps extends BaseComponentProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

export interface ConnectionStatusProps {
  provider: OAuthProvider;
  connected: boolean;
  email?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

// ============================================
// EXPORT COMPONENT PROPS
// ============================================

export interface ExportOptionsProps {
  transactionId: string;
  onExport: (format: ExportFormat, options: ExportOptions) => void;
  onCancel?: () => void;
}

export interface ExportOptions {
  format: ExportFormat;
  includeAttachments: boolean;
  includeEmails: boolean;
  includeTexts: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportProgressProps {
  progress: number;
  status: string;
  onCancel?: () => void;
}

// ============================================
// TOAST/NOTIFICATION TYPES
// ============================================

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastProps extends BaseComponentProps {
  message: string;
  variant: ToastVariant;
  onClose: () => void;
  duration?: number;
}

// ============================================
// SIDEBAR/NAVIGATION TYPES
// ============================================

export interface SidebarProps extends BaseComponentProps {
  user: User;
  activePath: string;
  onNavigate: (path: string) => void;
}

export interface NavigationItem {
  path: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

// ============================================
// TABLE TYPES
// ============================================

export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T = unknown> extends BaseComponentProps {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedRowKey?: string;
  loading?: boolean;
  emptyMessage?: string;
}

// ============================================
// TOUR/ONBOARDING TYPES
// ============================================

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disableBeacon?: boolean;
}

export interface TourProps {
  steps: TourStep[];
  run: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}
