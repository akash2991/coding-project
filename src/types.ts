type DateString = string; // Format: "YYYY-MM-DD"
type UserId = number;


export interface SlotRequest {
  date: DateString;      
  startTime: string; 
endTime: string; 
timezoneOffset: number
}

export interface BulkSlotRequest {
  [date: DateString]: Array<SlotRequest>; 
}

export interface User {
  id: UserId;
  name: string;
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
  endTime: number; // Epoch timestamp in seconds
}