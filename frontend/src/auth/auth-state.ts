import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export type AuthState = {
    session: Session | null;
    loading: boolean;
    configured: boolean;
};

export const AuthContext = createContext<AuthState>({
    session: null,
    loading: true,
    configured: false,
});

export function useAuth(): AuthState {
    return useContext(AuthContext);
}
