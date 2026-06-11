/**
 * ErrorBoundary.tsx
 * Catches render-time crashes (including React's "Maximum update depth
 * exceeded" from an accidental render loop) so the page degrades to a
 * recoverable message instead of freezing. The captured error is logged to the
 * console and kept on screen so it can be reported.
 */

'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface the real cause — this is what we need to fix the root issue.
    console.error('[ErrorBoundary] Render crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0e0e10] p-6">
          <div className="max-w-md w-full bg-gray-900 border border-red-900/40 rounded-2xl p-6 space-y-4 text-center">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-white font-bold text-lg">Something went wrong</h2>
            <p className="text-gray-400 text-sm">
              The game hit a display error. Your balance and bets are safe on the server.
            </p>
            <pre className="text-left text-[11px] text-red-300/80 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-32">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 transition active:scale-95"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
