export function convertUserInputToDateObject(date: string, startTime: string, endTime: string, timezoneOffset: number) {
    const startTimeString = `${date}T${startTime}`
    const endTimeString = `${date}T${endTime}`

    const startDate = new Date(startTimeString);
    const endDate = new Date(endTimeString);
  
    const startDateUTC = new Date(startDate.getTime() - timezoneOffset * 60 * 1000);
    const endDateUTC = new Date(endDate.getTime() - timezoneOffset * 60 * 1000);

    return {
      startTime: startDateUTC, // UTC Date object for start time
      endTime: endDateUTC // UTC Date object for end time
    };
  }


  export function convertUserInputToEpoch(date: string, startTime: string, endTime: string, timezoneOffset: number) {
    const startTimeString = `${date}T${startTime}`
    const endTimeString = `${date}T${endTime}`

    const startDate = new Date(startTimeString);
    const endDate = new Date(endTimeString);

    const startDateUTC = startDate.getTime() - timezoneOffset * 60 * 1000;
    const endDateUTC = endDate.getTime() - timezoneOffset * 60 * 1000;

    return {
      startTime: BigInt(startDateUTC), // UTC epoch for start time
      endTime: BigInt(endDateUTC) // UTC epoch for end time
    };
  }


export function isAfterTwoWeeks (date: Date) {
    // const currentDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const currentDate = new Date();
    const twoWeeksLater = new Date(currentDate);
    twoWeeksLater.setUTCDate(currentDate.getUTCDate() + 14);

    return date > twoWeeksLater;
  }
  

  export function isInPast (date: Date) {
    const currentDate = new Date();
      return date < currentDate;
  }
  
export function getCurrentUtcTimeStamp() {
    return  BigInt(Date.now())
  }
  