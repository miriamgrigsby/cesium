/*global define*/
define([//  Definition des dependances
    'Cesium/Core/Cartesian3',
    'Cesium/Scene/createOpenStreetMapImageryProvider',
    'Cesium/Core/defined',
    'Cesium/Core/formatError',
    'Cesium/Core/getFilenameFromUri',
    'Cesium/Core/queryToObject',
    'Cesium/Core/Credit',
    'Cesium/Core/Color',
    'Cesium/Core/DefaultProxy',
    'Cesium/Core/defaultValue',
    'Cesium/Core/Ellipsoid',
    'Cesium/Core/EllipsoidTerrainProvider',
    'Cesium/Core/freezeObject',
    'Cesium/Core/loadJson',
    'Cesium/Core/Math',
    'Cesium/Core/Rectangle',
    'Cesium/Core/GeographicProjection',
    'Cesium/Core/StereographicProjection',
    'Cesium/Core/NearFarScalar',
    'Cesium/Core/ScreenSpaceEventHandler',
    'Cesium/Core/ScreenSpaceEventType',
    'Cesium/DataSources/CzmlDataSource',
    'Cesium/DataSources/GeoJsonDataSource',
    'Cesium/DataSources/KmlDataSource',
    'Cesium/DataSources/LabelGraphics',
    'Cesium/Scene/ImageryLayer',
    'Cesium/Scene/createTileMapServiceImageryProvider',
    //'Cesium/Scene/IIPImageryProvider',
    'Cesium/Scene/GridImageryProvider',
    'Cesium/Scene/WebMapServiceImageryProvider',
    'Cesium/Scene/WebMapTileServiceImageryProvider',
    'Cesium/Scene/TileCoordinatesImageryProvider',
    'Cesium/Scene/SkyAtmosphere',
    'Cesium/Scene/SkyBox',
    'Cesium/Scene/Globe',
    //'Cesium/Core/GeoServerTerrainProvider',
    'Cesium/Widgets/Viewer/Viewer',
    'Cesium/Widgets/Viewer/viewerCesiumInspectorMixin',
    'Cesium/Widgets/Viewer/viewerDragDropMixin',
    'Cesium/Widgets/createCommand',
    'Cesium/ThirdParty/knockout',
    'Cesium/ThirdParty/when',
], function (
        Cartesian3,
        createOpenStreetMapImageryProvider,
        defined,
        formatError,
        getFilenameFromUri,
        queryToObject,
        Credit,
        Color,
        DefaultProxy,
        defaultValue,
        Ellipsoid,
        EllipsoidTerrainProvider,
        freezeObject,
        loadJson,
        CesiumMath,
        Rectangle,
        GeographicProjection,
        StereographicProjection,
        NearFarScalar,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType,
        CzmlDataSource,
        GeoJsonDataSource,
        ImageryLayer,
        KmlDataSource,
        LabelGraphics,
        createTileMapServiceImageryProvider,
        GridImageryProvider,
        WebMapServiceImageryProvider,
        WebMapTileServiceImageryProvider,
        TileCoordinatesImageryProvider,
        SkyAtmosphere,
        SkyBox,
        Globe,
        Viewer,
        viewerCesiumInspectorMixin,
        viewerDragDropMixin,
        createCommand,
        knockout,
        when) {
    "use strict";
    /*global console*/

    /*
     * 'debug'  : true/false,   // Full WebGL error reporting at substantial performance cost.
     * 'lookAt' : CZML id,      // The CZML ID of the object to track at startup.
     * 'source' : 'file.czml',  // The relative URL of the CZML file to load at startup.
     * 'stats'  : true,         // Enable the FPS performance display.
     * 'theme'  : 'lighter',    // Use the dark-text-on-light-background theme.
     * 'scene3DOnly' : false    // Enable 3D only mode.
     */

    // URL of the configuration file

    var urlConfig = '../../Source/Widgets/ConfigurationFiles/configurationFile.json';


    // Here, we use the request to create the "endUserOptions" object.

    /* example : 
     
     http://localhost:8080/Apps/CesiumMarsViewer/index.html            ==> request without parameters. Hence : endUserOptions = {} 
     http://localhost:8080/Apps/CesiumMarsViewer/index.html?map=themis ==> request with one parameter. Hence : endUserOptions = { map : "themis"}.
     */

    /** Query  parameters: 
     * 
     * ellipsoidType         = name.  Type of ellipsoid to use (predefined or customized. See here after)) 
     * ellipsoidSize         = x,y,z. (Dimensions of the ellipsoid)
     * NAIFCodes             = a,b. Naif codes for planet ("a" parameter) and satellite ("b" parameter). for a planet (Mars for example), use a=4, b=0;                        
     * imageryProviderParams = params for the imagery provider. 
     *                         Example : SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:4326&STYLES=&REQUEST=GetMap&FORMAT=image%2Fjpeg&LAYERS=THEMIS&BBOX=221,15,231,25&WIDTH=1000&HEIGHT=1000'    
     * onlineResUrl          = url of the online ressource.
     *                         Example : http://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map                                                                                 
     */
    var endUserOptions = queryToObject(window.location.search.substring(1));

    /* 
     - Implementation of the selection of the predefined ellipsoid from the request. 1 parameter must be used : ellipsoidType. 
     example of use : http://localhost:8080/Apps/PlanetaryCesiumViewer/index.html?ellipsoidType=MARSIAU2000. 
     predefined ellipsoid names availables : WGS84, MARSIAU2000, MARSSPHE, MOON, UNIT_SPHERE. 
     
     ==> htmlRequest?ellipsoidType=ellipsoidName
     
     - Implementation of the customized ellipsoid from the request. 2 parameter must be used : ellipsoidType and ellipsoidSize.
     ellipsoidSize is the dimensions of the ellipsoid. ellipsoidSize=x,y,z
     
     example of use : http://localhost:8080/Apps/PlanetaryCesiumViewer/index.html?ellipsoidType=ELLIPSOID_1&&ellipsoidSize=1.0,1.2 1.4
     
     If ellipsoidType is equal to one of the predefined ellipsoid then the second parameter is ignored.   
     
     example:         http://localhost:8080/Apps/PlanetaryCesiumViewer/index.html?ellipsoidType=WGS84&ellipsoidSize=1.0,1.2 1.4 will 
     return  http://localhost:8080/Apps/PlanetaryCesiumViewer/index.html?ellipsoidType=WGS84 
     
     ==> htmlRequest?ellipsoidType=ellipsoidName&ellipsoidSize=x,y,z 
     */

    var globeParam;              /* *** NEW *** */
    var mapProjectionParam;      /* *** NEW *** */
    var terrainProviderParam;    /* *** NEW *** */
    var ellipsoidImageryParam;   /* *** NEW *** */

    if (typeof endUserOptions.ellipsoidType !== 'undefined') {

        Ellipsoid.modify(Ellipsoid, endUserOptions);

        Ellipsoid.used = endUserOptions.ellipsoidType.toString().toUpperCase();

        globeParam = new Globe(Ellipsoid[endUserOptions.ellipsoidType.toString().toUpperCase()]);
        mapProjectionParam = new GeographicProjection(Ellipsoid[endUserOptions.ellipsoidType.toString().toUpperCase()]);
        terrainProviderParam = new EllipsoidTerrainProvider({ellipsoid: Ellipsoid[endUserOptions.ellipsoidType.toString().toUpperCase()]});
        ellipsoidImageryParam = Ellipsoid[endUserOptions.ellipsoidType.toString().toUpperCase()];

    } else if (!endUserOptions.ellipsoidType) {

        Ellipsoid.used = "WGS84";

        globeParam = new Globe(Ellipsoid.WGS84);
        mapProjectionParam = new GeographicProjection(Ellipsoid.WGS84);
        terrainProviderParam = new EllipsoidTerrainProvider({ellipsoid: Ellipsoid.WGS84});
        ellipsoidImageryParam = Ellipsoid.WGS84;
    }

    var imageryProvider;

    /* 
     
     // request parameters to get a Map : 
     
     // SERVICE : Name of the OGC services.
     // VERSION : Number of the WMS protocol versions.
     // STYLES  : Styles lit used for each LAYERS
     // REQUEST : Three possible operations : GetCapabilities, GetMap, GetFeatureInfo.
     // FORMAT  : type of the returned image ???
     // LAYERS  : Liste des desired layers.
     // BBOX    : the map size (longitude min,latitude min, longitude max, latitude max 
     // WIDTH   : Width of the image.
     // HEIGHT  : Height of the image.
     
     var urlParams        = endUserOptions.imageryProviderParams;
     var onlineResUrl     = endUserOptions.onlineResUrl;
     var tabParams        = urlParams.split(';');
     var propretiesObject = ['SERVICE', 'VERSION', 'SRS', 'STYLES', 'REQUEST', 'FORMAT', 'LAYERS', 'BBOX', 'WIDTH', 'HEIGHT'];
     var urlParam         = "";
     */

    var loadingIndicator = document.getElementById('loadingIndicator');

    var viewer;

    var viewerOptions = {
        mapProjection: mapProjectionParam, // The map projection to use in 2D and Columbus View modes (class : GeographicProjection).		
        globe: globeParam, //  The globe to use in the scene. (class : Globe)
        baseLayerPicker: false,
        imageryProvider: imageryProvider, // Fournit l'image a afficher sur le globe.
        terrainProvider: terrainProviderParam,
        scene3DOnly: endUserOptions.scene3DOnly, // show 3D scene directly.
        skyAtmosphere: false, // atm visualisation.
        skyBox: new SkyBox({show: false}), // stars visualisation (calcul�s).
        selectionIndicator: false,
        timeline: false, // for files which contains the temporal dimension
        animation: false, // for animation which displayed with the time 
        navigationInstructionsInitiallyVisible: false,
        showSystems: true,
        tools: true,
        VOData: false
    }

    function viewerCreation(configuration) {

        try {
            viewerOptions.configuration = configuration // contains configuration (see ./sources/widget/ConfigurationFiles/ )
            viewer = new Viewer('cesiumContainer', viewerOptions);

        } catch (exception) {
            loadingIndicator.style.display = 'none';
            var message = formatError(exception);
            console.error(message);
            if (!document.querySelector('.cesium-widget-errorPanel')) {
                window.alert(message);
            }
            return;
        }

        var xhr = getXMLHttpRequest();
        var url = '../../Source/Widgets/ConfigurationFiles/SolarSystemConfig.json';

        viewer.extend(viewerDragDropMixin);
        if (endUserOptions.inspector) {
            viewer.extend(viewerCesiumInspectorMixin);
        }

        var showLoadError = function (name, error) {
            var title = 'An error occurred while loading the file: ' + name;
            var message = 'An error occurred while loading the file, which may indicate that it is invalid.  A detailed error report is below:';
            viewer.cesiumWidget.showErrorPanel(title, message, error);
        };

        viewer.dropError.addEventListener(function (viewerArg, name, error) {
            showLoadError(name, error);
        });

        var scene = viewer.scene;
        var context = scene.context;

        // =================== default color of the globe ======================

        scene.globe.baseColor = Color.BLACK;

        // ==================== unable fog, moon and sun =======================

        scene.fog.enabled = false;
        scene.moon.show = false;
        scene.sun.show = false;

        // =====================================================================

        if (endUserOptions.debug) {
            context.validateShaderProgram = true;
            context.validateFramebuffer = true;
            context.logShaderCompilation = true;
            context.throwOnWebGLError = true;
        }

        if (endUserOptions.source) {
            var source = endUserOptions.source;
        }
        if (defined(source)) {
            var dataSource;
            var loadPromise;

            if (/\.czml$/i.test(source)) {
                dataSource = new CzmlDataSource(getFilenameFromUri(source));
                loadPromise = dataSource.loadUrl(source);
            } else if (/\.geojson$/i.test(source) || /\.json$/i.test(source) || /\.topojson$/i.test(source)) {


                //console.log(source);

                dataSource = new GeoJsonDataSource(getFilenameFromUri(source), {
                    markerColor: Color.RED
                });
                loadPromise = dataSource.load(source);
            } else if (/\.kml$/i.test(source) || /\.kmz$/i.test(source)) {
                dataSource = new KmlDataSource(getFilenameFromUri(source));
                loadPromise = dataSource.load(source);
            } else {
                showLoadError(source, 'Unknown format.');
            }

            if (defined(loadPromise)) {
                viewer.dataSources.add(loadPromise).then(function (dataSource) {
                    var lookAt = endUserOptions.lookAt;
                    if (defined(lookAt)) {
                        var entity = dataSource.entities.getById(lookAt);
                        if (defined(entity)) {
                            viewer.trackedEntity = entity;
                        } else {
                            var error = 'No entity with id "' + lookAt + '" exists in the provided data source.';
                            showLoadError(source, error);
                        }
                    }
                }).otherwise(function (error) {
                    showLoadError(source, error);
                });
            }
        }

        if (endUserOptions.stats) {
            scene.debugShowFramesPerSecond = true;
        }

        var theme = endUserOptions.theme;
        if (defined(theme)) {
            if (endUserOptions.theme === 'lighter') {
                document.body.classList.add('cesium-lighter');
                viewer.animation.applyThemeChanges();
            } else {
                var error = 'Unknown theme: ' + theme;
                viewer.cesiumWidget.showErrorPanel(error, '');
            }
        }
        loadingIndicator.style.display = 'none';
    }

    /* =========================================================================
     ======================== READ CONFIGURATION FILES =========================
     =========================================================================== */

    function getXMLHttpRequest() {
        if (window.XMLHttpRequest) {// code for IE7+, Firefox, Chrome, Opera, Safari
            var xhr = new XMLHttpRequest();
        } else if (typeof ActiveXObject !== " undefined") {
            var xhr = new ActiveXObject("Microsoft.XMLHTTP"); // activeX pour IE
        } else {
            console.log("AJAX don't available on this browser");
            var xhr = null;
        }
        return xhr;
    }

    // Solar system configuration : 

    if (viewerOptions.showSystems == true) {

        var xhr = getXMLHttpRequest();

        // var urlConfig = '../../Source/Widgets/ConfigurationFiles/configurationFile.json';

        xhr.open('GET', urlConfig, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send();
        xhr.onreadystatechange = function () {

            if (xhr.readyState == 4 && xhr.status == 200 || xhr.status == 0) {

                var data = xhr.responseText;
                var jsonData = JSON.parse(data);

                var configuration = {};

                configuration = {
                    homePlanet: jsonData.homePlanet,
                    servers: jsonData.servers,
                    planetarySystem: {
                        system: jsonData.planetarySystem.solarSystem,
                        dimension: jsonData.planetarySystem.systemsDimensions
                    }
                };

                viewerCreation(configuration);
            }
        };
    } else if (viewerOptions.showSystems == false || viewerOptions.showSystems == 'undefined') {

        var imageryProvider = new createOpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/'
        });

        viewerOptions.imageryProvider = imageryProvider;

        var configuration = null;
        viewerCreation(configuration);
    }
});