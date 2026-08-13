import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("Unhandled application error", error, info);
    }

    render(): ReactNode {
        if (this.state.error) {
            return (
                <main className="centered-message">
                    <h1>Something went wrong</h1>
                    <p>The application could not continue. Refresh the page to try again.</p>
                    <button type="button" onClick={() => window.location.reload()}>
                        Refresh
                    </button>
                </main>
            );
        }

        return this.props.children;
    }
}
