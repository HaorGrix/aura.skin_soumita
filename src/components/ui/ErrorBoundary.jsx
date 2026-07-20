import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import Button from './Button.jsx';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // Error detail is accessible via this.state.error when needed for reporting.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-5 pt-32">
          <div className="h-16 w-16 bg-rose/20 text-magenta rounded-full flex items-center justify-center mb-6 ring-1 ring-magenta/20">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-3xl text-ink mb-3">
            Something went wrong
          </h2>
          <p className="text-ink-soft max-w-md mx-auto mb-8">
            We hit a small snag. Please try reloading the page to restore your glow.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()} className="px-6 py-3">
            <RotateCw className="h-4 w-4 mr-2 inline" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
