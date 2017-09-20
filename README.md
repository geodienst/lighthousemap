# Beacon map
This map shows all the blinking beacons from [OpenStreetMap](http://www.openstreetmap.org/).

More specifically, it asks the [Overpass API](https://www.overpass-api.de) for all elements with an `seamark:light:sequence` attribute, decodes these, and displays them as coloured circles on the map. It also tries to take the `seamark:light:range` and `seamark:light:colour` into account.

## Overpass API
The current version uses an extracted dataset, but the code allows for directly querying the Overpass API. However, since a query like the one used here can take multiple minutes to complete it is not very useful do always do live queries.

## Credits
This map is made by the [Geodienst](http://www.geodienst.xyz) because it was a fun idea we wanted to try out. Feel free to fork this map and make your own visualisation of OSM data, or contribute improvements back to us. 
