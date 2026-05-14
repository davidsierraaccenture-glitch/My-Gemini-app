# Security Specification for My Gemini App

## Data Invariants
1. A Chat MUST belong to the user who created it (`userId` matches `auth.uid`).
2. A Message MUST belong to a Chat that exists and belongs to the user.
3. Users can only read and write their own data.
4. Terminal states (none yet defined) must be locked.
5. All timestamps must be server-validated.

## The "Dirty Dozen" Payloads (Expect PERMISSION_DENIED)

1. **Identity Spoofing**: Try to create a chat for another user.
   ```json
   { "userId": "victim_uid", "title": "Hacked Chat", "createdAt": "request.time", "updatedAt": "request.time" }
   ```
2. **Ghost Field Injection**: Try to add `isAdmin: true` to a user profile.
   ```json
   { "uid": "my_uid", "isAdmin": true, "email": "me@example.com", "createdAt": "request.time" }
   ```
3. **Relational Bypass**: Create a message in a chat that doesn't belong to the user.
   ```json
   { "chatId": "someone_elses_chat", "role": "user", "content": "hello", "createdAt": "request.time" }
   ```
4. **ID Poisoning**: Use a 2KB string as a chatId.
   ```json
   { "id": "very_long_string...", ... }
   ```
5. **Type Poisoning**: Send `title` as a boolean.
   ```json
   { "userId": "my_uid", "title": true, ... }
   ```
6. **Future Timestamp**: Send a `createdAt` in the future (not using `request.time`).
7. **Cross-User Read**: Try to list chats belonging to `victim_uid`.
8. **Sub-resource Leak**: Try to read messages from a chat the user doesn't own.
9. **Immutable Mutation**: Update `createdAt` on an existing chat.
10. **System Field Override**: (If any system fields were defined).
11. **Unverified Email**: Perform a write with an unverified email (if required).
12. **Blanket Query**: Perform a `get` on a collection without a specific ID filter.

## Test Runner (firestore.rules.test.ts placeholder)
(In a real environment, I would run this with the Firebase Emulator).
