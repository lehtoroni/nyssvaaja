![](https://shields.io/github/license/lehtoroni/nyssvaaja)
![](https://shields.io/github/languages/top/lehtoroni/nyssvaaja)
![](https://shields.io/github/issues/lehtoroni/nyssvaaja)


# Nyssvaaja

![](https://lehtodigital.fi/f/ukuse)

Nyssvaaja (aka Nyssvääjä) on Tampereen seudun joukkoliikenteen pysäkkiaikataulunäyttötyökalu,
joka kokoaa valituista pysäkeistä minimalistisen infonäytön.
Tarkoitus on lähinnä toimia henkilökohtaisessa käytössä
Nyssen oman mobiilisovelluksen korvaajana nopeissa aikataulujen tarkistustapauksissa.

Tässä rewritessä käytössä mm.
- [Preact](https://github.com/preactjs/preact)
- [Bootstrap 5](https://github.com/twbs)
- [Express](https://github.com/expressjs/express)
- [Digitransit API](https://digitransit.fi/en/developers/apis/)

Valmiiksi hostattu versio löytyy osoitteesta [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).

## In English
This is just a random quick project that I wrote
for quickly checking a predefined set of bus stop schedules with realtime prediction.
The project simply queries for the selected stops from the [Digitransit](https://digitransit.fi/en/developers/) API,
and displays the data as a neat and minimalistic set of small tables.

This rewrite uses Preact and Bootstrap on the frontend, and a simple Express server as a proxy to hide the Digitransit API key.

You can find a hosted version of the tool on [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).

## Host-it-Yourself
In order to use this piece of bubblegum (pardon the Finnish phrase, "purkkaviritys"), go grab yourself an [API key](https://digitransit.fi/en/developers/api-registration/) for the Digitransit API. Then follow the steps:

1. Clone the repo
2. Install the dependencies with `npm install`
3. Start the server with `npm start`. This will also build the frontend.
    - Configure with arguments:
      - `--apiKey=...` - set your API key (**required**)
      - `--port=9999` - change the webserver port

For example: `npm start -- --port=1234 --apiKey=...`.

The API key can also be placed in the file `apikey.txt` in the root directory.

It is highly recommended to run the app behind a reverse proxy.

## License
MIT