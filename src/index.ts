import { Prisma, PrismaClient } from '@prisma/client'

import express, { Request, Response } from 'express';
import { SlotRequest, BulkSlotRequest, Slot } from './types';
import { convertUserInputToDateObject, convertUserInputToEpoch, isAfterTwoWeeks, isInPast, getCurrentUtcTimeStamp } from './util';


const prisma = new PrismaClient()
const app = express()

app.use(express.json())


// create user
app.post("/v1/user", async (req, res) => {
  const { name } : { name: string } = req.body;
  const user = await prisma.user.create({ data: { name } });
  res.json(user);
});

// create slot
app.post("/v1/user/:userId/slot", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { date, startTime, endTime, timezoneOffset }: SlotRequest = req.body;

    const resultOne = convertUserInputToDateObject(date, startTime, endTime, timezoneOffset);

    if (isAfterTwoWeeks(resultOne.startTime)) {
      return res.status(400).json({ error: "Slot can only be set for up to 2 weeks in advance." });
    }

    if (isInPast(resultOne.startTime)) {
      return res.status(400).json({ error: "Slot can only be set for future dates." });
    }

    const {startTime:startTimeEpoch, endTime:endTimeEpoch} = convertUserInputToEpoch(date, startTime, endTime, timezoneOffset);

    const user = await prisma.user.findFirst({
      where: {
        id: Number(userId)
      }
    });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Check for overlapping slots
    const overlaps = await prisma.slot.findMany({
      where: {
        userId: Number(userId),
        startTime: {
          lt: endTimeEpoch
        },
        endTime: {
          gt: startTimeEpoch,
        }
      }
    });

    if (overlaps.length > 0) {
      return res.status(400).json({ error: 'Overlapping slot found' });
    }

    const bookedSlot = await prisma.slot.create({
      data: {
        userId: Number(userId),
        startTime: startTimeEpoch,
        endTime: endTimeEpoch,
      },
    });

    res.json({
      ...bookedSlot,
      startTime: Number(bookedSlot.startTime),
      endTime: Number(bookedSlot.endTime)
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while creating a slot." });
  }
});

// view slots
app.get("/v1/user/:userId/slot", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { type } = req.query;

  const currentTime = getCurrentUtcTimeStamp();

  try {
    if (type === 'booked') {
      const slots = await prisma.slot.findMany({
        where: {
          userId: Number(userId),
          startTime: { gt: currentTime }, // Only future slots
          booking: {
            isNot : null
          }
        },
        include: { booking: true },
      });
      return res.json(slots.map(slot => ({...slot, startTime: slot.startTime.toString(), endTime: slot.endTime.toString()})));
    }
    
    if (type === 'available') {
      const slots = await prisma.slot.findMany({
        where: {
          userId: Number(userId),
          startTime: { gt: currentTime }, // Only future slots
          booking: null
        }
      });

      return res.json(slots.map(slot => ({...slot, startTime: slot.startTime.toString(), endTime: slot.endTime.toString()})));
    }

    return res.status(400).json({ error: "Invalid type parameter. Use 'booked' or 'available'." });

  } catch (error) {
    res.status(500).json({ error: "An error occurred while fetching slots." });
  }
});

// book slot
app.post("/v1/book/slot/:slotId", async (req, res) => {
  const { slotId } = req.params;
  const { userId } : {userId  : string} = req.body;

  try {
  // Use a transaction to handle concurrency
    const booking = await prisma.$transaction(async (prisma) => {
      const bookedSlot = await prisma.booking.findUnique({
        where: { slotId: Number(slotId) }
      });

      if (bookedSlot) {
        return {
          booked: false
        };
      }

      // Create a booking
      const newBooking = await prisma.booking.create({
        data: {
          slotId: Number(slotId),
          userId: Number(userId),
          meetingUrl: "google://meet/124235"
        }
      });

      return {
        ...newBooking,
        booked: true
      };
    });


    if (booking.booked) {
      res.json(booking);
    } else {
      return res.status(400).json({ error: "Slot is already booked." });
    }
  } catch (error) {
    res.status(500).json({ error: "An error occurred while booking a slot." });
  }

});

// delete slot
app.delete('/v1/slot/:slotId', async (req, res) => {
  const { slotId } = req.params;
  const { userId }: { userId: string } = req.body;

  try {
    const slot = await prisma.slot.findUnique({
      where: { id: Number(slotId), userId : Number(userId) },
    });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found." });
    }

    const currentTime = getCurrentUtcTimeStamp();

    if (slot.startTime < currentTime) {
      return res.status(400).json({ error: "Past slots cannot be deleted." });
    }

    // Start a transaction to delete both booking and slot
    const deleteResult = await prisma.$transaction(async (prisma) => {
      // First, delete any associated booking
      const deletedBooking = await prisma.booking.delete({
        where: { slotId: Number(slotId) },
      });

      // Then delete the slot
      const deletedSlot = await prisma.slot.delete({
        where: { id: Number(slotId) },
      });

      return { deletedSlot:{...deletedSlot, startTime: deletedSlot.startTime.toString(), endTime: deletedSlot.endTime.toString()}, deletedBooking };
    });

    res.json({ message: "Slot and its booking (if any) have been deleted", result: deleteResult });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while deleting the slot." });
  }
});

//delete booking
app.delete('/v1/booking/:slotId', async (req, res) => {
  const { slotId } = req.params;
  const { userId } : {userId  : string} = req.body;

  try {
    const booking = await prisma.booking.findUnique({
      where: { slotId: Number(slotId) },
      include: {
        slot: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const currentTime = getCurrentUtcTimeStamp();

    if (booking.slot.startTime < currentTime) {
      return res.status(400).json({ error: "Past bookings cannot be deleted." });
    }

    const slotCreatorId = booking.slot.userId;
    const slotBookerId = booking.userId;

    if ([slotCreatorId, slotBookerId].includes(Number(userId))) {
      const deletedBooking = await prisma.booking.delete({
        where: { slotId: Number(slotId) },
      });
      return res.json({ message: 'Meeting canceled', deletedBooking });
    }

    return res.json({ message: 'Unauthorized user' });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while deleting a booking.", msg : error });
  }
});

// gives overlap for the next two weeks
app.get("/v1/overlap", async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;

    const currentTime = getCurrentUtcTimeStamp();

    const [user1Slots, user2Slots] = await Promise.all([
      prisma.slot.findMany({
        where: {
          userId: Number(userId1),
          startTime: { gt: currentTime },
          booking: { isNot: null }
        }
      }),
      prisma.slot.findMany({
        where: {
          userId: Number(userId2),
          startTime: { gt: currentTime },
          booking: { isNot: null }
        }
      })
    ]);

    const overlappingSlots = [];
    for (const slot1 of user1Slots) {
      for (const slot2 of user2Slots) {
        if (
          slot1.endTime > slot2.startTime && slot1.startTime < slot2.endTime
        ) {
          overlappingSlots.push({
            user1Slot: {
              ...slot1,
              startTime: slot1.startTime.toString(),
              endTime: slot1.endTime.toString()
            },
            user2Slot: {
              ...slot2,
              startTime: slot2.startTime.toString(),
              endTime: slot2.endTime.toString()
            }
          });
        }
      }
    }

    res.json(overlappingSlots);
  } catch (error) {
    res.status(500).json({ error: "An error occurred while finding a overlap." });
  }
});


const server = app.listen(3000, () =>
  console.log(`
🚀 Server ready at: http://localhost:3000
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`),
)
