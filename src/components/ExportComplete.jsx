import React from 'react';

function ExportComplete({ result, onStartOver }) {
  return (
    <div className="flex items-center justify-center min-h-full py-8">
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Export Complete!</h1>

        <p className="text-gray-600 mb-6">
          Your conversations have been successfully exported
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 text-left">
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Export Location:</span>
            </div>
            <div className="bg-white px-3 py-2 rounded border border-gray-200">
              <code className="text-sm text-gray-800 break-all">{result.exportPath}</code>
            </div>

            <div className="flex justify-between items-center pt-3 pb-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Files Created:</span>
              <span className="text-sm text-gray-600">{result.filesCreated.length}</span>
            </div>

            <div className="space-y-2">
              {result.filesCreated.map((fileName, index) => (
                <div key={index} className="flex items-center bg-white px-3 py-2 rounded border border-gray-200">
                  <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate">{fileName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              // Open the folder in Finder
              window.electron.exportConversations([]);
            }}
            className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Open Folder
          </button>

          <button
            onClick={onStartOver}
            className="flex-1 bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Export More
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Your exported files are ready to upload to your document management system
        </p>
      </div>
    </div>
  );
}

export default ExportComplete;
