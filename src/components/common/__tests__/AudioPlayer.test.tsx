/**
 * Tests for AudioPlayer component
 * Verifies audio playback rendering and error handling
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AudioPlayer } from "../AudioPlayer";

describe("AudioPlayer", () => {
  describe("rendering", () => {
    it("should render audio element with controls", () => {
      render(<AudioPlayer src="/path/to/audio.m4a" />);

      const audioPlayer = screen.getByTestId("audio-player");
      expect(audioPlayer).toBeInTheDocument();

      const audioElement = screen.getByTestId("audio-element");
      expect(audioElement).toBeInTheDocument();
      expect(audioElement).toHaveAttribute("controls");
    });

    it("should apply className prop", () => {
      render(<AudioPlayer src="/path/to/audio.m4a" className="mt-4 custom-class" />);

      const audioPlayer = screen.getByTestId("audio-player");
      expect(audioPlayer).toHaveClass("mt-4", "custom-class");
    });

    it("should set preload to metadata", () => {
      render(<AudioPlayer src="/path/to/audio.m4a" />);

      const audioElement = screen.getByTestId("audio-element");
      expect(audioElement).toHaveAttribute("preload", "metadata");
    });

    it("should render multiple source elements for format compatibility", () => {
      const { container } = render(<AudioPlayer src="/path/to/audio.m4a" />);

      const sources = container.querySelectorAll("source");
      expect(sources.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("file URL formatting", () => {
    it("should convert paths to file:// URLs", () => {
      const { container } = render(
        <AudioPlayer src="/Users/Test/audio.m4a" />
      );

      const source = container.querySelector("source");
      const srcAttr = source?.getAttribute("src") || "";
      // Should start with file:// protocol
      expect(srcAttr.startsWith("file://")).toBe(true);
      // Should contain the path
      expect(srcAttr).toContain("Users");
      expect(srcAttr).toContain("Test");
      expect(srcAttr).toContain("audio.m4a");
    });

    it("should preserve file:// URLs as-is", () => {
      const { container } = render(
        <AudioPlayer src="file:///path/to/audio.m4a" />
      );

      const source = container.querySelector("source");
      expect(source).toHaveAttribute("src", "file:///path/to/audio.m4a");
    });

    it("should preserve http URLs as-is", () => {
      const { container } = render(
        <AudioPlayer src="https://example.com/audio.mp3" />
      );

      const source = container.querySelector("source");
      expect(source).toHaveAttribute("src", "https://example.com/audio.mp3");
    });
  });

  describe("error handling", () => {
    it("should show error state when audio fails to load", () => {
      render(<AudioPlayer src="/invalid/path.m4a" />);

      const audioElement = screen.getByTestId("audio-element");
      fireEvent.error(audioElement);

      // Should show error message
      expect(screen.getByTestId("audio-player-error")).toBeInTheDocument();
      expect(screen.getByText("Audio unavailable")).toBeInTheDocument();
    });

    it("should have accessible error state", () => {
      render(<AudioPlayer src="/invalid/path.m4a" />);

      const audioElement = screen.getByTestId("audio-element");
      fireEvent.error(audioElement);

      const errorElement = screen.getByTestId("audio-player-error");
      expect(errorElement).toHaveAttribute("role", "alert");
      expect(errorElement).toHaveAttribute("aria-label", "Audio unavailable");
    });

    it("should not show audio element after error", () => {
      render(<AudioPlayer src="/invalid/path.m4a" />);

      const audioElement = screen.getByTestId("audio-element");
      fireEvent.error(audioElement);

      // Audio element should be removed
      expect(screen.queryByTestId("audio-element")).not.toBeInTheDocument();
    });
  });

  describe("source types", () => {
    it("should include audio/mp4 source type", () => {
      const { container } = render(<AudioPlayer src="/path/to/audio.m4a" />);

      const mp4Source = container.querySelector('source[type="audio/mp4"]');
      expect(mp4Source).toBeInTheDocument();
    });

    it("should include audio/mpeg source type", () => {
      const { container } = render(<AudioPlayer src="/path/to/audio.mp3" />);

      const mpegSource = container.querySelector('source[type="audio/mpeg"]');
      expect(mpegSource).toBeInTheDocument();
    });

    it("should include audio/x-caf source type for macOS compatibility", () => {
      const { container } = render(<AudioPlayer src="/path/to/audio.caf" />);

      const cafSource = container.querySelector('source[type="audio/x-caf"]');
      expect(cafSource).toBeInTheDocument();
    });
  });
});
