# Instructions to start application

 ```
 1. npm install
 2. npx prisma migrate dev
 3. npm run dev
 ```

Application will start at port 3000.

# Instructions to run script to test the code

```
npx ts-node ./script/test.ts
```

# Optional

```
npx prisma studio (to start database GUI)
```

# To interact with apis

<bold>Import postman collection "p0.postman_collection.json" in postman</bold>

# Assumptions

- Both the users are logged in (that is we have their userid)
- user input will be in local time
- Daylight Saving Time is not considered
- User is accessing app from one device while creating slots (so that we don’t have to take care of write skew)

# Product / MVP

- User can only post availability for 2 weeks in advance (because generally it is very hard to predict availability after 2 weeks).
- Only one user can book one slot.
- User can only view and update future slots and bookings.
- No reschedule option. User will have to cancel existing booking and create a new one.
- Once an user has created a slot, they can not override it by creating another conflicting slot. User will have to cancel existing slot and create a new one.
- We only disallow creating conflicting slots. That is, a person can not create a slot for, say 2pm to 3pm and 2:30pm to 3:30pm.
- Apart form this, all the conflicts need to be handled by user themselves. Such as,
  - a user can create a slot, and book it himself
  - A user can book two parallel meetings
  - etc.
- Supports timezone.

# Tech Enhancements

- Pagination
- Rate Limiter
- More validations

# Product enhancements

- Notification in case of booking or cancellation
- A bulk api: to post bulk availability (didn’t implement it because of lack of time)
- A historical api to see past booked slots
- Ability to attach meeting notes (text, pdf, doc etc.)
- Maybe more conflict management on our end
- Daylight Saving Time can be considered
- user's timezone can be stored

# Tech Design choice (Trade-offs)

- consistency over Availability (ACID )
- Went with pessimistic locking to handle concurrency (can go with optimistic locking in production app)
- User can only post availability for 2 weeks in advance .
- Only one person can book one slot.
- For simplicity, Slot id is an autoincrement integer but it in production app, It needs to be uuid.
- Using Slot id as the booking id. (to keep booking table size small and for easy querying the systems using one id)
- Using timestamp to store the time instead of date object.
- User Cannt attach meeting notes (but schema can be extended to accommodate this)
- We are not maintaining any state machine. So a slot is either free or booked.
- Abandoned soft delete. Since this data is redundant. So If a booking or slot is cancelled, we delete it.
- Not keeping track of who is cancelling booking.
- User can only update future slots and bookings.
- User can only see future slots (booked or available)
- Using SQLite as db. When scaling, moving to PostgreSQL or a more robust database would be beneficial.
- We are not storing user's timezone
- Doing calculations in application, instead of in databse.

# Hacks

- No hacks as such as the MVP is pretty trivial to build.
