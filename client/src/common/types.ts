
export type IFeedInfo = {
    feedId: string,
    agencies: {
        name: string,
        gtfsId: string,
        url: string
    }[]
}

export type ILatLon = [number, number];

export type IRealtimeVehicle = {
    headsign?: string,
    direction: number,
    origin: string,
    destination: string,
    location: ILatLon,
    bearing: number,
    delay: number,
    vehicleRef: string,
    tripDate: string,
    tripTime: string,
    walttiRouteId?: string,
    licensePlate?: string,
    occupancy: number,
    timestamp: number
};

export type IRunningTrip = {
    routeShortName: string,
    route: { gtfsId: string, mode: string },
    departureStoptime: {
        realtimeDeparture: number,
        realtime: boolean,
        serviceDay: number,
        scheduledDeparture: number
    },
    arrivalStoptime: {
        serviceDay: number,
        scheduledArrival: number
    },
    directionId: number
};

export type IGhostTrip = {
    tripShortName: string,
    routeShortName: string,
    gtfsId: string,
    tripHeadsign: string,
    //geometry: [number, number][],
    stoptimesForDate: {
        stop: { gtfsId: string, lat: number, lon: number },
        serviceDay: number,
        realtimeDeparture: number,
        scheduledDeparture: number,
        realtime: boolean
    }[]
};
