# SmartPOS286 Firestore Security Specification

## 1. Data Invariants
1. A `UserPrivateInfo` document at `/users/{userId}/private/info` can only exist for a valid UID matching `request.auth.uid` (or bootstrapped admin) with verified email (`request.auth.token.email_verified == true`), and PII (`email`, `displayName`) is never readable by any other non-admin user.
2. A `WorkspaceProfile` document at `/workspaces/{workspaceId}` must have `workspaceId == ownerId == request.auth.uid` on creation (`ownerId` and `createdAt` are strictly immutable on updates).
3. A `CloudBackup` document at `/workspaces/{workspaceId}/backups/{backupId}` cannot exist without an existing parent `/workspaces/{workspaceId}` whose `ownerId == request.auth.uid` (or `isAdmin()`), enforced via `get()` Master Gate on single-document reads/writes, and `resource.data.ownerId == request.auth.uid` on `list`.
4. All timestamps (`createdAt`, `updatedAt`) MUST match `request.time`.
5. All arrays in `CloudBackup` are bounded in size and type-checked.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read/write to `/workspaces/{uid}` -> Denied (`isSignedIn()`).
2. Unverified email token (`email_verified: false`) attempting write to `/workspaces/{uid}` -> Denied (`isVerifiedUser()`).
3. Identity spoofing on create: setting `ownerId` to another UID (`other_uid`) -> Denied (`ownerId == request.auth.uid`).
4. Cross-tenant PII read: User A reading `/users/{userB}/private/info` -> Denied (`isOwner(userId) || isAdmin()`).
5. Shadow field injection: Adding `{ isSuperAdmin: true }` to `/workspaces/{uid}` -> Denied (`keys().hasOnly(...)`).
6. Update-Gap ghost field: Adding an unexpected field during `update` -> Denied (`affectedKeys().hasOnly(...)` + `isValidWorkspaceProfile()`).
7. Immortal field mutation: Changing `ownerId` or `createdAt` during `update` -> Denied (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
8. Timestamp forgery: Sending past/future `updatedAt` instead of `request.time` -> Denied (`incoming().updatedAt == request.time`).
9. Path variable ID poisoning: Creating `/workspaces/{uid}/backups/<1KB junk$id>` -> Denied (`isValidId(backupId)`).
10. Orphaned backup creation: Creating `/workspaces/{uid}/backups/snap1` when parent `/workspaces/{uid}` does not exist -> Denied (`exists()` / `get()` parent check).
11. Resource exhaustion / Value poisoning: Sending `storeName` > 120 chars or `products` array > 500 items -> Denied (`.size()` checks).
12. Unscoped list scraping: Listing `/workspaces` or `/workspaces/{otherUid}/backups` without matching `resource.data.ownerId == request.auth.uid` -> Denied (`allow list` enforces `resource.data.ownerId == request.auth.uid`).
