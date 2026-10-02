# Security Specification: Quest Pad Firestore Security

## 1. Data Invariants
1. Each user's workbench data (`/workbenches/{userId}`) can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId`.
2. Each user's profile document (`/users/{userId}`) can only be read or written by the authenticated user whose `request.auth.uid == userId`.
3. An unauthenticated user cannot read or write any user's profile or workbench data.
4. Cross-user access is strictly forbidden (User A cannot access or mutate User B's tasks, goals, coins, PIN, or rewards).
5. All document ID path variables (`{userId}`) must adhere to the `isValidId` format constraint.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Read**: Attempting `get(/workbenches/user123)` without authentication. -> `PERMISSION_DENIED`
2. **Unauthenticated Write**: Attempting `set(/workbenches/user123, ...)` without authentication. -> `PERMISSION_DENIED`
3. **Cross-Tenant Read**: User `alice` attempting `get(/workbenches/bob)`. -> `PERMISSION_DENIED`
4. **Cross-Tenant Write**: User `alice` attempting `set(/workbenches/bob, { ownerId: 'bob' })`. -> `PERMISSION_DENIED`
5. **Cross-Tenant Update**: User `alice` attempting `update(/workbenches/bob, { 'settings.childName': 'Hacked' })`. -> `PERMISSION_DENIED`
6. **Cross-Tenant Delete**: User `alice` attempting `delete(/workbenches/bob)`. -> `PERMISSION_DENIED`
7. **Identity Spoofing On Create**: User `alice` creates `/workbenches/alice` with `ownerId: 'bob'`. -> `PERMISSION_DENIED`
8. **Owner Mutation On Update**: User `alice` updates `/workbenches/alice` changing `ownerId: 'bob'`. -> `PERMISSION_DENIED`
9. **Junk Path Variable Poisoning**: Accessing `/workbenches/very_long_path_variable_exceeding_128_chars_or_invalid_characters$$$`. -> `PERMISSION_DENIED`
10. **Shadow Profile Reading**: User `alice` attempting `get(/users/bob)` to leak email or personal data. -> `PERMISSION_DENIED`
11. **Shadow Profile Mutation**: User `alice` attempting `set(/users/bob, { id: 'bob', email: 'spoof@attacker.com' })`. -> `PERMISSION_DENIED`
12. **Catch-All Arbitrary Path Probe**: Attempting `get(/arbitrary_collection/some_doc)`. -> `PERMISSION_DENIED`
