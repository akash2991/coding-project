import { Prisma, PrismaClient } from '@prisma/client'

import express, { Request, Response } from 'express';
import { SlotRequest, BulkSlotRequest, Slot } from './types';


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
    const { date, startTime, duration } : SlotRequest = req.body;

    // Ensure the availability is set within 2 weeks
    const currentDate = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(currentDate.getDate() + 14);

    const slot = new Date(date); // Create date object from input date
    const [hours, minutes] = startTime.split(':').map(Number);
    slot.setHours(hours, minutes, 0, 0); // Set hours and minutes

    if (slot > twoWeeksLater) {
      return res.status(400).json({ error: "Slot can only be set for up to 2 weeks in advance." });
    }

    if (slot < currentDate) {
      return res.status(400).json({ error: "Slot can only be set for future dates." });
    }

    // Convert to epoch timestamp
    const startTimeEpoch = BigInt(slot.getTime())

    // Check for overlapping slots
    // FIXME: overlap logic
    const overlaps = await prisma.slot.findMany({
      where: {
        userId: Number(userId),
        startTime: {
          lte: startTimeEpoch + BigInt(duration * 60 * 1000),
          gte: startTimeEpoch, 
        }
      }
    });

    if (overlaps.length > 0) {
      return res.status(400).json({ error: 'Overlapping slot found' });
    }

    const availability = await prisma.slot.create({
      data: {
        userId: Number(userId),
        startTime: startTimeEpoch,
        duration: duration,
      },
    });

    res.json({
      ...availability,
      startTime: Number(availability.startTime),
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while creating a slot." });
  }
});

// XXXXX Bul
// Body: { "2024-09-25": [["10:00", 60], ["14:00", 30]] }
// app.post("/v1/user/:userId/slot/bulk", async (req: Request, res: Response) => {
//   const { userId } = req.params;
//   const availabilityData : BulkSlotRequest = req.body;

//   const availabilityEntries = [];

//   const currentDate = new Date();
//   const twoWeeksLater = new Date();
//   twoWeeksLater.setDate(currentDate.getDate() + 14);

//   const existingAvailabilities = await prisma.slot.findMany({
//     where: {
//       userId: Number(userId),
//     },
//   });

//     // Create a map for fast overlap checking
//   const existingAvailabilityMap = new Map<number, Slot>();
//   existingAvailabilities.forEach(avail => {
//     existingAvailabilityMap.set(avail.startTime, avail);
//   });


//   for (const [date, availabilitiesOfTheDay] of Object.entries(availabilityData)) {
//     const entryDate = new Date(date);
//     if (entryDate > twoWeeksLater) {
//       continue;
//     }

//     for (const availabilityOfTheDay of availabilitiesOfTheDay) {
//       const startEpoch = new Date(`${date}T${availabilityOfTheDay.startTime}`).getTime();

//       // Check for overlapping availability in memory
//       const hasOverlap = [...existingAvailabilityMap.values()].some(avail => 
//         startEpoch < avail.startTime + avail.duration * 60 * 1000 && 
//         startEpoch + availabilityOfTheDay.duration * 60 * 1000 > avail.startTime
//       );

//       if (hasOverlap) {
//         return res.status(400).json({ error: 'Overlapping availability found' });
//       }

//       availabilityEntries.push({
//         userId: Number(userId),
//         startTime: startEpoch,
//         duration:availabilityOfTheDay.duration,
//       });
//     }
//   }

//   const result = await prisma.slot.createMany({
//     data: availabilityEntries,
//   });

//   res.json(result);
// });



// view slots
app.get("/v1/user/:userId/slot", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { type } = req.query;

  const currentTime = BigInt(Date.now());

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
      return res.json(slots.map(slot => ({...slot, startTime: slot.startTime.toString()})));
    }
    
    if (type === 'available') {
      const slots = await prisma.slot.findMany({
        where: {
          userId: Number(userId),
          startTime: { gt: currentTime }, // Only future slots
          booking: null
        }
      });

      return res.json(slots.map(slot => ({...slot, startTime: slot.startTime.toString()})));
    }

    return res.status(400).json({ error: "Invalid type parameter. Use 'booked' or 'available'." });

  } catch (error) {
    console.error("Error fetching slots:", error);
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
        },
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

    const currentTime = Date.now();
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

      return { deletedSlot:{...deletedSlot, startTime: deletedSlot.startTime.toString()}, deletedBooking };
    });

    res.json({ message: "Slot and its booking (if any) have been deleted", result: deleteResult });
  } catch (error) {
    console.log(error)
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

    const currentTime = BigInt(Date.now());

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
        const slot1End = BigInt(slot1.startTime) + BigInt(slot1.duration * 60000); // Convert minutes to milliseconds
        const slot2End = BigInt(slot2.startTime) + BigInt(slot2.duration * 60000);

        if (
          (BigInt(slot1.startTime) <= BigInt(slot2.startTime) && slot1End > BigInt(slot2.startTime)) ||
          (BigInt(slot2.startTime) <= BigInt(slot1.startTime) && slot2End > BigInt(slot1.startTime))
        ) {
          overlappingSlots.push({ user1Slot: {...slot1, startTime: slot1.startTime.toString()}, user2Slot: {...slot2, startTime: slot2.startTime.toString()} });
        }
      }
    }

    res.json(overlappingSlots);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "An error occurred while finding a overlap." });
  }
});










const server = app.listen(3000, () =>
  console.log(`
🚀 Server ready at: http://localhost:3000
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`),
)
