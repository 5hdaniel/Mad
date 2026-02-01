/**
 * Mock for mammoth.js
 * TASK-1783: Mock for testing DOCX preview functionality
 */

const mammoth = {
  convertToHtml: async (options) => {
    // Return mock HTML content
    return {
      value: '<p>Mock DOCX content converted to HTML</p>',
      messages: [],
    };
  },

  extractRawText: async (options) => {
    return {
      value: 'Mock DOCX text content',
      messages: [],
    };
  },
};

// Export as default for ES module compatibility
module.exports = mammoth;
module.exports.default = mammoth;
