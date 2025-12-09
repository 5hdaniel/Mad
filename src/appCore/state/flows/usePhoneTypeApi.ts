/**
 * usePhoneTypeApi Hook
 *
 * Handles phone type selection and persistence.
 * Checks:
 * - User's stored phone type from database
 * - Windows + iPhone driver setup requirements
 */

import { useState, useEffect } from "react";
import type { PhoneType } from "../types";

interface UsePhoneTypeApiOptions {
  userId: string | undefined;
  isWindows: boolean;
}

interface UsePhoneTypeApiReturn {
  hasSelectedPhoneType: boolean;
  selectedPhoneType: PhoneType;
  isLoadingPhoneType: boolean;
  needsDriverSetup: boolean;
  setHasSelectedPhoneType: (selected: boolean) => void;
  setSelectedPhoneType: (type: PhoneType) => void;
  setNeedsDriverSetup: (needs: boolean) => void;
  savePhoneType: (phoneType: "iphone" | "android") => Promise<boolean>;
}

export function usePhoneTypeApi({
  userId,
  isWindows,
}: UsePhoneTypeApiOptions): UsePhoneTypeApiReturn {
  const [hasSelectedPhoneType, setHasSelectedPhoneType] = useState<boolean>(false);
  const [selectedPhoneType, setSelectedPhoneType] = useState<PhoneType>(null);
  const [isLoadingPhoneType, setIsLoadingPhoneType] = useState<boolean>(true);
  const [needsDriverSetup, setNeedsDriverSetup] = useState<boolean>(false);

  // Load user's phone type from database when user logs in
  useEffect(() => {
    const loadPhoneType = async () => {
      if (userId) {
        setIsLoadingPhoneType(true);
        try {
          const userApi = window.api.user as {
            getPhoneType: (userId: string) => Promise<{
              success: boolean;
              phoneType: "iphone" | "android" | null;
              error?: string;
            }>;
          };
          const result = await userApi.getPhoneType(userId);
          if (result.success && result.phoneType) {
            setSelectedPhoneType(result.phoneType);

            // On Windows + iPhone, check if drivers need to be installed/updated
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const drivers = (window.electron as any)?.drivers;
            if (isWindows && result.phoneType === "iphone" && drivers) {
              try {
                const driverStatus = await drivers.checkApple();
                if (!driverStatus.installed || !driverStatus.serviceRunning) {
                  setNeedsDriverSetup(true);
                  setHasSelectedPhoneType(false);
                } else {
                  setNeedsDriverSetup(false);
                  setHasSelectedPhoneType(true);
                }
              } catch (driverError) {
                console.error("[usePhoneTypeApi] Failed to check driver status:", driverError);
                setNeedsDriverSetup(true);
                setHasSelectedPhoneType(false);
              }
            } else {
              setNeedsDriverSetup(false);
              setHasSelectedPhoneType(true);
            }
          } else {
            // No phone type stored - user needs to select
            setHasSelectedPhoneType(false);
            setSelectedPhoneType(null);
            setNeedsDriverSetup(false);
          }
        } catch (error) {
          console.error("[usePhoneTypeApi] Failed to load phone type:", error);
          setHasSelectedPhoneType(false);
          setSelectedPhoneType(null);
          setNeedsDriverSetup(false);
        } finally {
          setIsLoadingPhoneType(false);
        }
      } else {
        // No user logged in
        setIsLoadingPhoneType(false);
        setHasSelectedPhoneType(false);
        setSelectedPhoneType(null);
        setNeedsDriverSetup(false);
      }
    };
    loadPhoneType();
  }, [userId, isWindows]);

  // Save phone type to database
  const savePhoneType = async (phoneType: "iphone" | "android"): Promise<boolean> => {
    if (!userId) return false;

    try {
      const userApi = window.api.user as {
        setPhoneType: (
          userId: string,
          phoneType: "iphone" | "android",
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneType(userId, phoneType);
      if (result.success) {
        setSelectedPhoneType(phoneType);
        return true;
      } else {
        console.error("[usePhoneTypeApi] Failed to save phone type:", result.error);
        return false;
      }
    } catch (error) {
      console.error("[usePhoneTypeApi] Error saving phone type:", error);
      return false;
    }
  };

  return {
    hasSelectedPhoneType,
    selectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,
    setHasSelectedPhoneType,
    setSelectedPhoneType,
    setNeedsDriverSetup,
    savePhoneType,
  };
}
