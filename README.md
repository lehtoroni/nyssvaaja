# Nyssvaaja

![](https://lehtodigital.fi/f/ukuse)

Nyssvaaja (aka Nyssvääjä) on Tampereen seudun joukkoliikenteen pysäkkiaikataulunäyttötyökalu,
joka kokoaa valituista pysäkeistä minimalistisen infonäytön.
Tarkoitus on lähinnä toimia henkilökohtaisessa käytössä
Nyssen oman mobiilisovelluksen korvaajana nopeissa aikataulujen tarkistustapauksissa.

Teknologioina sekoitus vanhaa Bootstrap 4 + jQuery -settiä,
päällä puhtaalla `fetch`illä tehdyt Graphql-pyynnöt Digitransitin rajapintaan.
Kaikki taikuus tapahtuu clientin puolella.

Valmiiksi hostattu versio löytyy osoitteesta [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).

# In English
This is just a random quick project that I wrote
for quickly checking a predefined set of bus stop schedules with realtime prediction.
The project simply queries for the selected stops from the [Digitransit](https://digitransit.fi/en/developers/) API,
and displays the data as a neat and minimalistic set of small tables.

The project mixes old Bootstrap 4 and jQuery with newer async functions
and `fetch` as the main source of Graphql data.
Everything happens on the client side.

You can find a hosted version of the tool on [nyssvaaja.lehtodigital.fi](https://nyssvaaja.lehtodigital.fi).

## License
MIT