/**
 * Tests for OnboardingShell component
 *
 * @module onboarding/__tests__/shell.test
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OnboardingShell } from "../shell/OnboardingShell";

describe("OnboardingShell", () => {
  it("renders children in card", () => {
    render(
      <OnboardingShell>
        <div data-testid="content">Hello World</div>
      </OnboardingShell>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders progress slot", () => {
    render(
      <OnboardingShell progressSlot={<div data-testid="progress">Step 1</div>}>
        Content
      </OnboardingShell>
    );
    expect(screen.getByTestId("progress")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
  });

  it("renders navigation slot", () => {
    render(
      <OnboardingShell navigationSlot={<button data-testid="nav">Next</button>}>
        Content
      </OnboardingShell>
    );
    expect(screen.getByTestId("nav")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("renders all slots together", () => {
    render(
      <OnboardingShell
        progressSlot={<div data-testid="progress">Progress</div>}
        navigationSlot={<div data-testid="nav">Navigation</div>}
      >
        <div data-testid="content">Content</div>
      </OnboardingShell>
    );

    expect(screen.getByTestId("progress")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("nav")).toBeInTheDocument();
  });

  it("renders without optional slots", () => {
    render(
      <OnboardingShell>
        <span>Just content</span>
      </OnboardingShell>
    );
    expect(screen.getByText("Just content")).toBeInTheDocument();
  });

  it("applies default max-width class", () => {
    const { container } = render(
      <OnboardingShell>Content</OnboardingShell>
    );
    // Check that max-w-xl is applied (default)
    const widthContainer = container.querySelector(".max-w-xl");
    expect(widthContainer).toBeInTheDocument();
  });

  it("applies custom max-width class", () => {
    const { container } = render(
      <OnboardingShell maxWidth="max-w-lg">Content</OnboardingShell>
    );
    const widthContainer = container.querySelector(".max-w-lg");
    expect(widthContainer).toBeInTheDocument();
  });

  it("has gradient background", () => {
    const { container } = render(
      <OnboardingShell>Content</OnboardingShell>
    );
    const bgElement = container.querySelector(".bg-gradient-to-br");
    expect(bgElement).toBeInTheDocument();
  });

  it("has card styling", () => {
    const { container } = render(
      <OnboardingShell>Content</OnboardingShell>
    );
    const card = container.querySelector(".bg-white.rounded-2xl.shadow-xl");
    expect(card).toBeInTheDocument();
  });
});
