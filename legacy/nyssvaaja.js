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
        
        if (window.localStorage) {
            const cached = window.localStorage.getItem('__nysse_all_stops');
            if (cached) {
                const cachedData = JSON.parse(cached);
                if (Date.now() - cachedData.timestamp <= 1000*60*60*24) {
                    return cachedData.data;
                }
            };
        }
        
        const data = await nysseQuery(`{
            stops(feeds: "tampere") {
                gtfsId,
                name,
                code,
                zoneId
            }
        }`);
        
        if (window.localStorage) {
            window.localStorage.setItem('__nysse_all_stops', JSON.stringify({
                timestamp: Date.now(),
                data
            }))
        }
        
        return data;
        
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
        
        let allStops = null;
        
        function updateSearchResultPosition() {
            const $parent = $('#_search_stop');
            const $res = $('#_search_results');
            const r = $parent[0].getBoundingClientRect();
            $res
                .css('width', `${r.right-r.left}px`)
                .css('max-height', `${Math.max(window.innerHeight-r.bottom-100, 100)}px`)
                .css('left', `${r.left}px`)
                .css('top', `${r.bottom}px`);
        }
        
        function updateSearchResults(search) {
            if (!allStops) return;
            $('#_search_results div').remove();
            allStops
                .filter(st => st.name.toLowerCase().indexOf(search.toLowerCase()) > -1 || st.code.indexOf(search) > -1)
                .map(st => $('<div class="x-search-row"/>')
                                .append($('<code/>').text(st.gtfsId), $('<span class="d-inline-block ml-2"/>').text(st.name)))
                .filter((st, i) => i < 100)
                .forEach($el => $('#_search_results').append($el))
        }
    
        $('#_search_stop').on('input', e => {
            const search = $(e.currentTarget).val();
            if (search.trim().length == 0) {
                $('#_search_results').hide();
            } else {
                $('#_search_results').show();
                updateSearchResultPosition();
                updateSearchResults(search);
            }
        });
        
        $('#_search_results').on('click', '.x-search-row', e => {
            
            const stopId = $(e.currentTarget).find('code').text();
            const stopName = $(e.currentTarget).find('span').text();
            
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
            
            updateSearchResultPosition();
            
        });
        
        $(window).on('scroll', () => updateSearchResultPosition());
        $(window).on('resize', () => updateSearchResultPosition());
        
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
            allStops = nysseStops;
            
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
        
        $('#_table_stops').on('click', '[data-action="delete"]', (e) => {
            e.preventDefault();
            $(e.currentTarget).closest('tr[data-stop-id]').remove();
        });
        
        $('#_color_bg').on('input change', e => {
            const color = $(e.currentTarget).val();
            $('body').css('background-color', color);
        });
        
        $('#_color_text').on('input change', e => {
            const color = $(e.currentTarget).val();
            $('body').css('color', color);
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