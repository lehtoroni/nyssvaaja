![](https://shields.io/github/license/lehtoroni/nyssvaaja)
![](https://shields.io/github/languages/top/lehtoroni/nyssvaaja)
![](https://shields.io/github/issues/lehtoroni/nyssvaaja)


# 🚍️ Nyssvääjä

![](https://lehtodigital.fi/f/ukuse)

## Mikä? Miksi? Mitä?
Nyssvääjä on Nyssen ja muiden joukkoliikennetoimijoiden reaaliaikaista dataa käyttävä ja näyttävä pysäkkiaikataulunäyttötyökalu, joka kokoaa valituista pysäkeistä minimalistisen infonäytön. Toiselta välilehdeltä löytyy kartta, jolta bussien ja ratikoiden liikkeet näkee reaaliajassa.

Nyssvääjän tarkoitus on toimia (Nyssen omaa mobiilisovellusta) kevyempänä välineenä, jolla juuri käyttäjää itseään kiinnostavat bussien tuloajat ja sijainnit saa auki nopeasti (myös loskasäässä kävellessä kohti pysäkkiä todetakseen vuoron olevan ratikkatyömaan takia myöhässä 25 minuuttia).

(Tämän vuoksi Nyssvääjä ei niinkään ole esim. turistille sopiva reittiopas, vaan juurikin "onko bussini myöhässä" -työkalu...)

Nyssvääjä käyttää [Digitransitin](https://digitransit.fi/en/developers/apis/) rajapinnasta saatavaa avointa dataa. Uusimmassa versiossa tuetaan myös HSL:n ja muiden Waltti-/Varely-/Digitransit-alueiden datan näyttämistä!

☝️❗️ **Jos haluat lähinnä käyttää Nyssvääjää ilman teknistä osaamista, suuntaa osoitteeseen [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).**

### Kaikki ominaisuudet
- 🚏 **Pysäkkimonitori**, johon voit valita haluamasi määrän pysäkkejä.
- 🗺️ **Live-kartta**, josta näet bussit, reitit, pysäkit ja aikataulutilanteen. Voit myös filtteröidä näkyviin vain tietyt linjat.
- ⚠️ **Häiriötiedotenäkymä**, joka näyttää voimassaolevat häiriötiedotteet ja perutut vuorot.
- 🕰️ **Yleistilannenäkymä**, joka listaa kaikki bussi- ja ratikkalinjat myöhässä-etuajassa-tiedon mukaan (*taitaa olla tällä hetkellä rikki taustajärjestelmämuutosten vuoksi...*).
- 🔗 **Näkymän valinnat tallentuvat URL-osoitteeseen** #-osan jälkeen. Voit lisätä luomasi näytön esim. kirjanmerkkeihin tai puhelimen aloitusnäyttöön. (Muista päivittää kirjanmerkki tai kuvake aina kun teet muutoksia!)

## In English
Nyssvääjä is The minimal live bus schedule monitor for anyone wanting to see live data from Finnish areas. Pick a set of bus stops that you are interested in, add the URL to your bookmarks or home screen, and enjoy having a quick shortcut to bus schedules.

You can find a hosted version of the tool on [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).

## Used technologies
- [Preact](https://github.com/preactjs/preact)
- [Leaflet](https://leafletjs.com/)
- [Bootstrap 5](https://github.com/twbs)
- [Express](https://github.com/expressjs/express)
- [Digitransit API](https://digitransit.fi/en/developers/apis/)

## Technical overview
- `server/` contains all backend code
  - Node.js + Express
  - Local caching for certain data
  - MQTT client and dynamic subscriptions for realtime vehicle positions
- `client/` contains all frontend code
  - Preact bundled with Parcel
  - Leaflet map with custom markers
  - Barebones and minimal for *fast* rendering
- The `package.sh` script, when run in the root dir, will build and package the frontend + backend into a single executable application found in `server/build/`.

## Host-it-Yourself
In order to use this piece of code-held-together-with-bubblegum (pardon the Finnish phrase, "purkkaviritys"), go grab yourself an [API key](https://digitransit.fi/en/developers/api-registration/) for the Digitransit API. Then follow the steps:

### Cloning for development
1. Clone the repo
2. Install the dependencies with `npm install` (you'll need Node LTS 20/22 or similar)
3. Start the server with `npm start`. This will also build the frontend.
    - Configure with arguments:
      - `--apiKey=...` - set your API key (**required**)
      - `--port=9999` - change the webserver port

For example: `npm start -- --port=1234 --apiKey=...`.

### Prebuilt binaries
1. Download a [prebuilt binary](https://github.com/lehtoroni/nyssvaaja/releases)
2. Start it with `./nyssvaaja-server-linux --port=1234 --apiKey=...`

### Notes
The API key can also be placed in the file `apikey.txt` in the cwd of the server process.

It is highly recommended to run the app behind a reverse proxy.

## CLI flags
```
  --port=9999             Web server binding port
  --apiKey=...            Digitransit API key
  --trustProxy=X          Trust X levels of proxies
  --keepAliveFeeds=A,B,C  Force subscribed MQTT realtime feeds to stay subscribed
```

## License
MIT

## Screenshots
The newest version also includes a map!

![](https://lehtodigital.fi/f/GJa1r)

![](https://lehtodigital.fi/f/6QeMc)

![](https://lehtodigital.fi/f/dNOTz)

<p float="left">
<img src="https://lehtodigital.fi/f/JCvHR" width="200">
<img src="https://lehtodigital.fi/f/FkGtC" width="200">
<img src="https://lehtodigital.fi/f/voreI" width="200">
</p>