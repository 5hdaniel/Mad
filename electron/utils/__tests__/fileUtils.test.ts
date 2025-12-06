/**
 * Unit tests for File Utilities
 */

import {
  sanitizeFilename,
  sanitizeFilenamePreserveCase,
  createTimestampedFilename,
  ensureUniqueFilename,
} from '../fileUtils';

describe('fileUtils', () => {
  describe('sanitizeFilename', () => {
    it('should return "unnamed" for null input', () => {
      expect(sanitizeFilename(null)).toBe('unnamed');
    });

    it('should return "unnamed" for undefined input', () => {
      expect(sanitizeFilename(undefined)).toBe('unnamed');
    });

    it('should return "unnamed" for empty string', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeFilename('TestFile')).toBe('testfile');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('test file')).toBe('test_file');
    });

    it('should preserve spaces when preserveSpaces is true', () => {
      expect(sanitizeFilename('test file', true)).toBe('test file');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilename('test@file#name!')).toBe('test_file_name_');
    });

    it('should handle multiple consecutive special characters', () => {
      expect(sanitizeFilename('test!!!file')).toBe('test___file');
    });

    it('should preserve numbers', () => {
      expect(sanitizeFilename('file123')).toBe('file123');
    });

    it('should handle complex filenames', () => {
      expect(sanitizeFilename('My Document (Final) - 2024.pdf')).toBe(
        'my_document__final____2024_pdf'
      );
    });
  });

  describe('sanitizeFilenamePreserveCase', () => {
    it('should return "unnamed" for null input', () => {
      expect(sanitizeFilenamePreserveCase(null)).toBe('unnamed');
    });

    it('should return "unnamed" for undefined input', () => {
      expect(sanitizeFilenamePreserveCase(undefined)).toBe('unnamed');
    });

    it('should preserve original casing', () => {
      expect(sanitizeFilenamePreserveCase('TestFile')).toBe('TestFile');
    });

    it('should preserve spaces by default', () => {
      expect(sanitizeFilenamePreserveCase('Test File')).toBe('Test File');
    });

    it('should replace spaces when preserveSpaces is false', () => {
      expect(sanitizeFilenamePreserveCase('Test File', false)).toBe('Test_File');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilenamePreserveCase('Test@File#Name!')).toBe('Test_File_Name_');
    });

    it('should preserve numbers', () => {
      expect(sanitizeFilenamePreserveCase('File123')).toBe('File123');
    });

    it('should handle complex filenames', () => {
      expect(sanitizeFilenamePreserveCase('My Document (Final).pdf')).toBe(
        'My Document _Final__pdf'
      );
    });
  });

  describe('createTimestampedFilename', () => {
    it('should create filename with timestamp', () => {
      const before = Date.now();
      const result = createTimestampedFilename('myfile', 'txt');
      const after = Date.now();

      // Should match pattern: myfile_[timestamp].txt
      const match = result.match(/^myfile_(\d+)\.txt$/);
      expect(match).not.toBeNull();

      if (match) {
        const timestamp = parseInt(match[1], 10);
        expect(timestamp).toBeGreaterThanOrEqual(before);
        expect(timestamp).toBeLessThanOrEqual(after);
      }
    });

    it('should sanitize the base name', () => {
      const result = createTimestampedFilename('My File!', 'pdf');

      // Should have sanitized name
      expect(result).toMatch(/^my_file__\d+\.pdf$/);
    });

    it('should use correct extension', () => {
      const result = createTimestampedFilename('document', 'docx');

      expect(result).toMatch(/\.docx$/);
    });

    it('should handle empty base name', () => {
      const result = createTimestampedFilename('', 'txt');

      // Empty string becomes 'unnamed'
      expect(result).toMatch(/^unnamed_\d+\.txt$/);
    });
  });

  describe('ensureUniqueFilename', () => {
    it('should return original filename if it does not exist', async () => {
      const checkExists = jest.fn().mockResolvedValue(false);

      const result = await ensureUniqueFilename('myfile', 'txt', checkExists);

      expect(result).toBe('myfile.txt');
      expect(checkExists).toHaveBeenCalledWith('myfile.txt');
      expect(checkExists).toHaveBeenCalledTimes(1);
    });

    it('should append counter when file exists', async () => {
      const checkExists = jest
        .fn()
        .mockResolvedValueOnce(true) // myfile.txt exists
        .mockResolvedValueOnce(false); // myfile_1.txt does not exist

      const result = await ensureUniqueFilename('myfile', 'txt', checkExists);

      expect(result).toBe('myfile_1.txt');
      expect(checkExists).toHaveBeenCalledTimes(2);
    });

    it('should increment counter until unique', async () => {
      const checkExists = jest
        .fn()
        .mockResolvedValueOnce(true) // myfile.txt
        .mockResolvedValueOnce(true) // myfile_1.txt
        .mockResolvedValueOnce(true) // myfile_2.txt
        .mockResolvedValueOnce(false); // myfile_3.txt does not exist

      const result = await ensureUniqueFilename('myfile', 'txt', checkExists);

      expect(result).toBe('myfile_3.txt');
      expect(checkExists).toHaveBeenCalledTimes(4);
    });

    it('should sanitize the base name', async () => {
      const checkExists = jest.fn().mockResolvedValue(false);

      const result = await ensureUniqueFilename('My File!', 'pdf', checkExists);

      expect(result).toBe('my_file_.pdf');
    });

    it('should use correct extension', async () => {
      const checkExists = jest.fn().mockResolvedValue(false);

      const result = await ensureUniqueFilename('document', 'docx', checkExists);

      expect(result).toBe('document.docx');
    });
  });
});
