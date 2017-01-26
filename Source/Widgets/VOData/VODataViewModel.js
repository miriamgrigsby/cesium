/*global define*/
define([
    '../../Scene/BillboardCollection',
    '../../Core/BoundingRectangle',
    '../../Core/Cartesian3',
    '../../Core/Cartographic',
    '../../Core/Color',
    '../../Core/ColorGeometryInstanceAttribute',
    '../createCommand',
    '../../Core/GeometryInstance',
    '../../Scene/Material',
    '../../Core/Math',
    '../../Scene/PerInstanceColorAppearance',
    '../../Core/PinBuilder',
    '../../Scene/PointPrimitiveCollection',
    '../../Scene/PolylineCollection',
    '../../Core/PolygonGeometry',
    '../../Core/PolylinePipeline',
    '../../Scene/Primitive',
    '../../Scene/PrimitiveCollection',
    '../../ThirdParty/knockout',
    '../../Core/defineProperties',
    '../../Core/ScreenSpaceEventHandler',
    '../../Core/ScreenSpaceEventType',
], function (
        BillboardCollection,
        BoundingRectangle,
        Cartesian3,
        Cartographic,
        Color,
        ColorGeometryInstanceAttribute,
        createCommand,
        GeometryInstance,
        Material,
        CesiumMath,
        PerInstanceColorAppearance,
        PinBuilder,
        PointPrimitiveCollection,
        PolylineCollection,
        PolygonGeometry,
        PolylinePipeline,
        Primitive,
        PrimitiveCollection,
        knockout,
        defineProperties,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType
        ) {
    "use strict";

    function showPanel(that, configContainer) {

        if (!that._isVOPanelActive) {

            configContainer.className = 'cesium-voData-configContainer cesium-voData-configContainer-transition';
            var leftPositionStr = configContainer.style.left;
            var leftPositionStrTab = leftPositionStr.split("p");
            var leftPosition = parseInt(leftPositionStrTab);

            var panelMove = leftPosition - 400 + "px";
            configContainer.style.left = panelMove;
            configContainer.style.opacity = "1";

            that._isVOPanelActive = true;

        } else if (that._isVOPanelActive) {

            configContainer.className = 'cesium-voData-configContainer cesium-voData-configContainer-transition';
            var leftPositionStr = configContainer.style.left;
            var leftPositionStrTab = leftPositionStr.split("p");
            var leftPosition = parseInt(leftPositionStrTab);

            var panelMove = leftPosition + 400 + "px";
            configContainer.style.left = panelMove;
            configContainer.style.opacity = "0";

            that._isVOPanelActive = false;
        }
    }

    function inputValuesTest(inputField) {

        if (/^[0-9.,-]+$/g.test(inputField.value)) {
            return true;
        } else {

            console.log("Input Errors : " + "Please, enter a NUMBER type value for " + inputField.name.toUpperCase() + " in the format : XX.XX");
            alert("Please, enter a NUMBER type value for " + inputField.name.toUpperCase() + " in the format : XX.XX");
            return false;
        }
    }

    function createQueryV2(that, viewer, resultContainer, handlerLeftClick, planetName, inputObjects, serverUrl, extension, format, color) {

        var polygons = viewer.scene.primitives.add(new PrimitiveCollection());
        var polyLines = viewer.scene.primitives.add(new PolylineCollection());
        var points = viewer.scene.primitives.add(new PointPrimitiveCollection());
        var billboards = viewer.scene.primitives.add(new BillboardCollection());
        var ellipsoid = viewer.scene.globe.ellipsoid;

        var isLngMinValuesValid = inputValuesTest(inputObjects.lngMin);
        var isLngMaxValuesValid = inputValuesTest(inputObjects.lngMax);
        var isLatMinValuesValid = inputValuesTest(inputObjects.latMin);
        var isLatMaxValuesValid = inputValuesTest(inputObjects.latMax);

        var xhrVO = getRequest();

        if (isLngMinValuesValid && isLngMaxValuesValid && isLatMinValuesValid && isLatMaxValuesValid) {

            var lngMin = parseFloat(inputObjects.lngMin.value);
            var lngMax = parseFloat(inputObjects.lngMax.value);
            var latMin = parseFloat(inputObjects.latMin.value);
            var latMax = parseFloat(inputObjects.latMax.value);

            var queryPart1 = serverUrl + "?REQUEST=doQuery&LANG=ADQL&";
            var queryPart2 = "QUERY=SELECT * from " + extension + " where c1min>" + lngMin + "and c2min>" + latMin + "and c1max<" + lngMax + "and c2max<" + latMax + "&FORMAT=" + format;
            var query = queryPart1 + queryPart2;

            console.log(query);

            xhrVO.open('GET', query, true);
            xhrVO.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhrVO.send();
            xhrVO.onreadystatechange = function () {

                if (xhrVO.readyState == 4 && xhrVO.status == 200 || xhrVO.status == 0) {


                    var data = xhrVO.responseText;
                    // console.log(data);
                    var jsonData = JSON.parse(data);
                    console.log(jsonData);

                    var dataTab = []
                    dataTab = jsonData.data;

                    var columnNomTab = [];
                    columnNomTab = jsonData.columns;

                    var dimData = dataTab.length;

                    var lngMin = []; // C1Min
                    var latMin = []; // C2Min
                    var lngMax = []; // C1Max
                    var latMax = []; // C2Max
                    var dls = 361.0; // limit in degree
                    var dli = 0.0; // limit in degree

                    var count = 0;

                    var numberColumForCvalues = checkNumColumns(columnNomTab);

                    var stockLines = [];

                    for (var i = 0; i < dimData; i++) {
                        var arr = dataTab[i]; // correspond to 1 line in the data file

                        var C1Min = parseFloat(arr[numberColumForCvalues.c1min]);
                        var C1Max = parseFloat(arr[numberColumForCvalues.c1max]);
                        var C2Min = parseFloat(arr[numberColumForCvalues.c2min]);
                        var C2Max = parseFloat(arr[numberColumForCvalues.c2max]);

                        var isValuesValid = checkCValues(C1Min, C1Max, C2Min, C2Max);

                        if (isValuesValid == true && arr[numberColumForCvalues.access_format] == "text/plain") {

                            var addToList = selectionData(lngMin, lngMax, latMin, latMax, C1Min, C1Max, C2Min, C2Max);

                            if (addToList == true) { // we add coord in tabs and plot data on Cesium

                                lngMin.push(C1Min);
                                lngMax.push(C1Max);
                                latMin.push(C2Min);
                                latMax.push(C2Max);
                                
                                stockLines = arr;

                                generatePoints(C1Min, C1Max, C2Min, C2Max, viewer, points, ellipsoid, color);
                                addPropertiesInPointObject(stockLines, numberColumForCvalues, points, ellipsoid);

                            } else { // else we just stock data line a tab

                                stockLines = arr;
                                addPropertiesInPointObject(stockLines, numberColumForCvalues, points, ellipsoid);

                            }

                        } else if (isValuesValid == true && arr[numberColumForCvalues.access_format] == "application/x-pds") {

                            lngMin.push(C1Min);
                            lngMax.push(C1Max);
                            latMin.push(C2Min);
                            latMax.push(C2Max);

                            count++;

                            generatePolygons(C1Min, C1Max, C2Min, C2Max, viewer, polygons, polyLines, ellipsoid, color);

                        }
                    }

                    pickingActivation(that, viewer, handlerLeftClick, ellipsoid, billboards, resultContainer);

                }
            }
        }
    }


    /*
     function createQuery(that, viewer, planetName, inputObjects, serverUrl, format) {
     
     var serverName = "serverVO" + planetName.toLowerCase();
     var xhr = getRequest();
     var xhrVO = getRequest();
     
     var polygons = viewer.scene.primitives.add(new PrimitiveCollection());
     var polyLines = viewer.scene.primitives.add(new PolylineCollection());
     var points = viewer.scene.primitives.add(new PointPrimitiveCollection());
     var ellipsoid = viewer.scene.globe.ellipsoid;
     
     console.log(serverName);
     
     var isLngMinValuesValid = inputValuesTest(inputObjects.lngMin);
     var isLngMaxValuesValid = inputValuesTest(inputObjects.lngMax);
     var isLatMinValuesValid = inputValuesTest(inputObjects.latMin);
     var isLatMaxValuesValid = inputValuesTest(inputObjects.latMax);
     
     if (isLngMinValuesValid && isLngMaxValuesValid && isLatMinValuesValid && isLatMaxValuesValid) {
     
     var lngMin = parseFloat(inputObjects.lngMin.value);
     var lngMax = parseFloat(inputObjects.lngMax.value);
     var latMin = parseFloat(inputObjects.latMin.value);
     var latMax = parseFloat(inputObjects.latMax.value);
     
     var p1 = new Promise(
     function (resolve, reject) {
     
     xhr.open('GET', serverUrl, true);
     
     xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
     xhr.send();
     xhr.onload = function () {
     
     if (xhr.readyState == 4 && xhr.status == 200 || xhr.status == 0) {
     
     var data = xhr.responseText;
     
     var jsonData = JSON.parse(data);
     var server = jsonData.servers[serverName];
     
     //    console.log(jsonData);
     
     var queryPart1 = server.url + "?REQUEST=doQuery&LANG=ADQL&";
     
     var queryPart2 = "QUERY=SELECT * from " + server.extension + " where c1min>" + lngMin + "and c2min>" + latMin + "and c1max<" + lngMax + "and c2max<" + latMax + "&FORMAT=" + format;
     
     var query = queryPart1 + queryPart2;
     
     console.log(query);
     
     xhrVO.open('GET', query, true);
     xhrVO.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
     xhrVO.send();
     xhrVO.onreadystatechange = function () {
     
     if (xhrVO.readyState == 4 && xhrVO.status == 200 || xhrVO.status == 0) {
     
     var data = xhrVO.responseText;
     var jsonData = JSON.parse(data);
     //    console.log(jsonData);
     var dataTab = []
     dataTab = jsonData.data;
     
     var dimData = dataTab.length;
     
     var lngMin = []; // C1Min
     var latMin = []; // C2Min
     var lngMax = []; // C1Max
     var latMax = []; // C2Max
     var dls = 361.0; // limit in degree
     var dli = 0.0; // limit in degree
     
     for (var i = 0; i < dimData; i++) {
     var arr = dataTab[i];
     
     if (arr.length == 63) {
     
     var C1Min = parseFloat(arr[23]);
     var C1Max = parseFloat(arr[24]);
     var C2Min = parseFloat(arr[25]);
     var C2Max = parseFloat(arr[26]);
     } else if (arr.length == 58) {
     
     var C1Min = parseFloat(arr[18]);
     var C1Max = parseFloat(arr[19]);
     var C2Min = parseFloat(arr[20]);
     var C2Max = parseFloat(arr[21]);
     }
     
     
     
     // if (Math.abs(C1Min) =< dls && Math.abs(C1Min) >= dli && Math.abs(C2Min) =< dls && Math.abs(C1Min) =< dls && Math.abs(C1Min) =< dls &&){
     
     var isValuesValid = checkCValues(C1Min, C1Max, C2Min, C2Max);
     
     if (isValuesValid == true) {
     
     lngMin.push(C1Min);
     lngMax.push(C1Max);
     latMin.push(C2Min);
     latMax.push(C2Max);
     
     
     var geometryType = checkGeometryType(C1Min, C1Max, C2Min, C2Max);
     
     
     if (geometryType == 'points') {
     
     generatePoints(C1Min, C1Max, C2Min, C2Max, viewer, points, ellipsoid);
     
     } else if (geometryType == 'polygons') {
     
     generatePolygons(C1Min, C1Max, C2Min, C2Max, viewer, polygons, polyLines, ellipsoid);
     
     }
     
     
     
     }
     }
     
     // generatePoints(lngMin, lngMax, latMin, latMax, viewer);
     // generatePolygons(lngMin, lngMax, latMin, latMax, viewer);
     
     // les donn�es sont dans les objets data : valeures 23, 24, 25, 26
     }
     }
     
     resolve(query);
     
     } else {
     reject(xhr.status);
     }
     }
     });
     
     p1.then(
     function (result) {
     
     that._query = result;
     
     //        console.log(result);
     
     }).catch(
     function () {
     console.log("promesse rompue");
     });
     }
     }
     */

    /**Check values 
     * 
     * @param {type} C1Min
     * @param {type} C1Max
     * @param {type} C2Min
     * @param {type} C2Max
     * @returns {Boolean}
     */
    function checkCValues(C1Min, C1Max, C2Min, C2Max) {

        var dls = 361.0; // limit in degree
        var dli = 0.0; // limit in degree


        var isC1MinValid = false;
        var isC1MaxValid = false;
        var isC2MinValid = false;
        var isC2MaxValid = false;

        var isAllCValid = false;

        if (Math.abs(C1Min) <= dls && Math.abs(C1Min) >= dli && Math.abs(C1Min) <= Math.abs(C1Max)) {
            isC1MinValid = true;
        }
        if (Math.abs(C1Max) <= dls && Math.abs(C1Max) >= dli && Math.abs(C1Max) >= Math.abs(C1Min)) {
            isC1MaxValid = true;
        }

        if (Math.abs(C2Min) <= dls && Math.abs(C2Min) >= dli && Math.abs(C2Min) <= Math.abs(C2Max)) {
            isC2MinValid = true;
        }
        if (Math.abs(C2Max) <= dls && Math.abs(C2Max) >= dli && Math.abs(C2Max) >= Math.abs(C2Min)) {
            isC2MaxValid = true;
        }


        if (isC1MinValid == true && isC1MaxValid == true && isC2MinValid == true && isC2MaxValid == true) {
            isAllCValid = true;
        }
        return isAllCValid;
    }

    function checkGeometryType(C1Min, C1Max, C2Min, C2Max) {

        if (C1Min == C1Max && C2Min == C2Max) {
            return "points";
        } else {
            return "polygons";
        }
    }

    function checkNumColumns(columnNomen) {

        var num = {};

        for (var i = 0; i < columnNomen.length - 1; i++) {

            var columnI = columnNomen[i];
            var ColumnId = columnI.id;

            if (ColumnId == "c1min") {
                num[ColumnId] = i;
            } else if (ColumnId == "c1max") {
                num[ColumnId] = i;
            } else if (ColumnId == "c2min") {
                num[ColumnId] = i;
            } else if (ColumnId == "c2max") {
                num[ColumnId] = i;
            } else if (ColumnId == "c3min") {
                num[ColumnId] = i;
            } else if (ColumnId == "c3max") {
                num[ColumnId] = i;
            } else if (ColumnId == "access_format") {
                num[ColumnId] = i;
            } else if (ColumnId == "measurement_type") {
                num[ColumnId] = i;
            } else if (ColumnId == "access_url") {
                num[ColumnId] = i;
            }
        }

        return num;
    }

    function selectionData(lngMin, lngMax, latMin, latMax, C1Min, C1Max, C2Min, C2Max) {

        var dimTab = lngMin.length;

        // console.log(dimTab);

        var isC1minInList = false;
        var isC1maxInList = false;
        var isC2minInList = false;
        var isC2maxInList = false;

        var addToList = true;

        for (var i = 0; i < dimTab; i++) {

            //   console.log(lngMin[i], lngMax[i], latMin[i], latMax[i]);
            //   console.log(C1Min, C1Max, C2Min, C2Max);
            //   console.log(isC1minInList, isC1maxInList, isC2minInList, isC2maxInList);

            if (lngMin[i] == C1Min && lngMax[i] == C1Max && latMin[i] == C2Min && latMax[i] == C2Max) {
                isC1minInList = true;
                isC1maxInList = true;
                isC2minInList = true;
                isC2maxInList = true;

                break;
            }

            //   console.log(isC1minInList, isC1maxInList, isC2minInList, isC2maxInList);

        }
        //  console.log("booleens finaux");
        //  console.log(isC1minInList, isC1maxInList, isC2minInList, isC2maxInList);

        if (isC1minInList === true && isC1maxInList === true && isC2minInList === true && isC2maxInList === true) {
            addToList = false;
            //     console.log(addToList);
        }

        //console.log(addToList);


        return addToList;

    }

    function  generatePoints(lngMin, lngMax, latMin, latMax, viewer, points, ellipsoid, colorPoints) {

        //  var ellipsoid = viewer.scene.globe.ellipsoid;
        // var points = viewer.scene.primitives.add(new PointPrimitiveCollection());

        var coordX = lngMin;
        var coordY = latMin;

        var newPoints = {
            position: Cartesian3.fromDegrees(coordX, coordY, 0, ellipsoid),
            color: Color[colorPoints],
            pixelSize: 5,
            property: "test"
        };

        //   console.log(newPoints);
        points.add(newPoints);
    }

    function generatePolygons(lngMin, lngMax, latMin, latMax, viewer, polygons, polyLines, ellipsoid, colorPolygons) {

        var polygonsCoord = [];

        var point1 = [lngMin, latMin];
        var point2 = [lngMax, latMin];
        var point3 = [lngMax, latMax];
        var point4 = [lngMin, latMax];
        var point5 = point1;

        var tabPoints = [point1, point2, point3, point4, point5];

        for (var j = 0; j < tabPoints.length - 1; j++) {

            var pt = tabPoints[j];

            for (var k = 0; k < pt.length; k++) {
                //   console.log(pt[k]);
                polygonsCoord.push(pt[k] * (Math.PI / 180.0));
            }
        }

        for (var j = 0; j < tabPoints.length - 1; j++) {

            var ptJ = tabPoints[j];
            var ptJp1 = tabPoints[j + 1];

            var lineTab = [ptJ, ptJp1];

            var arrayRadians = [];

            for (var k = 0; k < lineTab.length; k++) {

                var ptk = lineTab[k];

                for (var l = 0; l < ptk.length; l++) {
                    arrayRadians.push(ptk[l] * (Math.PI / 180.0));
                }
            }

            var newPolyLine = {
                positions: PolylinePipeline.generateCartesianArc({
                    positions: Cartesian3.fromRadiansArray(arrayRadians, ellipsoid),
                    ellipsoid: ellipsoid,
                    width: 10,
                }),
                material: Material.fromType('Color', {
                    color: Color.YELLOW
                }),
                asynchronous: false
            };

            polyLines.add(newPolyLine);
        }


        var polygonsCoordDegree = Cartesian3.fromRadiansArray(polygonsCoord, ellipsoid);

        var polygonInstance = new GeometryInstance({
            geometry: PolygonGeometry.fromPositions({
                positions: polygonsCoordDegree,
                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
                ellipsoid: ellipsoid}),
            attributes: {
                // color: ColorGeometryInstanceAttribute.fromColor(new Color(1.0, 1.0, 0.0, 0.1))
                color: ColorGeometryInstanceAttribute.fromColor(Color[colorPolygons])
            }
        });

        var newPolygon = new Primitive({
            geometryInstances: polygonInstance,
            appearance: new PerInstanceColorAppearance({
                closed: true,
                translucent: true
            })
        });

        polygons.add(newPolygon);
    }


    function addPropertiesInPointObject(stockLines, numberColumForCvalues, points, ellipsoid) {

        var C1Min = parseFloat(stockLines[numberColumForCvalues.c1min]);
        var C1Max = parseFloat(stockLines[numberColumForCvalues.c1max]);
        var C2Min = parseFloat(stockLines[numberColumForCvalues.c2min]);
        var C2Max = parseFloat(stockLines[numberColumForCvalues.c2max]);

        console.log(C1Min, C2Min);
        console.log(points);

        var pointsTab = points._pointPrimitives;

        for (var i = 0; i < pointsTab.length; i++) {

            var position = pointsTab[i]._position;
            console.log(position.x.toFixed(4));

            var cartPos = Cartesian3.fromDegrees(C1Min, C2Min, 0, ellipsoid);
            console.log(cartPos.x.toFixed(4));
            
            if (position.x.toFixed(4) == cartPos.x.toFixed(4)){
                
                var prop =  pointsTab[i].properties;
                
                if (!prop){
                    prop =  [];
                    prop.push(stockLines);
                    pointsTab[i].properties = prop;   
                } else {  
                    prop.push(stockLines);
                    pointsTab[i].properties = prop;   
                    
                }
 
            }
        }
        
        console.log(points._pointPrimitives);

    }


    function pickingActivation(that, viewer, handlerLeftClick, ellipsoid, billboards, resultContainer) {

        handlerLeftClick.setInputAction(function (click) {

            var cartesian = viewer.scene.camera.pickEllipsoid(click.position, ellipsoid);
            var pickedObject = viewer.scene.pick(click.position);

            if (pickedObject) {

                console.log(pickedObject);

                var longitudeString, latitudeString;
                var cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);

                if (cartesian) {
                    var cartographic = Cartographic.fromCartesian(cartesian);
                    longitudeString = CesiumMath.toDegrees(cartographic.longitude);
                    latitudeString = CesiumMath.toDegrees(cartographic.latitude);
                }

                try {
                    resultContainer.removeChild(that._divRes);

                    that._divRes = document.createElement("div");
                    that._divRes.className = 'cesium-voData-divRes';
                    resultContainer.appendChild(that._divRes);

                    var fieldsetRequest = document.createElement('FIELDSET');
                    that._divRes.appendChild(fieldsetRequest);

                    var legendRequest = document.createElement('LEGEND');
                    legendRequest.innerHTML = "Plot parameters";
                    fieldsetRequest.appendChild(legendRequest);

                } catch (e) {

                    that._divRes = document.createElement("div");
                    that._divRes.className = 'cesium-voData-divRes';
                    resultContainer.appendChild(that._divRes);

                    var fieldsetRequest = document.createElement('FIELDSET');
                    that._divRes.appendChild(fieldsetRequest);

                    var legendRequest = document.createElement('LEGEND');
                    legendRequest.innerHTML = "Plot parameters";
                    fieldsetRequest.appendChild(legendRequest);

                }







                /*    var canvas = document.createElement("CANVAS");
                 canvas.className = 'cesium-voData-canvas';  
                 canvas.id = 'canvasVOId';
                 
                 resultContainer.appendChild(canvas);*/



            }

        }, ScreenSpaceEventType.LEFT_CLICK);
    }
















    /** generate polygons from VO data
     * 
     * @param {type} lngMin
     * @param {type} lngMax
     * @param {type} latMin
     * @param {type} latMax
     * @returns {undefined}
     */
    function generatePolygonsOld(lngMin, lngMax, latMin, latMax, viewer) {

        var ellipsoid = viewer.scene.globe.ellipsoid;
        var polygons = viewer.scene.primitives.add(new PrimitiveCollection());
        var polyLines = viewer.scene.primitives.add(new PolylineCollection());

        if (lngMin.length > 0) {

            for (var i = 0; i < lngMin.length; i++) {

                var polygonsCoord = [];

                var point1 = [lngMin[i], latMin[i]];
                var point2 = [lngMax[i], latMin[i]];
                var point3 = [lngMax[i], latMax[i]];
                var point4 = [lngMin[i], latMax[i]];
                var point5 = point1;

                var tabPoints = [point1, point2, point3, point4, point5];

                for (var j = 0; j < tabPoints.length - 1; j++) {

                    var pt = tabPoints[j];

                    for (var k = 0; k < pt.length; k++) {
                        //   console.log(pt[k]);
                        polygonsCoord.push(pt[k] * (Math.PI / 180.0));
                    }
                }

                for (var j = 0; j < tabPoints.length - 1; j++) {

                    var ptJ = tabPoints[j];
                    var ptJp1 = tabPoints[j + 1];

                    var lineTab = [ptJ, ptJp1];

                    var arrayRadians = [];

                    for (var k = 0; k < lineTab.length; k++) {

                        var ptk = lineTab[k];

                        for (var l = 0; l < ptk.length; l++) {
                            arrayRadians.push(ptk[l] * (Math.PI / 180.0));
                        }
                    }

                    var newPolyLine = {
                        positions: PolylinePipeline.generateCartesianArc({
                            positions: Cartesian3.fromRadiansArray(arrayRadians, ellipsoid),
                            ellipsoid: ellipsoid,
                            width: 10,
                        }),
                        material: Material.fromType('Color', {
                            color: Color.RED
                        }),
                        asynchronous: false
                    };

                    polyLines.add(newPolyLine);
                }


                var polygonsCoordDegree = Cartesian3.fromRadiansArray(polygonsCoord, ellipsoid);

                var polygonInstance = new GeometryInstance({
                    geometry: PolygonGeometry.fromPositions({
                        positions: polygonsCoordDegree,
                        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
                        ellipsoid: ellipsoid,
                        height: 0.0}),
                    attributes: {
                        color: ColorGeometryInstanceAttribute.fromColor(new Color(0.1, 0.1, 0.0, 0.01))
                    }
                });

                var newPolygon = new Primitive({
                    geometryInstances: polygonInstance,
                    appearance: new PerInstanceColorAppearance({
                        closed: true,
                        translucent: true
                    })
                });

                polygons.add(newPolygon);

            }
        }
    }

    function getRequest() {
        if (window.XMLHttpRequest) {// code for IE7+, Firefox, Chrome, Opera, Safari
            var xhr = new XMLHttpRequest();
        } else if (typeof ActiveXObject !== " undefined") {
            var xhr = new ActiveXObject("Microsoft.XMLHTTP"); // activeX pour IE
            console.log("IE");
        } else {
            console.log("AJAX don't available on this browser");
            var xhr = null;
        }
        return xhr;
    }

    /**
     * The view model for {@link VOData}.
     * @alias VODataViewModel
     * @constructor
     */
    var VODataViewModel = function (viewer, planetName, configContainer, listContainer, btnContainer, resultContainer, inputObjects, dimServers, dimData, inputTab) {

        // ************************ initialization *****************************

        this._viewer = viewer;
        this._planetName = planetName;
        this._configContainer = configContainer;
        this._listContainer = listContainer;
        this._btnContainer = btnContainer;
        this._inputObjects = inputObjects;
        this._resultContainer = resultContainer;
        this._query = null;
        this._format = "json";
        this._divRes = null;

        for (var i = 0; i < dimServers; i++) {
            for (var j = 0; j < dimData; j++) {
                this['showData_' + i + "_" + j] = knockout.observable(true); // METTRE A FALSE
            }
        }

        this._isVOPanelActive = false;

        var that = this;

        // ************************** Commands *********************************

        this._showPanelCommand = createCommand(function () {
            showPanel(that, that._configContainer);
        });

        this._getDataCommand = createCommand(function () {

            removeHandlers(that);
            that._handlerLeftClick = new ScreenSpaceEventHandler(viewer.scene.canvas);

            var tabExtension = [];
            var tabServerUrl = [];

            for (var i = 0; i < inputTab.length; i++) {

                if (inputTab[i].checked == true) {
                    tabExtension.push(inputTab[i].extension);
                    tabServerUrl.push(inputTab[i].serverUrl);
                }
            }

            if (that._viewer.scene.primitives.length > 0) {
                try {
                    that._viewer._dataSourceCollection.removeAll();
                    that._viewer.scene.primitives.removeAll();
                } catch (e) {
                    //  console.log(e)
                }
            }

            var color = ["RED", "GREEN"];

            if (tabExtension.length > 0) {

                for (var i = 0; i < tabExtension.length; i++) {
                    createQueryV2(that, that._viewer, that._resultContainer, that._handlerLeftClick, that._planetName, that._inputObjects, tabServerUrl[i], tabExtension[i], that._format, color[i]);


                    //  getVOData(that._query);
                }
            }



        });


        //  knockout.track(this, []);

    };
    defineProperties(VODataViewModel.prototype, {
        /**
         * Gets the Command that is executed when the button is clicked.
         * @memberof VODataViewModel.prototype
         *
         * @type {Command}
         */
        getDataCommand: {
            get: function () {
                return this._getDataCommand;
            }
        },
        showPanelCommand: {
            get: function () {
                return this._showPanelCommand;
            }
        },
        isVOPanelActive: {
            get: function () {
                return this._isVOPanelActive;
            },
            set: function (value) {
                this._isVOPanelActive = value;
            }
        },
        hidePanel: {
            get: function () {
                if (this._isVOPanelActive) {
                    showPanel(this, this._configContainer);
                }
            }
        },
    });





    function removeHandlers(that) {

        if (that._handlerLeftClick)
            that._handlerLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
    }

    return VODataViewModel;
});
