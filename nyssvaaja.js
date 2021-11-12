/*
 *  Nyssvaaja
 */
(() => {
    
    let refresh_rate = 1000*10;
    const queryStops = [];
    
    if (window.location.hash) {
        const hash = decodeURIComponent(window.location.hash).substr(1);
        try {
            
            const hashData = JSON.parse(hash);
            
            if (hashData.stops)
                queryStops.push(...hashData.stops);
            
            if (hashData.interval)
                refresh_rate = 1000*hashData.interval;
            
            $(() => {
                
                if (hashData.colorBg)
                $('body').css('background-color', hashData.colorBg);
        
                if (hashData.colorText)
                    $('body').css('color', hashData.colorText);
                
            })
                    
        } catch(err) {
            console.error(err);
        }
    }
    
    window.onhashchange = () => window.location.reload();
    
    async function nysseQuery(ql, vars){
        
        const resp = await fetch(`https://api.digitransit.fi/routing/v1/routers/waltti/index/graphql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: ql,
                variables: vars ?? {}
            })
        });
        
        return await resp.json();
        
    }
    
    async function getAllStops(){
        return await nysseQuery(`{
            stops(feeds: "tampere") {
                gtfsId,
                name,
                code,
                zoneId
            }
        }`);
    }
    
    async function getStopData(stopId){
        
        return await nysseQuery(`{
            stop(id: "${stopId}") {
                gtfsId,
                name,
                stoptimesWithoutPatterns(numberOfDepartures: 5) {
                    stop {
                        platformCode
                    }
                    serviceDay
                    scheduledArrival
                    scheduledDeparture
                    realtimeArrival
                    realtimeDeparture
                    trip {
                        route {
                            shortName
                        }
                    }
                    headsign
                }
            }
        }`);
        
    }
    
    function getTimeString(stopTime) {
        const isOffSchedule = stopTime.realtimeDeparture != stopTime.scheduledDeparture;
        const d = new Date((stopTime.serviceDay + stopTime.realtimeDeparture)*1000);
        return (isOffSchedule ? '* ' : '') + [...`${d.getHours() < 10 ? '0'+d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? '0'+d.getMinutes() : d.getMinutes()}`]
                                        .map(c => `<span class="x-time-char">${c}</span>`)
                                        .join('');
    }
    
    function getDueMinutes(stopTime) {
        const d = new Date((stopTime.serviceDay + stopTime.realtimeDeparture)*1000);
        const mins = Math.floor((d.getTime() - Date.now())/1000/60);
        return mins <= 60 ? mins : '';
    }
    
    async function refresh(){
        
        for (const stopId of queryStops) {
            
            const isNewStop = $(`[data-stop="${stopId}"]`).length == 0;
            const $stop = !isNewStop
                            ? $(`[data-stop="${stopId}"]`)
                            : $('<div class="col-sm-12 col-md-6 col-lg-5 col-xl-4 mb-3"/>').attr('data-stop', stopId);
                            
            const stopDataRaw = await getStopData(stopId);
            
            if (!stopDataRaw || !stopDataRaw.data || !stopDataRaw.data.stop)
                continue;
            
            const stopData = stopDataRaw.data.stop;
            
            if (isNewStop) {
                $stop.append(
                    $('<h3/>')
                        .append($('<span style="display: inline-block; vertical-align: middle;"/>').text(stopData.name))
                        .append($('<span class="x-stop-id"/>').text(stopData.gtfsId.split(':')[1]))
                );
            }
            
            const $stopTable = !isNewStop ? $stop.find('table') : $('<table class="x-table"/>').appendTo($stop);
            $stopTable.find('tr').remove();
            
            $stopTable.append(
                $('<tr/>').append(
                    $('<td/>').text(`🚌`),
                    $('<td/>').text(`📍`),
                    $('<td class="text-right"/>').text(`⌚️`),
                    $('<td class="text-right"/>').text(`⏳️`)
                ),
                $('<tr class="x-divider"/>').append('<td colspan="4"><hr></td>')
            );
            
            for (const stopTime of stopData.stoptimesWithoutPatterns) {
                $stopTable.append(
                    $('<tr/>').append(
                        $('<td style="width: 3em;"/>').text(stopTime.trip.route.shortName ?? '?'),
                        $('<td/>').text(stopTime.headsign ?? '?'),
                        $('<td class="text-right" style="width: 4em;"/>').append(
                            $('<b/>').html(getTimeString(stopTime))
                        ),
                        $('<td class="text-right" style="width: 2em;"/>').append(
                            $('<b class="mr-1"/>').html(getDueMinutes(stopTime))
                        )
                    ),
                    $('<tr class="x-divider"/>').append('<td colspan="4"><hr></td>')
                );
            }
            
            $stopTable.find('tr:last-child:not(:first-child)').remove();
            
            if (isNewStop) {
                $stop.append($stopTable);
                $('#stops').append($stop);
            }
            
        }
        
    }
    
    $(() => {
        
        function loopRefresh() {
            refresh()
                .then(() => setTimeout(loopRefresh, refresh_rate))
                .catch((err) => {
                    console.error(err);
                    setTimeout(loopRefresh, refresh_rate/2);
                });
        }
        
        async function selectRefresh() {
            
            const nysseStopsRaw = await getAllStops();
            const nysseStops = nysseStopsRaw.data.stops;
            const $stopOptionsA = nysseStops
                                    .sort((a, b) => {
                                        const aName = a.name.toLowerCase();
                                        const bName = b.name.toLowerCase();
                                        if (aName < bName) return -1;
                                        if (bName > aName) return 1;
                                        return 0;
                                    })
                                    .map(st => $('<option/>').text(`${st.name} ${st.code}`).attr('value', st.gtfsId))
            const $stopOptionsB = nysseStops
                                    .sort((a, b) => parseInt(a.code) - parseInt(b.code))
                                    .map(st => $('<option/>').text(`${st.code} ${st.name}`).attr('value', st.gtfsId))
            
            const $selA = $('#_select_stop_a');
            const $selB = $('#_select_stop_b');
            
            $selA.find('option').remove();
            $selB.find('option').remove();
            
            $selA.append(...$stopOptionsA);
            $selB.append(...$stopOptionsB);
            
        }
        
        if (queryStops.length > 0) {
            $('[data-view="stops"]').show();
            loopRefresh();
        } else {
            $('[data-view="select"]').show();
            selectRefresh()
                .then(() => {})
                .catch((err) => {
                    $('[data-view="select"] .container').html('').append(
                        $('<div class="alert alert-danger"/>')
                            .text(`Tapahtui virhe. Yritä ladata sivu uudelleen.`)
                            .append($('<pre class="mb-0"/>').text(`${err}`))
                    );
                    console.error(err);
                });
        }
        
        $('#_button_add_a').click((e) => {
            
            e.preventDefault();
            
            const stopId = $('#_select_stop_a').val();
            const stopName = $('#_select_stop_b').find(`option[value="${stopId}"]`).text();
            
            if ($(`#_table_stops tr[data-stop-id="${stopId}"]`).length > 0)
                return;
            
            $('#_table_stops').append(
                $('<tr/>').attr('data-stop-id', stopId).append(
                    $('<td/>').text(stopName),
                    $('<td class="text-right"/>').text(stopId),
                    $('<td class="text-right"/>').append(
                        $('<button class="btn btn-sm btn-danger py-0 px-1" data-action="delete"/>').html('&times;')
                    )
                )
            );
            
        });
        
        $('#_button_add_b').click((e) => {
            
            e.preventDefault();
            
            const stopId = $('#_select_stop_b').val();
            const stopName = $('#_select_stop_b').find(`option[value="${stopId}"]`).text();
            
            if ($(`#_table_stops tr[data-stop-id="${stopId}"]`).length > 0)
                return;
            
            $('#_table_stops').append(
                $('<tr/>').attr('data-stop-id', stopId).append(
                    $('<td/>').text(stopName),
                    $('<td class="text-right"/>').text(stopId),
                    $('<td class="text-right"/>').append(
                        $('<button class="btn btn-sm btn-danger py-0 px-1" data-action="delete"/>').html('&times;')
                    )
                )
            );
            
        });
        
        $('#_table_stops').on('click', '[data-action="delete"]', (e) => {
            e.preventDefault();
            $(e.currentTarget).closest('tr[data-stop-id]').remove();
        });
        
        $('#_button_go').click((e) => {
            
            const stopIds = [];
            
            $('#_table_stops tr').each((i, el) => {
                const stopId = $(el).attr('data-stop-id');
                if (stopIds.indexOf(stopId) == -1) stopIds.push(stopId);
            });
            
            if (stopIds.length == 0) {
                alert(`Valitse vähintään yksi pysäkki.`);
                return;
            }
            
            const hashData = {
                stops: stopIds,
                colorBg: $('#_color_bg').val(),
                colorText: $('#_color_text').val(),
                interval: parseInt($('#_interval').val())
            };
            
            window.location.href = '#' + encodeURIComponent(JSON.stringify(hashData));
            
        });
        
    })
    
})();