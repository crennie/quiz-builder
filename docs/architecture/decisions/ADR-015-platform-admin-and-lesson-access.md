# ADR-015: Platform administration and enrolled lesson access

Status: Accepted

Supersedes the unrestricted authoring and public full-lesson reading rules in ADR-012, ADR-013,
and ADR-014. Course discovery remains public; course content administration needs a trusted role.

`profiles.is_platform_admin` is a non-null boolean defaulting to false. Administrators set it directly
in the database. Auth metadata cannot grant it, profile creation never overwrites it, and there is no
API to modify it. The read-only `/me` response exposes `isPlatformAdmin` for frontend permissions.

Express checks the database-backed profile on every course/lesson mutation: course imports, appended
lesson imports, lesson/quiz saves, and archiving/restoring courses all require platform admin access.
Enrollment and personal learning progress remain available to every authenticated learner.

Public course details and lesson lists remain available, but lesson lists omit content for everyone.
Full lesson details and lesson quiz lists require course enrollment. Admins are exempt so they can
review and edit content without enrolling. Standalone public quiz access remains unchanged.

The course overview renders lesson titles without reading links until enrollment or admin access is
confirmed. Direct lesson pages apply the same rule; the server enforces it independently. Protected
lesson query caches include user identity. Import/edit/archive controls are visible only to admins.

Validation covers metadata privilege escalation, default database privileges, all authoring routes,
public summaries, enrolled reads, admin access, and the frontend enrollment gate.
