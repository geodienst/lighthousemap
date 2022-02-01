# THIS IS A FORK

I did not create this code, the original source is [here](https://github.com/geodienst/lighthousemap) and the map [here](https://geodienst.github.io/lighthousemap/).

Like many others, I learnt about this beautiful gem of data visualisation thanks to this [viral tweet](https://twitter.com/emollick/status/1485467613190832130). I love it! This is such a great example of what can be accomplished with OpenStreetMap and crowdsourced data!

But I was equally disappointed as many others to see that the data hadn't been updated in 3 years.

So I dug in the code and found the Overpass query to fetch up-to-date data. And while I was at it, I added a Github Action to keep it updated. It runs every day at 00:15 CET for now, and I might make it update less often later to use even less energy.
# Beacon map
This map shows all the blinking beacons from [OpenStreetMap](https://www.openstreetmap.org/).

![Demo time](https://geodienst.github.io/lighthousemap/demo.gif)

More specifically, it asks the [Overpass API](https://www.overpass-api.de) for all elements with an `seamark:light:sequence` attribute, decodes these, and displays them as coloured circles on the map using [Leaflet](https://leafletjs.com). It also tries to take the `seamark:light:range` and `seamark:light:colour` into account.

## Overpass API
The current version uses an extracted dataset, but the code allows for directly querying the Overpass API. However, since a query like the one used here can take multiple minutes to complete it is not very useful do always do live queries.

## Useful stuff
The `leaflet.indexedfeaturelayer.js` file contains an extension on Leaflet's GeoJSON layer that only add layers/features to the map that are (or are about to be) visible. It uses a spatial index to quickly query which features can be removed from the DOM, increasing performance.

`leaflet.light.js` contains my best guess on how a light sequence will look based on [these descriptions](https://wiki.openstreetmap.org/wiki/Seamarks/Light_Characters). However, it might be inaccurate, and it tries to do its best with the sometimes not entirely consistent data from OSM.

## Credits
This map is made by the [Geodienst](https://www.geodienst.xyz) because it was a fun idea we wanted to try out. Feel free to fork this map and make your own visualisation of OSM data, or contribute improvements back to us.
