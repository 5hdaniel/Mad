/**
 * Mock for react-pdf
 * TASK-1783: Mock for testing PDF preview functionality
 */

const React = require('react');

// Mock pdfjs with version for worker URL
const pdfjs = {
  version: '3.11.174',
  GlobalWorkerOptions: {
    workerSrc: '',
  },
};

// Mock Document component
const Document = ({ children, onLoadSuccess, onLoadError, file, loading, error, className }) => {
  // Simulate successful load after mounting
  React.useEffect(() => {
    if (file) {
      // Simulate async load
      setTimeout(() => {
        if (onLoadSuccess) {
          onLoadSuccess({ numPages: 3 }); // Mock 3 pages
        }
      }, 0);
    }
  }, [file, onLoadSuccess]);

  return React.createElement(
    'div',
    { 'data-testid': 'pdf-document', className },
    children
  );
};

// Mock Page component
const Page = ({ pageNumber, renderTextLayer, renderAnnotationLayer, className, width }) => {
  return React.createElement(
    'div',
    {
      'data-testid': 'pdf-page',
      'data-page-number': pageNumber,
      className,
    },
    `Page ${pageNumber}`
  );
};

module.exports = {
  Document,
  Page,
  pdfjs,
};
