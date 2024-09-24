import axios from 'axios';
import assert from 'assert';
import { Slot, User } from '../src/types';

const API_BASE_URL = 'http://localhost:3000/v1';

async function createUser(name: string) : Promise<User> {
  const response = await axios.post(`${API_BASE_URL}/user`, { name });
  console.log('Created user:', response.data);
  assert(response.data.id, 'User created successfully');
  return response.data;
}

async function createSlot(userId: number, date: string, startTime: string, endTime: string, timezoneOffset: number) : Promise<Slot> {
  const response = await axios.post(`${API_BASE_URL}/user/${userId}/slot`, { date, startTime, endTime, timezoneOffset });
  console.log('Created slot:', response.data);
  assert(response.data.id, 'Slot created successfully');
  return response.data;
}

async function viewSlots(userId: number, type: 'booked' | 'available') {
  const response = await axios.get(`${API_BASE_URL}/user/${userId}/slot?type=${type}`);
  console.log(`Viewing ${type} slots for user ${userId}:`, response.data);
  assert(Array.isArray(response.data), `${type} slots retrieved successfully`);
  return response.data;
}

async function bookSlot(slotId: number, userId: number) {
    try {
        const response = await axios.post(`${API_BASE_URL}/book/slot/${slotId}`, { userId });
        console.log('Booked slot:', response.data);
        assert(response.data.slotId, 'Slot booked successfully');
        return response.data;
    } catch (err: any) {
        const erroMsg: String = err?.response?.data?.error 
        if (erroMsg && erroMsg === "Slot is already booked.") {
            console.log(erroMsg);
            return ({
                booked: false
            })
        }

        return ({
            booked: undefined
        })
    }


}

async function deleteSlot(slotId: number, userId: number) {
  const response = await axios.delete(`${API_BASE_URL}/slot/${slotId}`, { data: { userId } });
  console.log('Deleted slot:', response.data);
  assert(response.data.message.includes('deleted'), 'Slot deleted successfully');
  return response.data;
}

async function deleteBooking(slotId: number, userId: number) {
  const response = await axios.delete(`${API_BASE_URL}/booking/${slotId}`, { data: { userId } });
  console.log('Deleted booking:', response.data);
  assert(response.data.message.includes('canceled'), 'Booking deleted successfully');
  return response.data;
}

async function checkOverlap(userId1: number, userId2: number) {
  const response = await axios.get(`${API_BASE_URL}/overlap?userId1=${userId1}&userId2=${userId2}`);
  console.log('Overlapping slots:', response.data);
  assert(Array.isArray(response.data), 'Overlap check completed successfully');
  return response.data;
}

async function runDemo() {
  try {
    // Create users
    const user1 = await createUser('Alice');
    const user2 = await createUser('Bob');
    const user3 = await createUser('Charlie');


    // Create slots for user1
    const futureDate = "2024-09-27";
    const slot1 = await createSlot(user1.id, futureDate, '10:00', '11:00', 330);
    const slot2 = await createSlot(user1.id, futureDate, '14:00', '15:00', 330);

    // Create slots for user2
    const slot3 = await createSlot(user2.id, futureDate, '11:00', '12:00', 330);
    const slot4 = await createSlot(user2.id, futureDate, '14:30', '15:00', 330);
    const slot5 = await createSlot(user2.id, futureDate, '15:00', '16:00', 330);

    // View available slots
    let availableSlots1 = await viewSlots(user1.id, 'available');
    let availableSlots2 = await viewSlots(user2.id, 'available');
    assert(availableSlots1.length === 2, 'User1 should have 2 available slots');
    assert(availableSlots2.length === 3, 'User2 should have 3 available slots');
      
    // Book slots
    await bookSlot(slot1.id, user3.id);
    await bookSlot(slot2.id, user2.id);
    await bookSlot(slot3.id, user1.id);
    await bookSlot(slot4.id, user3.id);

    // View booked slots
    let bookedSlots1 = await viewSlots(user1.id, 'booked');
    let bookedSlots2 = await viewSlots(user2.id, 'booked');
    assert(bookedSlots1.length === 2, 'User1 should have 2 booked slot');
    assert(bookedSlots2.length === 2, 'User2 should have 2 booked slot');
      
      // duplicate booking
    console.log('Trying to create a duplicate booking');
    const duplicateBooking = await bookSlot(slot4.id, user1.id);
    assert(duplicateBooking.booked === false, 'slot 4 is already booked');


    // Check overlap
    let overlaps = await checkOverlap(user1.id, user2.id);
    assert(overlaps.length === 1, 'There should be 1 overlapping slots');

    // Delete a booking
    await deleteBooking(slot3.id, user2.id);

    // Delete a slot
    await deleteSlot(slot1.id, user1.id);

    // View final state
    console.log('Final state:');
    availableSlots1 = await viewSlots(user1.id, 'available');
    bookedSlots1 = await viewSlots(user1.id, 'booked');
    availableSlots2 = await viewSlots(user2.id, 'available');
    bookedSlots2 = await viewSlots(user2.id, 'booked');

    assert(availableSlots1.length === 0, 'User1 should have 0 available slots');
    assert(bookedSlots1.length === 1, 'User1 should have 1 booked slot');
    assert(availableSlots2.length === 2, 'User2 should have 2 available slots');
    assert(bookedSlots2.length === 1, 'User2 should have 1 booked slots');

    console.log('All tests passed successfully!');

  } catch (error) {
    console.error('An error occurred during the demo:', error);
  }
}

runDemo();