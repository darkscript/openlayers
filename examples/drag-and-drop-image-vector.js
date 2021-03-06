import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import GPX from '../src/ol/format/GPX.js';
import GeoJSON from '../src/ol/format/GeoJSON.js';
import IGC from '../src/ol/format/IGC.js';
import KML from '../src/ol/format/KML.js';
import TopoJSON from '../src/ol/format/TopoJSON.js';
import {defaults as defaultInteractions} from '../src/ol/interaction.js';
import DragAndDrop from '../src/ol/interaction/DragAndDrop.js';
import VectorLayer from '../src/ol/layer/Vector.js';
import TileLayer from '../src/ol/layer/Tile.js';
import BingMaps from '../src/ol/source/BingMaps.js';
import VectorSource from '../src/ol/source/Vector.js';
import CircleStyle from '../src/ol/style/Circle.js';
import Fill from '../src/ol/style/Fill.js';
import Stroke from '../src/ol/style/Stroke.js';
import Style from '../src/ol/style/Style.js';


const defaultStyle = {
  'Point': new Style({
    image: new CircleStyle({
      fill: new Fill({
        color: 'rgba(255,255,0,0.5)'
      }),
      radius: 5,
      stroke: new Stroke({
        color: '#ff0',
        width: 1
      })
    })
  }),
  'LineString': new Style({
    stroke: new Stroke({
      color: '#f00',
      width: 3
    })
  }),
  'Polygon': new Style({
    fill: new Fill({
      color: 'rgba(0,255,255,0.5)'
    }),
    stroke: new Stroke({
      color: '#0ff',
      width: 1
    })
  }),
  'MultiPoint': new Style({
    image: new CircleStyle({
      fill: new Fill({
        color: 'rgba(255,0,255,0.5)'
      }),
      radius: 5,
      stroke: new Stroke({
        color: '#f0f',
        width: 1
      })
    })
  }),
  'MultiLineString': new Style({
    stroke: new Stroke({
      color: '#0f0',
      width: 3
    })
  }),
  'MultiPolygon': new Style({
    fill: new Fill({
      color: 'rgba(0,0,255,0.5)'
    }),
    stroke: new Stroke({
      color: '#00f',
      width: 1
    })
  })
};

const styleFunction = function(feature, resolution) {
  const featureStyleFunction = feature.getStyleFunction();
  if (featureStyleFunction) {
    return featureStyleFunction.call(feature, resolution);
  } else {
    return defaultStyle[feature.getGeometry().getType()];
  }
};

const dragAndDropInteraction = new DragAndDrop({
  formatConstructors: [
    GPX,
    GeoJSON,
    IGC,
    KML,
    TopoJSON
  ]
});

const map = new Map({
  interactions: defaultInteractions().extend([dragAndDropInteraction]),
  layers: [
    new TileLayer({
      source: new BingMaps({
        imagerySet: 'Aerial',
        key: 'As1HiMj1PvLPlqc_gtM7AqZfBL8ZL3VrjaS3zIb22Uvb9WKhuJObROC-qUpa81U5'
      })
    })
  ],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

dragAndDropInteraction.on('addfeatures', function(event) {
  const vectorSource = new VectorSource({
    features: event.features
  });
  map.addLayer(new VectorLayer({
    renderMode: 'image',
    source: vectorSource,
    style: styleFunction
  }));
  map.getView().fit(vectorSource.getExtent());
});

const displayFeatureInfo = function(pixel) {
  const features = [];
  map.forEachFeatureAtPixel(pixel, function(feature) {
    features.push(feature);
  });
  if (features.length > 0) {
    const info = [];
    let i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      info.push(features[i].get('name'));
    }
    document.getElementById('info').innerHTML = info.join(', ') || '&nbsp';
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
  }
};

map.on('pointermove', function(evt) {
  if (evt.dragging) {
    return;
  }
  const pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function(evt) {
  displayFeatureInfo(evt.pixel);
});
