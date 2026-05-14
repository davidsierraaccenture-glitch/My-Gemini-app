# Security Specification for Electronics Shop

## Data Invariants
1. Products and Categories are read-only for public users (admins only for writes).
2. Users can only see their own Orders.
3. Orders must have a valid `userId` matching the authenticated user.
4. Total amount in an Order must be a positive number.
5. All timestamps (`createdAt`) must be server-validated.
6. Product prices and stock must be positive numbers.

## The "Dirty Dozen" Payloads (Expect PERMISSION_DENIED)

1. **Price Manipulation**: Attempt to create/update a product with a $0 or negative price.
2. **Stock Poisoning**: Set product stock to a non-integer or negative value.
3. **Unauthorized Product Edit**: A non-admin user trying to change a product description.
4. **Order Forgery**: Creating an order with someone else's `userId`.
5. **Private Order Read**: A user trying to read an order belonging to another UID.
6. **Immutable Order**: Trying to change the `total` of an order after it has been created.
7. **Ghost Field in Order**: Adding `isPaid: true` to an order during creation.
8. **ID Poisoning**: Using a 5KB string as a `productId`.
9. **Category Deletion**: A non-admin user attempting to delete a category.
10. **Unverified Purchase**: (Optional) Forcing writes only for verified email users.
11. **Blanket Order Search**: A user trying to list all orders in the system without a `userId` filter.
12. **Future Orders**: Providing a client-side timestamp for `createdAt` in an Order.

## Identity Strategy
- **Public**: Can read Products and Categories.
- **Authenticated User**: Can create Orders and read their own Orders.
- **Admin**: Can manage Products, Categories, and view all Orders.
  - *Admin check*: `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`
