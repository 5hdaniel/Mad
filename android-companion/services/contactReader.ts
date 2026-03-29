/**
 * Contact Reader Service (Android Companion)
 * Reads contacts from the Android device using expo-contacts.
 *
 * BACKLOG-1449: Sync Android contacts to desktop via companion app
 *
 * Uses expo-contacts to query the Android Contacts content provider.
 * Reads: name, phone numbers, email addresses, company, title.
 * Returns contacts formatted as SyncContact for transmission to the desktop.
 */

import * as Contacts from "expo-contacts";
import type { SyncContact, ContactPhone, ContactEmail } from "../types/contacts";

/**
 * Read all contacts from the Android device.
 *
 * Requests the minimal fields needed for sync (name, phone, email,
 * company, title) to avoid reading unnecessary data like photos.
 *
 * @returns Array of SyncContact objects ready for syncing
 */
export async function readContacts(): Promise<SyncContact[]> {
  const { status } = await Contacts.getPermissionsAsync();

  if (status !== "granted") {
    console.log("[ContactReader] Contacts permission not granted");
    return [];
  }

  console.log("[ContactReader] Reading contacts from device...");

  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.Company,
      Contacts.Fields.JobTitle,
    ],
  });

  if (!data || data.length === 0) {
    console.log("[ContactReader] No contacts found on device");
    return [];
  }

  const contacts = data
    .filter((c) => c.name && c.name.trim().length > 0)
    .map((c) => mapToSyncContact(c));

  console.log(
    `[ContactReader] Read ${data.length} raw contacts -> ${contacts.length} with names`
  );

  return contacts;
}

/**
 * Map an expo-contacts Contact to our SyncContact format.
 */
function mapToSyncContact(contact: Contacts.Contact): SyncContact {
  const phones: ContactPhone[] = (contact.phoneNumbers ?? [])
    .filter((p) => p.number != null && p.number.trim().length > 0)
    .map((p) => ({
      number: p.number!,
      label: p.label ?? undefined,
    }));

  const emails: ContactEmail[] = (contact.emails ?? [])
    .filter((e) => e.email != null && e.email.trim().length > 0)
    .map((e) => ({
      address: e.email!,
      label: e.label ?? undefined,
    }));

  return {
    id: contact.id,
    displayName: contact.name ?? "",
    phones,
    emails,
    company: contact.company ?? undefined,
    title: contact.jobTitle ?? undefined,
  };
}
