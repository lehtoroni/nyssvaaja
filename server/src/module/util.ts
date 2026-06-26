import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { IRealtimeVehicle } from '../common/types';

export function gtfsEntityToGeneral(entity: GtfsRealtimeBindings.transit_realtime.IFeedEntity): IRealtimeVehicle | null {
    if (!entity || !entity.vehicle || !entity.vehicle.trip) {
        return null;
    }
    return {
        headsign: '?',
        direction: entity?.vehicle?.trip?.directionId ?? -1,
        origin: '',
        destination: entity?.vehicle?.vehicle?.label ?? '',
        location: [
            entity?.vehicle?.position?.latitude ?? 0,
            entity?.vehicle?.position?.longitude ?? 0
        ],
        bearing: entity?.vehicle?.position?.bearing ?? 0,
        delay: 0,
        vehicleRef: entity?.vehicle?.vehicle?.id ?? '',
        tripDate: dateToDashed(entity?.vehicle?.trip?.startDate ?? ''),
        tripTime: entity?.vehicle?.trip?.startTime ?? '0',
        walttiRouteId: entity?.vehicle?.trip?.routeId ?? undefined,
        licensePlate: entity?.vehicle?.vehicle?.licensePlate ?? undefined,
        
        occupancy: entity?.vehicle?.occupancyPercentage ?? -1,
        
        // @ts-ignore
        raw: JSON.parse(JSON.stringify(entity)),
        timestamp: Date.now()
    };
}

export function dateToDashed(rawDate: string) {
    return rawDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
}

export function dashedToUndashedDate(rawDate: string) {
    return rawDate.split('-').join('');
}
