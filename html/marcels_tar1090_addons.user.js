// ==UserScript==
// @name         Marcels tar1090 addons
// @version      0.0.1
// @description  Adds some features for tar1090 instances. Currently: measure distance between aircraft
// @match        https://globe.adsbexchange.com/*
// @match        https://globe.adsb.fi/*
// @match        https://adsb.lol/*
// @run-at       document-idle
// ==/UserScript==

let shiftPressed = false;
let activeHex = null;
let selectedPlanePairs = [];
let distanceVectorSource;

const styleFunction = (feature) => {
    return [
        new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'red',
                width: 3
            }),
            text: new ol.style.Text({
                font: '12px Calibri,sans-serif',
                fill: new ol.style.Fill({
                    color: 'black'
                }),
                stroke: new ol.style.Stroke({
                    color: 'white',
                    width: 3
                }),
                text: feature.get('name'), // Get the label from the feature property
                placement: 'line'
            }),
            zIndex: 9999999999999
        })
    ];
};

function coordsFromHex(first, second) {
    return [
        ol.proj.fromLonLat(g.planes[first].position),
        ol.proj.fromLonLat(g.planes[second].position)
    ];
}

function calculateDistanceInNauticalMiles(lon1, lat1, lon2, lat2) {
    // Convert degrees to radians
    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // Earth's radius in nautical miles
    const R = 3440.065;

    // Convert latitudes and longitudes from degrees to radians
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    const lon1Rad = toRadians(lon1);
    const lon2Rad = toRadians(lon2);

    // Haversine formula
    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distance in nautical miles
    return R * c;
}
function distanceFromHex(first, second) {
    let position1 = g.planes[first].position;
    let position2 = g.planes[second].position;
    let distance = calculateDistanceInNauticalMiles(position1[0], position1[1], position2[0], position2[1]);
    return distance.toFixed(1);
}

function initMapLayer() {
    distanceVectorSource = new ol.source.Vector({
        features: []
    });
    const distanceVectorLayer = new ol.layer.Vector({
        source: distanceVectorSource,
        style: styleFunction
    });
    OLMap.addLayer(distanceVectorLayer)
}


function mapRefreshHook(redraw) {
    distanceVectorSource.forEachFeature(feature => {
        let first = feature.get("first");
        let second = feature.get("second");
        feature.setGeometry(new ol.geom.LineString(coordsFromHex(first, second)));
        feature.set("name", distanceFromHex(first, second));
    });
}
function removeFeatureByFirstAndSecond(first, second) {
    const features = distanceVectorSource.getFeatures();
    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        if (feature.get('first') === first && feature.get('second') === second) {
            vectorSource.removeFeature(feature);
            break; // Assuming there is only one feature to remove
        }
    }
}
function selectPair(hex, otherHex) {
    const first = hex < otherHex ? hex : otherHex;
    const second = hex < otherHex ? otherHex : hex;
    const pair = [first, second];
    const index = selectedPlanePairs.findIndex(x => x[0] === pair[0] && x[1] === pair[1]);
    if (index >= 0) {
        selectedPlanePairs.splice(index, 1)
        removeFeatureByFirstAndSecond(first, second);
    } else {
        selectedPlanePairs.push(pair);
        const newFeature = new ol.Feature({
            first: first,
            second: second,
            geometry: new ol.geom.LineString(coordsFromHex(first, second)),
            name: distanceFromHex(first, second) // Add a property for the label
        });
        distanceVectorSource.addFeature(newFeature);
    }
}
function selectPlaneByHexHook(hex, options) {
    if (!shiftPressed) {
        return;
    }

    if (activeHex) {
        if (activeHex !== hex) {
            selectPair(activeHex, hex);
        }
        activeHex = null;
    } else {
        activeHex = hex;
    }
}
function resetDistances() {
    selectedPlanePairs = [];
    distanceVectorSource.clear()
}

function init() {
    console.log("Marcels tar1090 addons initialized!")

    injectHooks();
    addEventListeners();
    initMapLayer();
}

function injectHooks() {
    const mapRefreshOriginal = mapRefresh;
    mapRefresh = (redraw) => {
        mapRefreshHook(redraw);
        mapRefreshOriginal(redraw);
    }
    const selectPlaneByHexOriginal = selectPlaneByHex;
    selectPlaneByHex = (hex, options) => {
        selectPlaneByHexHook(hex, options);
        selectPlaneByHexOriginal(hex, options);
    }
}

function addEventListeners() {
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Shift') {
            shiftPressed = true;
        } else if (event.key === 'C') {
            resetDistances();
        }
    });
    window.addEventListener('keyup', function(event) {
        if (event.key === 'Shift') {
            shiftPressed = false;
        }
    });
}

// adsb.fi/adsb.lol need delayed init otherwise functions defined by tar1090 such as mapRefresh are not defined
setTimeout(init, 1000)
