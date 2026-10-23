import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../auth/auth-state";
import { authenticatedRequest } from "./client";

const permissionsSchema = z.object({ isPlatformAdmin: z.boolean() });
export function usePlatformAdmin() {
    const { session } = useAuth();
    const profile = useQuery({
        queryKey: ["current-profile", session?.user.id],
        queryFn: async () => permissionsSchema.parse(await authenticatedRequest("/v1/me")),
        enabled: !!session,
    });
    return !!session && !profile.isError && profile.data?.isPlatformAdmin === true;
}
