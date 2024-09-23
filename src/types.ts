type Duration = number; // Duration in minutes
type StartTime = string; // Format: "HH:mm"
type DateString = string; // Format: "YYYY-MM-DD"
type UserId = number;


export interface SlotRequest {
  date: DateString;      
  startTime: StartTime; 
  duration: Duration;  
}

export interface BulkSlotRequest {
  [date: DateString]: Array<SlotRequest>; 
}

export interface User {
  id: UserId;
  name: string;
  slots: Slot[];
  bookings: Booking[];
}

export interface Booking {
  availabilityId: number; // Ensures that one availability can only be booked once
  userId: UserId;
  createdBy: number; // ID of the user who created the slot
  bookedBy: number;  // ID of the user who booked the slot
  slot: Slot; // Reference to the availability object
}

export interface Slot {
  id: number;
  userId: UserId;
  startTime: number; // Epoch timestamp in seconds
  duration: Duration;   // Duration in minutes
}