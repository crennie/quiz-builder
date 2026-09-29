import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "./client";
import { AuthContext, type AuthState } from "./auth-state";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        loading: Boolean(supabase),
        configured: Boolean(supabase),
    });

    useEffect(() => {
        if (!supabase) return;
        let active = true;
        void supabase.auth
            .getSession()
            .then(({ data }) => {
                if (active) setState({ session: data.session, loading: false, configured: true });
            })
            .catch(() => {
                if (active) setState({ session: null, loading: false, configured: true });
            });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (active) setState({ session, loading: false, configured: true });
        });
        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
