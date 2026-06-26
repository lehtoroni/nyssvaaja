
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
    licensePlate?: string
};

