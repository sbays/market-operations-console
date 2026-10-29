"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** Names the panel in the notice and the log, e.g. "Market map". */
  label: string;
  children: ReactNode;
};

type State = { failed: boolean };

/**
 * Keeps one broken panel from taking the dashboard down: the panel is replaced by a notice
 * and its siblings carry on. React only supports error boundaries as class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.label} failed:`, error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="status"
        className="rounded-lg border p-4 text-sm text-muted-foreground"
      >
        {this.props.label} couldn&apos;t be shown.
      </div>
    );
  }
}
