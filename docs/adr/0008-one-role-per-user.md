# ADR-0008: One role per user

- Status: Accepted
- Date: 2026-10-17
- Deciders: Product / Backend
- Ticket: SP-016

## Context

Users need different capabilities: practicing German, offering tandem, managing a Sprachcafé organization, authoring scenarios, moderating, and assigning roles. A person often does more than one of these. For example, a content editor still practices dialogues.

`User.role` and the access token already store a single `role` (`sub`, `role`, `sid`, `iat`, `exp` per SP-013). Access-token checks do not read the database.

## Decision

A user holds exactly one role: `learner`, `volunteer`, `organizer`, `content_editor`, `moderator`, or `admin`. Assigning a role replaces the previous one.

A role that should still practice German includes the learner capabilities in its permission set. That inclusion is how a content editor keeps using the product. Roles are not stacked on the user, and they are not a rank order. Volunteer, organizer, content editor, and moderator do not grant each other's extra capabilities. Admin's permission set includes every capability.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Several roles on one user, carried as a list in the token | Reopens the SP-013 claim set and the `User.role` column. |
| A rank ladder (admin > moderator > organizer > learner) | Content editor and organizer are not ordered. A ladder would grant the wrong extras. |

## Consequences

- The audit entry for a role change records the previous role and the new role.
- The access token keeps a single `role` claim. The new role appears at the next refresh, within 15 minutes.
- Someone who both learns and organizes is stored as `organizer`.
- Moving to multiple roles later requires a migration of `User.role` and the JWT claim.
