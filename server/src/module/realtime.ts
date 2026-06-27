import mqtt, { MqttClient } from 'mqtt';
import { IRealtimeVehicle } from '../common/types';
import { REALTIME_FEEDS_WALTTI } from './magic';

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { gtfsEntityToGeneral } from './util';

export function initRealtime(props: {
    VERSION: string,
    apiKey: string,
    walttiKey: string,
    args: any
}) {
    
    const { VERSION, apiKey, walttiKey } = props;
    const NEVER_UNLOAD_FEEDS: string[] = `${props.args.keepAliveFeeds || ''}`.split(',').filter(x => !!x);
    
    console.log(`[mqtt] Following MQTT feed ids will never be unloaded: ${NEVER_UNLOAD_FEEDS.join(', ')}`)
    
    const clientIdRandom = `${crypto.randomUUID().split('-')[0]}_${Date.now().toString(36)}`;
    
    const realtimeData = new Map<string, Map<string, IRealtimeVehicle>>();
    const lastRealtimeAsked = new Map<string, number>();
    const activeRealtimeFeeds: string[] = [];
    
    const FEED_UNSUBSCRIBE_TIME = 1000*30;
    const VEHICLE_STUB_TIME = 1000*30;
    
    let lastMessageCounter = Date.now();
    let messageCount = 0;
    let mqttClient: MqttClient | null = null;
    
    let lastHSL = 0;
    
    async function init() {
        
        console.log(`[mqtt] Connecting to Digitransit MQTT...`);
        
        mqttClient = await mqtt.connectAsync(`mqtts://mqtt.digitransit.fi/gtfsrt/vp/#?digitransit-subscription-key=${encodeURIComponent(apiKey)}`, {
            keepalive: 30,
            reconnectPeriod: 15,
            clientId: `nyssvaaja_v${VERSION}_${clientIdRandom}`
        });
        
        mqttClient.on('message', (topic, message) => {
            
            messageCount++;
            //console.log(topic);
            
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(message));
            const topicParts = topic.split('/');
            const feedId = topicParts[3];
            
            if (!realtimeData.has(feedId)) {
                realtimeData.set(feedId, new Map<string, IRealtimeVehicle>());
            }
            
            const cityMap = realtimeData.get(feedId);
            if (!cityMap) return;
            
            for (const entity of feed.entity) {
                const veh = gtfsEntityToGeneral(entity);
                if (!veh) continue;
                cityMap.set(entity.id, veh);
            }
            
        })
        mqttClient.on('error', err => {
            console.error(`MQTT error: ${err}`);
            console.error(err);
        });
        mqttClient.on('connect', err => {
            console.log(`MQTT client has connected.`);
        })
        mqttClient.on('disconnect', () => {
            console.log(`MQTT client was disconnected.`);
        })
        
    }
    
    async function heartbeat() {
        
        if (Date.now() - lastMessageCounter > 1000*60*60*6) {
            console.log(`[mqtt] Processed ${messageCount} MQTT messages in the last 6 hours.`);
            lastMessageCounter = Date.now();
            messageCount = 0;
        }
        
        if (!mqttClient || !mqttClient.connected) {
            console.error(`[mqtt] Heartbeat: No client/connection!`);
            return;
        }
        
        const toLoop = [...activeRealtimeFeeds];
        for (const feedId of toLoop) {
            
            // clean up non-updated vehicles
            const feedData = realtimeData.get(feedId);
            if (feedData) {
                const feedKeys = [...feedData.keys()];
                for (const vehId of feedKeys) {
                    if (Date.now() - (feedData.get(vehId)?.timestamp ?? 0) > VEHICLE_STUB_TIME) {
                        feedData.delete(vehId);
                    }
                }
            }
            
            // unsubscribe from unnecessary topics
            if (!lastRealtimeAsked.get(feedId)
                || Date.now() - (lastRealtimeAsked.get(feedId) ?? 0) > FEED_UNSUBSCRIBE_TIME) {
                    
                if (NEVER_UNLOAD_FEEDS.includes(feedId)) {
                    continue;
                }
                
                console.log(`[mqtt] Unsubscribing from '${feedId}'`);
                await mqttClient.unsubscribeAsync(`/gtfsrt/vp/${feedId}/#`);
                
                while (activeRealtimeFeeds.indexOf(feedId) != -1) {
                    activeRealtimeFeeds.splice(activeRealtimeFeeds.indexOf(feedId), 1);
                }
                realtimeData.delete(feedId);
                lastRealtimeAsked.delete(feedId);
                
            }
            
        }
        
    }
    
    init()
        .catch(err => {
            console.error(`[mqtt] Init error: ${err}`);
            console.error(err);
        })
    
    setInterval(() => heartbeat().catch(err => {
        console.error(`[mqtt] Heartbeat error: ${err}`);
        console.error(err);
    }), 1000*3);
    
    async function getRealtimeData(feedId: string): Promise<IRealtimeVehicle[]> {
        
        if (feedId == 'HSL') {
            
            const feedId = 'HSL';
            if (realtimeData.has(feedId) && Date.now() - lastHSL < 1000*5) {
                return [...(realtimeData.get(feedId)?.values() ?? [])];
            }
            
            const x = await fetch(`https://realtime.hsl.fi/realtime/vehicle-positions/v2/hsl`);
            const raw = await x.arrayBuffer();
            
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(raw));
            
            if (!realtimeData.has(feedId)) {
                realtimeData.set(feedId, new Map<string, IRealtimeVehicle>());
            }
            
            const cityMap = realtimeData.get(feedId);
            if (!cityMap) return [];
            
            for (const entity of feed.entity) {
                const veh = gtfsEntityToGeneral(entity);
                if (!veh) continue;
                cityMap.set(entity.id, veh);
            }
            
            lastHSL = Date.now();
            return [...(realtimeData.get(feedId)?.values() ?? [])];
            
        }
        
        if (!REALTIME_FEEDS_WALTTI.includes(feedId)) {
            return [];
        }
        
        if (!mqttClient || !mqttClient.connected) {
            console.error(`[mqtt] getRealtimeData: No client/connection!`);
            return [];
        }
        
        // MQTT feed open => give cached data
        if (activeRealtimeFeeds.includes(feedId)) {
            lastRealtimeAsked.set(feedId, Date.now());
            return [...(realtimeData.get(feedId)?.values() ?? [])];
        }
        
        // open MQTT topic for this feed
        console.log(`[mqtt] Subscribing to '${feedId}'`)
        activeRealtimeFeeds.push(feedId);
        const grant = await mqttClient.subscribeAsync(`/gtfsrt/vp/${feedId}/#`);
        console.log(grant);
        
        // wait for data for this feed to appear
        await new Promise<void>((res) => {
            const waitStart = Date.now();
            const iv = setInterval(() => {
                // timeout if no data appears in 4 seconds
                // OR resolve if there is data
                if (Date.now() - waitStart > 4000
                    || realtimeData.has(feedId)) {
                    clearInterval(iv);
                    res();
                    return;
                }
            }, 100);
        })
        
        // (this returns an empty array if the timeout was exceeded)
        lastRealtimeAsked.set(feedId, Date.now());
        return [...(realtimeData.get(feedId)?.values() ?? [])];
        
    }
    
    return {
        getRealtimeData
    };
    
}
