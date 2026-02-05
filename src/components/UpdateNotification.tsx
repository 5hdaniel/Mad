import { useState, useEffect } from "react";

interface UpdateInfo {
  version: string;
}

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Listen for update events
    if (window.api?.update?.onAvailable) {
      window.api.update.onAvailable((info) => {
        setUpdateAvailable(true);
        setUpdateInfo(info as UpdateInfo);
      });
    }

    if (window.api?.update?.onProgress) {
      window.api.update.onProgress((progress) => {
        setDownloadProgress(Math.round((progress as { percent: number }).percent));
      });
    }

    if (window.api?.update?.onDownloaded) {
      window.api.update.onDownloaded(() => {
        setUpdateDownloaded(true);
      });
    }
  }, []);

  const handleInstall = () => {
    if (window.api?.update?.install) {
      window.api.update.install();
    }
  };

  const handleDismiss = () => {
    setUpdateDownloaded(false);
    setUpdateAvailable(false);
  };

  // BACKLOG-610: Use z-[110] to ensure visibility above all modals and toasts (z-[100])
  if (updateDownloaded) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-sm z-[110]">
        <h3 className="font-bold text-lg mb-2">Update Ready!</h3>
        <p className="text-sm mb-3">
          Version {updateInfo?.version} has been downloaded and is ready to
          install.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 bg-white text-green-500 px-4 py-2 rounded font-medium hover:bg-green-50 transition-colors"
          >
            Restart & Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-sm z-[110]">
        <h3 className="font-bold text-lg mb-2">Downloading Update...</h3>
        <p className="text-sm mb-3">Version {updateInfo?.version}</p>
        <div className="w-full bg-white/30 rounded-full h-2 mb-2">
          <div
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
        <p className="text-sm text-right">{downloadProgress}%</p>
      </div>
    );
  }

  return null;
}
