import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-state";
import { getCourseProgress } from "./courses";

export function useCourseProgress(courseId: string) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ["course-progress", session?.user.id, courseId],
        queryFn: () => getCourseProgress(courseId),
        enabled: !!session,
    });
}
