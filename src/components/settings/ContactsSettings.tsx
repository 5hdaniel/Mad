import React, { useState } from "react";
import { ContactsImportSettings } from "./MacOSContactsImportSettings";
import { settingsService } from '../../services';
import type { PreferencesResult } from './types';

interface ContactsSettingsProps {
  userId: string;
  initialPreferences: PreferencesResult['preferences'];
  isMicrosoftConnected: boolean;
  isGoogleConnected: boolean;
}

export function ContactsSettings({
  userId,
  initialPreferences,
  isMicrosoftConnected,
  isGoogleConnected,
}: ContactsSettingsProps) {
  // Contact source preferences - direct imports
  const [outlookContactsEnabled, setOutlookContactsEnabled] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.direct?.outlookContacts;
    return typeof val === "boolean" ? val : true;
  });
  const [gmailContactsEnabled, setGmailContactsEnabled] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.direct?.gmailContacts;
    return typeof val === "boolean" ? val : true;
  });
  // TASK-2303: Google Contacts toggle (backed by googleContacts preference key)
  const [googleContactsEnabled, setGoogleContactsEnabled] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.direct?.googleContacts;
    return typeof val === "boolean" ? val : true;
  });
  const [macosContactsEnabled, setMacosContactsEnabled] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.direct?.macosContacts;
    return typeof val === "boolean" ? val : true;
  });
  // Contact source preferences - inferred from conversations
  const [outlookEmailsInferred, setOutlookEmailsInferred] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.inferred?.outlookEmails;
    return typeof val === "boolean" ? val : false;
  });
  const [gmailEmailsInferred, setGmailEmailsInferred] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.inferred?.gmailEmails;
    return typeof val === "boolean" ? val : false;
  });
  const [messagesInferred, setMessagesInferred] = useState<boolean>(() => {
    const val = initialPreferences?.contactSources?.inferred?.messages;
    return typeof val === "boolean" ? val : false;
  });

  const handleContactSourceToggle = async (
    category: "direct" | "inferred",
    key: string,
    currentValue: boolean,
  ): Promise<void> => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
      outlookContacts: setOutlookContactsEnabled,
      macosContacts: setMacosContactsEnabled,
      gmailContacts: setGmailContactsEnabled,
      googleContacts: setGoogleContactsEnabled,
      outlookEmails: setOutlookEmailsInferred,
      gmailEmails: setGmailEmailsInferred,
      messages: setMessagesInferred,
    };
    const newValue = !currentValue;
    setters[key](newValue);
    try {
      await settingsService.updatePreferences(userId, {
        contactSources: { [category]: { [key]: newValue } },
      });
    } catch {
      // Silently handle
    }
  };

  return (
    <div id="settings-contacts" className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>
      <div className="space-y-4">
        <ContactsImportSettings
          userId={userId}
          isMicrosoftConnected={isMicrosoftConnected}
          isGoogleConnected={isGoogleConnected}
          outlookContactsEnabled={outlookContactsEnabled}
          macosContactsEnabled={macosContactsEnabled}
          gmailContactsEnabled={gmailContactsEnabled}
          googleContactsEnabled={googleContactsEnabled}
          outlookEmailsInferred={outlookEmailsInferred}
          gmailEmailsInferred={gmailEmailsInferred}
          messagesInferred={messagesInferred}
          loadingPreferences={false}
          onToggleSource={(category, key, currentValue) => {
            handleContactSourceToggle(category, key, currentValue);
          }}
        />
      </div>
    </div>
  );
}
