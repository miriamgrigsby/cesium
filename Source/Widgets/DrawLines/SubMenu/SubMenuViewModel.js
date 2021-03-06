// 275.484,39.095 ==> Coordonnees du stade
// 256.955,42.127 ==> coordonn�es des cercles de cultures

/*global define*/
define([
    '../../../Core/Cartesian3',
    '../../../Core/CircleGeometry',
    '../../../Core/CircleOutlineGeometry',
    '../../../Core/Color',
    '../../../Core/ColorGeometryInstanceAttribute',
    '../../../Core/defineProperties',
    '../../../Core/GeometryInstance',
    '../../../Core/Math',
    '../../../Core/NearFarScalar',
    '../../../Core/PolygonGeometry',
    '../../../Core/PolylinePipeline',
    '../../../Core/ScreenSpaceEventHandler',
    '../../../Core/ScreenSpaceEventType',
    '../../../DataSources/GeoJsonDataSource',
    '../../../Scene/HorizontalOrigin',
    '../../../Scene/LabelCollection',
    '../../../Scene/LabelStyle',
    '../../../Scene/Material',
    '../../../Scene/PerInstanceColorAppearance',
    '../../../Scene/PolylineCollection',
    '../../../Scene/Primitive',
    '../../../Scene/PrimitiveCollection',
    '../../../Scene/VerticalOrigin',
    '../../../ThirdParty/knockout',
    '../../createCommand'
], function (
        Cartesian3,
        CircleGeometry,
        CircleOutlineGeometry,
        Color,
        ColorGeometryInstanceAttribute,
        defineProperties,
        GeometryInstance,
        CesiumMath,
        NearFarScalar,
        PolygonGeometry,
        PolylinePipeline,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType,
        GeoJsonDataSource,
        HorizontalOrigin,
        LabelCollection,
        LabelStyle,
        Material,
        PerInstanceColorAppearance,
        PolylineCollection,
        Primitive,
        PrimitiveCollection,
        VerticalOrigin,
        knockout,
        createCommand) {
    'use strict';

    var targetMouse;

    /** function to draw lines
     * 
     * @param {type} that
     * @param {type} viewer
     * @param {type} polyLines
     * @param {type} polyLinesLabels
     * @returns {undefined}
     */
    function drawLinesFunction(that, viewer, polyLines, polyLinesLabels) {

        document.onmousemove = getPosition;

        if (that.isPolyLineActive) {

            // ====================== HANDLERS DECLARATION =====================

            that._handlerLeftClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMiddleClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerRightClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerDblLeftClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

            // ====================== ARRAYS INITIALIZATION =====================

            var arrayRadians = [];
            var middlePoint = {};
            var oldLabel;

            // ============ ACTION TO PERFORM FOR THE LEFT CLICK ===============

            // Left clic is used to selection a position on the globe in order to
            // draw the line. This action is associted to the move mouse Event in
            // order to create an animation of the drawn line

            that._handlerLeftClick.setInputAction(function (click) {
                that._undoIsactivated = false;
                var newPolyLine;

                // get the current ellipsoid

                var ellipsoid = viewer.scene.globe.ellipsoid;

                // get the coordinates of the clicked position on the ellipsoid

                var cartesian = viewer.scene.camera.pickEllipsoid(click.position, ellipsoid);

                // Check if the clicked position is on the canvas and on the globe

                if (cartesian && targetMouse === '[object HTMLCanvasElement]') {

                    // From (x,y,z) coordinates (in m) to (lng, lat) coordinates (in radians)

                    var cartographic = ellipsoid.cartesianToCartographic(cartesian);

                    // if the undo option is not activated, then introduce the clicked postion in the arrayRadians

                    if (!that._undoIsactivated) {
                        arrayRadians.push(cartographic.longitude);
                        arrayRadians.push(cartographic.latitude);
                    }

                    // ======== ACTION TO PERFORM FOR THE CURSOR SHIFT =========

                    that._handlerMove.setInputAction(function (mouvement) {

                        // When the cursor is shifted, we get the coordinate of the each position

                        var cartesianMovePosition = viewer.scene.camera.pickEllipsoid(mouvement.endPosition, ellipsoid);
                        var cartographicMovePosition;

                        // Check if the position is on the canvas and on the globe

                        if (cartesianMovePosition && targetMouse === '[object HTMLCanvasElement]') {

                            // From (x,y,z) coordinates (in m) to (lng, lat) coordinates (in radians)

                            cartographicMovePosition = ellipsoid.cartesianToCartographic(cartesianMovePosition);

                            // we need only 2 points to draw a line ==> 4 components for the arrayRadians (lng_1, lat_1, lng_2, lat_2) (in radians).
                            // if lng_2, lat_2 already exist, then we change it with the new coordinates. 
                            // if lng_2, lat_2 doesn't exist, we introduce the coordinate in the arrays

                            if (arrayRadians[2] && arrayRadians[3]) {
                                arrayRadians[2] = cartographicMovePosition.longitude;
                                arrayRadians[3] = cartographicMovePosition.latitude;
                            } else {
                                arrayRadians.push(cartographicMovePosition.longitude);
                                arrayRadians.push(cartographicMovePosition.latitude);
                            }
                        }

                        // If we have 2 points (i.e 4 components in arrayRadians), then

                        if (arrayRadians.length === 4) {

                            // create an object which contains parameters to draw a line

                            newPolyLine = {
                                positions: PolylinePipeline.generateCartesianArc({
                                    positions: Cartesian3.fromRadiansArray(arrayRadians, ellipsoid),
                                    ellipsoid: ellipsoid
                                }),
                                material: Material.fromType('Color', {
                                    color: Color.BLUE
                                }),
                                asynchronous: false
                            };

                            // Compute the distance between the 2 points

                            var startPoint = Cartesian3.fromRadians(arrayRadians[0], arrayRadians[1], cartographic.height, ellipsoid);
                            var endPoint = Cartesian3.fromRadians(arrayRadians[2], arrayRadians[3], cartographicMovePosition.height, ellipsoid);
                            var distance = Cartesian3.distance(endPoint, startPoint);
                            var distanceTrunc = distance.toFixed(2);

                            // create the label associated to the line

                            var newLabelPolyline = {
                                position: cartesianMovePosition,
                                text: 'D = ' + distanceTrunc + ' m',
                                scale: 0.3,
                                font: '50px arial',
                                fillColor: Color.WHITE,
                                outlineColor: Color.BLACK,
                                style: LabelStyle.FILL,
                                horizontalOrigin: HorizontalOrigin.LEFT,
                                verticalOrigin: VerticalOrigin.BOTTOM,
                                translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                            };

                            // Add the line to the polyline Collection (draw it)

                            polyLines.add(newPolyLine);

                            // *************************************************  
                            // ** remove the old line to create the animation **
                            // ************************************************* 

                            // get the number of lines in the polyLine Collection

                            var dim = polyLines._polylines.length;

                            // If there is more than 1 line in the collection, 
                            // wer remove the before last one

                            if (dim > 1) {
                                var polyline = polyLines._polylines[dim - 2];
                                polyLines.remove(polyline);
                            }

                            // Idem for the label

                            if (oldLabel) {
                                var dimLabel = polyLinesLabels._labels.length;
                                var primitiveLabel = polyLinesLabels._labels[dimLabel - 1];
                                polyLinesLabels.remove(primitiveLabel);
                            }

                            // we add the created label in the Label collection

                            polyLinesLabels.add(newLabelPolyline);

                            // we prepare arrayRadians for the next move of the mouse


                            // if the undo option is not actived, then we clean the
                            // arrayRadians array and we push in it the last selected
                            // coordinate in order to create an unbroken line 

                            if (!that._undoIsactivated) {
                                arrayRadians = [];
                                arrayRadians.push(cartographic.longitude);
                                arrayRadians.push(cartographic.latitude);
                            } else {
                                arrayRadians = [];
                                arrayRadians.push(that._coordFirstPosition.longitude);
                                arrayRadians.push(that._coordFirstPosition.latitude);
                            }

                            oldLabel = newLabelPolyline;
                        }

                    }, ScreenSpaceEventType.MOUSE_MOVE);

                    // we definitively add the last created line and the label
                    // assiciated with.

                    polyLines.add(newPolyLine);
                    polyLinesLabels.add(oldLabel);
                }

            }, ScreenSpaceEventType.LEFT_CLICK);


            // ========= ACTTION TO PERFORM FOR THE MIDDLE CLICK ===============

            // Middle click is used to cut the line when the user has finished to
            // draw it


            that._handlerMiddleClick.setInputAction(function () {

                // arrayRadians is cleaned

                arrayRadians = [];

                // Get the number of the of lines and labels in the line and label
                // collections

                var dim = polyLines._polylines.length;
                var dimLabel = polyLinesLabels._labels.length;

                // Get the last line and the last label

                var polyline = polyLines._polylines[dim - 1];
                var polylineLabel = polyLinesLabels._labels[dimLabel - 1];

                // remove the last line and the last label

                polyLines.remove(polyline);
                polyLinesLabels.remove(polylineLabel);

                // destroy the move Handler event and initialize it again for the 
                // the next use

                that._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

                // ********* COMPUTE THE TOTAL DISTANCE OF THE LINE ************

                var dimSegment = polyLines._polylines.length;

                var smumDistance = 0;

                // get the first and last point of each line and compute the distance
                // between them and perform the sum

                for (var j = 0; j < dimSegment - 1; j++) {
                    var dimSeg = polyLines._polylines[j]._actualPositions.length;
                    var posStart = polyLines._polylines[j]._actualPositions[0];
                    var posEnd = polyLines._polylines[j]._actualPositions[dimSeg - 1];

                    smumDistance = smumDistance + Cartesian3.distance(posEnd, posStart);
                }

                var smumDistanceTrunc = smumDistance.toFixed(2);
                var beforeLastpolylineLabel = polyLinesLabels._labels[dimLabel - 2];

                // fix the position of the label for the Total distance

                var finalLabelPolylinePosition = {
                    x: beforeLastpolylineLabel._position.x,
                    y: beforeLastpolylineLabel._position.y,
                    z: beforeLastpolylineLabel._position.z
                };

                // create the label for the total distance

                var finalLabelPolyline = {
                    position: finalLabelPolylinePosition,
                    text: 'T = ' + smumDistanceTrunc + ' m',
                    scale: 0.3,
                    font: '50px arial',
                    fillColor: Color.RED,
                    outlineColor: Color.BLACK,
                    style: LabelStyle.FILL,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    verticalOrigin: VerticalOrigin.TOP,
                    translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                };

                // add the final label to the label collection

                polyLinesLabels.add(finalLabelPolyline);

                // create en new collection to draw a new line

                polyLines = viewer.scene.primitives.add(new PolylineCollection());
                polyLines.associatedObject = 'polylines';

                // create a new collection for the labels associated to the new line

                polyLinesLabels = that._viewer.scene.primitives.add(new LabelCollection());
                polyLinesLabels.associatedObject = 'polyLinesLabels';

            }, ScreenSpaceEventType.MIDDLE_CLICK);

            // ============ ACTION TO PERFORM FOR THE RIGHT CLICK ==============

            // the right click is used to perform and undo

            that._handlerRightClick.setInputAction(function () {

                // set that._undoIsactivated to true (i.e the undo action is activated)

                that._undoIsactivated = true;

                // get number of line and labels in the line and labels collections

                var dimPoly = polyLines._polylines.length;
                var dimLabel = polyLinesLabels._labels.length;

                // if there is at least one

                if (dimPoly > 1) {

                    var ua = navigator.userAgent;
                    var pattern = /Firefox/g;

                    var beforeLastPolyline = polyLines._polylines[dimPoly - 2];
                    var polylineToRemove1;
                    var polylineLabelToRemove;

                    if (pattern.test(ua)) {

                        polylineToRemove1 = polyLines._polylines[dimPoly - 1];
                        polylineLabelToRemove = polyLinesLabels._labels[dimLabel - 1];

                        polyLines.remove(polylineToRemove1);
                        polyLinesLabels.remove(polylineLabelToRemove);

                    } else {

                        polylineToRemove1 = polyLines._polylines[dimPoly - 1];
                        var polylineToRemove2 = polyLines._polylines[dimPoly - 2];
                        polylineLabelToRemove = polyLinesLabels._labels[dimLabel - 1];

                        polyLines.remove(polylineToRemove1);
                        polyLines.remove(polylineToRemove2);
                        polyLinesLabels.remove(polylineLabelToRemove);
                    }

                    try {
                        //  var beforeLastPolyline = polyLines._polylines[dimPoly - 2];
                        var cartesianPosition = beforeLastPolyline._actualPositions[0];
                        that._coordFirstPosition = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesianPosition);
                    } catch (e) {
                    }

                    arrayRadians = [];
                    arrayRadians.push(that._coordFirstPosition.longitude);
                    arrayRadians.push(that._coordFirstPosition.latitude);

                } else if (dimPoly === 1) {

                    var polyline = polyLines._polylines[dimPoly - 1];
                    var polylineLabel = polyLinesLabels._labels[dimLabel - 1];

                    polyLines.remove(polyline);
                    polyLinesLabels.remove(polylineLabel);

                    that._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                    that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

                    arrayRadians = [];

                } else if (dimPoly === 0) {

                    arrayRadians = [];

                }
            }, ScreenSpaceEventType.RIGHT_CLICK);

            //    that.isPolyLineActive = false; // to prevent servral instance of the same Handlers
        }
    }

    function drawCircleFunction(that, viewer, ellipsoid, circleCollection, circlesLabels) {

        // use that to check if we are on the canvas or not (for example, on a button);
        document.onmousemove = getPosition;

        if (that.isCircleActive) {

            that._handlerLeftClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerRightClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerLeftDblClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);

            var circleRadius;
            var cartesianCartographicCircleCenter;
            var newPrim;

            that._handlerLeftClickCircle.setInputAction(function (click) {
                var oldPrim = null;
                var oldLabel = null;

                var cursorCircleCenter = click.position;
                var cartesianCircleCenter = viewer.scene.camera.pickEllipsoid(cursorCircleCenter, ellipsoid);

                if (cartesianCircleCenter && targetMouse === '[object HTMLCanvasElement]') {
                    var cartographicCircleCenter = ellipsoid.cartesianToCartographic(cartesianCircleCenter);
                    cartesianCartographicCircleCenter = Cartesian3.fromRadians(cartographicCircleCenter.longitude, cartographicCircleCenter.latitude, cartographicCircleCenter.height, ellipsoid);

                    that._handlerMouseMoveCircle.setInputAction(function (mouvement) {

                        var cursorMovePosition = mouvement.endPosition;
                        var cartesianMovePosition = viewer.scene.camera.pickEllipsoid(cursorMovePosition, ellipsoid);

                        if (cartesianMovePosition) {
                            var cartographicMovePosition = ellipsoid.cartesianToCartographic(cartesianMovePosition);
                            var cartesianCartographicMovePosition = Cartesian3.fromRadians(cartographicMovePosition.longitude, cartographicMovePosition.latitude, cartographicMovePosition.height, ellipsoid);

                            var deltaX = Cartesian3.distance(cartesianCartographicMovePosition, cartesianCartographicCircleCenter);

                            circleRadius = deltaX;

                            if (circleRadius > 0) {

                                var circleOutlineGeometry = new CircleOutlineGeometry({
                                    center: cartesianCartographicCircleCenter,
                                    radius: circleRadius,
                                    ellipsoid: ellipsoid,
                                    height: 0
                                });

                                var circleOutlineInstance = new GeometryInstance({
                                    geometry: circleOutlineGeometry,
                                    attributes: {color: ColorGeometryInstanceAttribute.fromColor(Color.BLUE)}
                                });

                                newPrim = new Primitive({
                                    geometryInstances: [circleOutlineInstance],
                                    primitiveType: 'circle',
                                    appearance: new PerInstanceColorAppearance({
                                        flat: true,
                                        renderState: {lineWidth: Math.min(1.0, viewer.scene.maximumAliasedLineWidth)}
                                    }),
                                    asynchronous: false
                                });

                                var radCircle = circleRadius.toFixed(2);

                                var newLabel = {
                                    position: cartesianCircleCenter,
                                    text: 'D = ' + radCircle * 2 + ' m',
                                    scale: 0.3,
                                    font: '50px arial',
                                    fillColor: Color.WHITE,
                                    outlineColor: Color.BLACK,
                                    style: LabelStyle.FILL,
                                    horizontalOrigin: HorizontalOrigin.CENTER,
                                    verticalOrigin: VerticalOrigin.CENTER,
                                    translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                                };

                                if (oldPrim && oldLabel) {
                                    circleCollection.remove(oldPrim);
                                    var dimLabel = circlesLabels._labels.length;
                                    var primitiveLabel = circlesLabels._labels[dimLabel - 1];
                                    circlesLabels.remove(primitiveLabel);
                                }

                                circleCollection.add(newPrim);

                                circlesLabels.add(newLabel);

                                oldPrim = newPrim;
                                oldLabel = newLabel;
                            }
                        }
                    }, ScreenSpaceEventType.MOUSE_MOVE);
                }

                that._handlerLeftDblClickCircle.setInputAction(function () {
                    if (that._handlerMouseMoveCircle) {
                        that._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                    }
                    var cartesianCircleCenter = newPrim._boundingSphereWC[0].center;
                    var radius = circleRadius = newPrim._boundingSphereWC[0].radius;

                    var circleGeometry = new CircleGeometry({
                        center: cartesianCircleCenter,
                        radius: circleRadius,
                        ellipsoid: ellipsoid,
                        height: 0,
                        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                    });

                    var circleInstance = new GeometryInstance({
                        geometry: circleGeometry,
                        attributes: {color: ColorGeometryInstanceAttribute.fromColor(new Color(0.0, 0.0, 1.0, 0.3))}
                    });

                    var newPrimFill = new Primitive({
                        geometryInstances: [circleInstance],
                        primitiveType: 'circle',
                        appearance: new PerInstanceColorAppearance({closed: true})
                    });

                    circleCollection.remove(newPrim);
                    circleCollection.add(newPrimFill);

                }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

            }, ScreenSpaceEventType.LEFT_CLICK);

            that._handlerRightClickCircle.setInputAction(function (click) {

                if (that._handlerMouseMoveCircle) {
                    that._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }
                that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);

                var dim = circleCollection._primitives.length;
                var dimLabel = circlesLabels._labels.length;

                var continueWhile = true;

                if (dim >= 1) {

                    while (continueWhile) {

                        try {
                            var primitiveObject1 = circleCollection._primitives[dim - 1];
                            var primitiveLabel1 = circlesLabels._labels[dimLabel - 1];

                            if (primitiveObject1.primitiveType === 'circle') {
                                try {

                                    circleCollection.remove(primitiveObject1);
                                    circlesLabels.remove(primitiveLabel1);

                                } catch (e) {
                                }
                                continueWhile = false;
                            } else if (dim === 0) {
                                continueWhile = false;
                            } else {
                                dim--;
                            }
                        } catch (e) {
                        }
                    }
                }
            }, ScreenSpaceEventType.RIGHT_CLICK);

            //   that.isCircleActive = false; // to prevent servral instance of the same Handlers
        }
    }

    function drawCircleFromTwoPointsFunction(that, viewer, ellipsoid, circleCollection, circlesLabels, polyLinesTmps, polyLinesLabelsTmps) {

        // use that to check if we are on the canvas or not (for example, on a button);
        document.onmousemove = getPosition;

        if (that.isCircleFromTwoPointsActive) {

            // Mouse event Initialization 

            that._handlerLeftClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerRightClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerLeftDblClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);


            // Variables initialization

            var arrayRadians = [];
            ellipsoid = viewer.scene.globe.ellipsoid;
            var oldLabel;

            // Process when occur a mouse event

            that._handlerLeftClickCircle.setInputAction(function (click) {
                that._undoIsactivated = false;
                var newLine;

                // we get the cartesians coordinates of the clicked point

                var cartesian = viewer.scene.camera.pickEllipsoid(click.position, ellipsoid);


                // If the coordinates are not null and if we are on the canvas, then...

                if (cartesian && targetMouse === '[object HTMLCanvasElement]') {


                    // we change the cartesians coordinates into cartographics coordinates (lng, lat. coordinates are in rad

                    var cartographic = ellipsoid.cartesianToCartographic(cartesian);

                    // we begin to fill the arrayRadians array which contains the start and final point coordinates of the line

                    arrayRadians.push(cartographic.longitude);
                    arrayRadians.push(cartographic.latitude);

                    if (arrayRadians.length === 6) {

                        var startPoint = Cartesian3.fromRadians(arrayRadians[0], arrayRadians[1], cartographic.height, ellipsoid);
                        var endPoint = Cartesian3.fromRadians(arrayRadians[2], arrayRadians[3], cartographic.height, ellipsoid);
                        var diameter = Cartesian3.distance(endPoint, startPoint);
                        var distanceTrunc = diameter.toFixed(2);

                        var middlePoint = {
                            x: (startPoint.x + endPoint.x) / 2.0,
                            y: (startPoint.y + endPoint.y) / 2.0,
                            z: (startPoint.z + endPoint.z) / 2.0
                        };

                        if (diameter > 0) {

                            var circleGeometry = new CircleGeometry({
                                center: middlePoint,
                                radius: diameter / 2.0,
                                ellipsoid: ellipsoid,
                                height: 0,
                                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                            });

                            var circleInstance = new GeometryInstance({
                                geometry: circleGeometry,
                                attributes: {color: ColorGeometryInstanceAttribute.fromColor(new Color(0.0, 0.0, 1.0, 0.3))}
                            });

                            var newPrimFill = new Primitive({
                                geometryInstances: [circleInstance],
                                primitiveType: 'circle',
                                appearance: new PerInstanceColorAppearance({closed: true})
                            });

                            var newLabel = {
                                position: middlePoint,
                                text: 'D = ' + distanceTrunc + ' m',
                                scale: 0.3,
                                font: '50px arial',
                                fillColor: Color.WHITE,
                                outlineColor: Color.BLACK,
                                style: LabelStyle.FILL,
                                horizontalOrigin: HorizontalOrigin.CENTER,
                                verticalOrigin: VerticalOrigin.CENTER,
                                translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                            };

                            circleCollection.add(newPrimFill);
                            circlesLabels.add(newLabel);

                            var dim = polyLinesTmps._polylines.length;

                            if (dim >= 1) {

                                var polyline = polyLinesTmps._polylines[dim - 1];
                                polyLinesTmps.remove(polyline);

                                var dimLabel = polyLinesLabelsTmps._labels.length;
                                var primitiveLabel = polyLinesLabelsTmps._labels[dimLabel - 1];
                                polyLinesLabelsTmps.remove(primitiveLabel);

                            }
                        }

                        arrayRadians = [];
                    }

                    // Implementation of the mouse event 'Mouse move' in order to see the line motion. 

                    that._handlerMouseMoveCircle.setInputAction(function (mouvement) {

                        // on recupere les coordonn�es de chaque point survol� par la souris
                        // we get thet coordinate of each point under the cursor

                        var cartesianMovePosition = viewer.scene.camera.pickEllipsoid(mouvement.endPosition, ellipsoid);
                        var cartographicMovePosition;

                        // If the coordinates are not null and if we are on the canvas, then...

                        if (cartesianMovePosition && targetMouse === '[object HTMLCanvasElement]') {

                            // we change the coordinate...

                            cartographicMovePosition = ellipsoid.cartesianToCartographic(cartesianMovePosition);

                            // new coordiates pushed in the array. The "if" condition is implemented in order to replace the final point and hence 
                            // draw a single line


                            if (arrayRadians.length >= 2) {

                                if (arrayRadians[2] && arrayRadians[3]) {
                                    arrayRadians[2] = cartographicMovePosition.longitude;
                                    arrayRadians[3] = cartographicMovePosition.latitude;
                                } else {
                                    arrayRadians.push(cartographicMovePosition.longitude);
                                    arrayRadians.push(cartographicMovePosition.latitude);
                                }
                            }
                        }

                        // If we have, in the arrayRadians array the start and final points, then we draw the line
                        if (arrayRadians.length === 4) {

                            // we build the line 
                            newLine = {
                                positions: PolylinePipeline.generateCartesianArc({
                                    positions: Cartesian3.fromRadiansArray(arrayRadians, ellipsoid),
                                    ellipsoid: ellipsoid
                                }),
                                material: Material.fromType('Color', {
                                    color: Color.BLUE
                                })
                            };

                            // we determine the distance between the first and final point

                            var startPoint = Cartesian3.fromRadians(arrayRadians[0], arrayRadians[1], cartographic.height, ellipsoid);
                            var endPoint = Cartesian3.fromRadians(arrayRadians[2], arrayRadians[3], cartographicMovePosition.height, ellipsoid);
                            var distance = Cartesian3.distance(endPoint, startPoint);
                            var distanceTrunc = distance.toFixed(2);

                            // create the label 

                            var newLabelPolyline = {
                                position: cartesianMovePosition,
                                text: 'd = ' + distanceTrunc + ' m',
                                scale: 0.3,
                                font: '50px arial',
                                fillColor: Color.WHITE,
                                outlineColor: Color.BLACK,
                                style: LabelStyle.FILL,
                                horizontalOrigin: HorizontalOrigin.LEFT,
                                verticalOrigin: VerticalOrigin.BOTTOM,
                                translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                            };

                            //  add teh line

                            polyLinesTmps.add(newLine);

                            var dim = polyLinesTmps._polylines.length;

                            if (dim > 1) {
                                var polyline = polyLinesTmps._polylines[dim - 2];
                                polyLinesTmps.remove(polyline);
                            }

                            if (oldLabel) {
                                var dimLabel = polyLinesLabelsTmps._labels.length;
                                var primitiveLabel = polyLinesLabelsTmps._labels[dimLabel - 1];
                                polyLinesLabelsTmps.remove(primitiveLabel);
                            }

                            polyLinesLabelsTmps.add(newLabelPolyline);

                            oldLabel = newLabelPolyline;
                        }
                    }, ScreenSpaceEventType.MOUSE_MOVE);
                }


            }, ScreenSpaceEventType.LEFT_CLICK);

            that._handlerRightClickCircle.setInputAction(function (click) {

                if (that._handlerMouseMoveCircle) {
                    that._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }
                that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);


                var dimPolyLines = polyLinesTmps._polylines.length;

                if (dimPolyLines > 0) {

                    try {
                        polyLinesTmps.removeAll();
                    } catch (e) {
                        console.log(e);
                    }
                    try {
                        polyLinesLabelsTmps.removeAll();
                    } catch (e) {
                        console.log(e);
                    }

                    arrayRadians = [];

                } else if (dimPolyLines === 0) {

                    var dim = circleCollection._primitives.length;
                    var dimLabel = circlesLabels._labels.length;

                    var continueWhile = true;

                    if (dim >= 1) {

                        while (continueWhile) {

                            try {
                                var primitiveObject1 = circleCollection._primitives[dim - 1];
                                var primitiveLabel1 = circlesLabels._labels[dimLabel - 1];

                                if (primitiveObject1.primitiveType === 'circle') {
                                    try {

                                        circleCollection.remove(primitiveObject1);
                                        circlesLabels.remove(primitiveLabel1);

                                    } catch (e) {
                                    }
                                    continueWhile = false;
                                } else if (dim === 0) {
                                    continueWhile = false;
                                } else {
                                        dim--;
                                }
                            } catch (e) {
                            }
                        }
                    }

                    arrayRadians = [];

                }
            }, ScreenSpaceEventType.RIGHT_CLICK);

            //  that.isCircleFromTwoPointsActive = false; // to prevent servral instance of the same Handlers
        }
    }

    // mathematical process to get the center of a circle drawn with 3 points

    function  computeMedianPoint(P1, P2) {

        var C0 = (P2.x + P1.x) / 2.0;
        var C1 = (P2.y + P1.y) / 2.0;
        var C2 = (P2.z + P1.z) / 2.0;

        var medianPoint = [C0, C1, C2];

        return medianPoint;

    }

    function computeVectors(P1, P2) {

        var C0 = (P2.x - P1.x);
        var C1 = (P2.y - P1.y);
        var C2 = (P2.z - P1.z);

        var VD = [C0, C1, C2];

        return VD;
    }


    function computeNormalVector(U, V) {

        var C0 = U[1] * V[2] - U[2] * V[1];
        var C1 = U[2] * V[0] - U[0] * V[2];
        var C2 = U[0] * V[1] - U[1] * V[0];

        var N = [C0, C1, C2];

        return N;
    }

    function computePlanCoefficent(P1, N) {

        var C0 = N[0];
        var C1 = N[1];
        var C2 = N[2];
        var C3 = N[0] * P1[0] + N[1] * P1[1] + N[2] * P1[2];

        var C = [C0, C1, C2, C3];

        return C;
    }

    function extractionSubMatrix(A, indexI) {

        var selectedLine1 = indexI + 1;
        var selectedLine2 = indexI + 2;

        if (selectedLine1 > 2) {
            selectedLine1 = 0;
        }

        if (selectedLine2 > 2 && indexI !== 2) {
            selectedLine2 = 0;
        }

        if (selectedLine2 > 2 && indexI === 2) {
            selectedLine2 = indexI - 1;
        }

        var line1 = A[selectedLine1];
        var line2 = A[selectedLine2];

        var finalLine1 = line1.slice(1, line1.length);
        var finalLine2 = line2.slice(1, line2.length);

        var subA = [finalLine1, finalLine2];

        return subA;
    }

    function computDetMatrix2x2(subA, coef) {
        var detA = subA[0][0] * subA[1][1] - subA[1][0] * subA[0][1];
        return detA * coef;
    }

    function computeDeterminant3x3(A) {

        var sumDet = 0;

        for (var i = 0; i < A.length; i++) {

            var coef = Math.pow(-1.0, i);
            var subA = extractionSubMatrix(A, i);
            var detA = computDetMatrix2x2(subA, coef);

            sumDet = sumDet + coef * detA * A[i][0];
        }

        return sumDet;
    }

    function drawCircleFromThreePointsFunction(that, viewer, ellipsoid, circleCollection, circlesLabels, polyLinesTmps, polyLinesLabelsTmps) {

        // use that to check if we are on the canvas or not (for example, on a button);
        document.onmousemove = getPosition;

        if (that.isCircleFromThreePointsActive) {

            // Mouse event initialization

            that._handlerLeftClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerRightClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerLeftDblClickCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);


            // Variables initialization

            var arrayRadians = [];
            var polyLinesCoord = [];
            var oldLabel;
            var cartesianMovePosition;

            // Process when occur a mouse event

            that._handlerLeftClickCircle.setInputAction(function (click) {

                that._undoIsactivated = false;
                var newPolyLine;

                var ellipsoid = viewer.scene.globe.ellipsoid;
                var cartesian = viewer.scene.camera.pickEllipsoid(click.position, ellipsoid);

                if (cartesian && targetMouse === '[object HTMLCanvasElement]') {
                    var cartographic = ellipsoid.cartesianToCartographic(cartesian);

                    if (!that._undoIsactivated) {
                        arrayRadians.push(cartographic.longitude);
                        arrayRadians.push(cartographic.latitude);
                        polyLinesCoord.push(cartographic.longitude);
                        polyLinesCoord.push(cartographic.latitude);
                    }

                    if (polyLinesCoord.length >= 6) {

                        var firstPoint = Cartesian3.fromRadians(polyLinesCoord[0], polyLinesCoord[1], cartographic.height, ellipsoid);
                        var secondPoint = Cartesian3.fromRadians(polyLinesCoord[2], polyLinesCoord[3], cartographic.height, ellipsoid);
                        var thirdPoint = Cartesian3.fromRadians(polyLinesCoord[4], polyLinesCoord[5], cartographic.height, ellipsoid);

                        // we compute the median point

                        var medianPoint12 = computeMedianPoint(firstPoint, secondPoint);
                        var medianPoint23 = computeMedianPoint(secondPoint, thirdPoint);

                        // we compute the direction of the vector

                        var V12 = computeVectors(firstPoint, secondPoint);
                        var V23 = computeVectors(secondPoint, thirdPoint);

                        //we compute the perpendicular vector to the plan which contains the 3 points

                        var normalVector = computeNormalVector(V12, V23);

                        // we compute the coefficients of the plan equation

                        var point1 = [firstPoint.x, firstPoint.y, firstPoint.z];

                        var plan1 = computePlanCoefficent(point1, normalVector);
                        var plan2 = computePlanCoefficent(medianPoint12, V12);
                        var plan3 = computePlanCoefficent(medianPoint23, V23);

                        var arrayDelta = [[plan1[0], plan1[1], plan1[2]],
                            [plan2[0], plan2[1], plan2[2]],
                            [plan3[0], plan3[1], plan3[2]]];

                        var delta = computeDeterminant3x3(arrayDelta);

                        var arrayDeltaX = [[plan1[3], plan1[1], plan1[2]],
                            [plan2[3], plan2[1], plan2[2]],
                            [plan3[3], plan3[1], plan3[2]]];

                        var deltaX = computeDeterminant3x3(arrayDeltaX);

                        var arrayDeltaY = [[plan1[0], plan1[3], plan1[2]],
                            [plan2[0], plan2[3], plan2[2]],
                            [plan3[0], plan3[3], plan3[2]]];

                        var deltaY = computeDeterminant3x3(arrayDeltaY);

                        var arrayDeltaZ = [[plan1[0], plan1[1], plan1[3]],
                            [plan2[0], plan2[1], plan2[3]],
                            [plan3[0], plan3[1], plan3[3]]];

                        var deltaZ = computeDeterminant3x3(arrayDeltaZ);

                        var centerPosition = {
                            x: deltaX / delta,
                            y: deltaY / delta,
                            z: deltaZ / delta
                        };
                        var centerRadius = Cartesian3.distance(centerPosition, firstPoint);

                        var diameter = centerRadius * 2.0;
                        var distanceTrunc = diameter.toFixed(2);

                        if (diameter > 0) {

                            var circleGeometry = new CircleGeometry({
                                center: centerPosition,
                                radius: diameter / 2.0,
                                ellipsoid: ellipsoid,
                                height: 0,
                                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                            });

                            var circleInstance = new GeometryInstance({
                                geometry: circleGeometry,
                                attributes: {color: ColorGeometryInstanceAttribute.fromColor(new Color(0.0, 0.0, 1.0, 0.3))}
                            });

                            var newPrimFill = new Primitive({
                                geometryInstances: [circleInstance],
                                primitiveType: 'circle',
                                appearance: new PerInstanceColorAppearance({closed: true})
                            });

                            var newLabel = {
                                position: centerPosition,
                                text: 'D = ' + distanceTrunc + ' m',
                                scale: 0.3,
                                font: '50px arial',
                                fillColor: Color.WHITE,
                                outlineColor: Color.BLACK,
                                style: LabelStyle.FILL,
                                horizontalOrigin: HorizontalOrigin.CENTER,
                                verticalOrigin: VerticalOrigin.CENTER,
                                translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                            };

                            circleCollection.add(newPrimFill);
                            circlesLabels.add(newLabel);

                            arrayRadians = [];
                            polyLinesCoord = [];
                        }

                        polyLinesTmps.removeAll();
                        polyLinesLabelsTmps.removeAll();

                    } else {

                        that._handlerMouseMoveCircle.setInputAction(function (mouvement) {

                            cartesianMovePosition = viewer.scene.camera.pickEllipsoid(mouvement.endPosition, ellipsoid);
                            var cartographicMovePosition;

                            if (cartesianMovePosition && targetMouse === '[object HTMLCanvasElement]') {

                                cartographicMovePosition = ellipsoid.cartesianToCartographic(cartesianMovePosition);

                                if (arrayRadians.length >= 2) {

                                    if (arrayRadians[2] && arrayRadians[3]) {
                                        arrayRadians[2] = cartographicMovePosition.longitude;
                                        arrayRadians[3] = cartographicMovePosition.latitude;
                                    } else {
                                        arrayRadians.push(cartographicMovePosition.longitude);
                                        arrayRadians.push(cartographicMovePosition.latitude);
                                    }
                                }
                            }

                            if (arrayRadians.length === 4) {

                                newPolyLine = {
                                    positions: PolylinePipeline.generateCartesianArc({
                                        positions: Cartesian3.fromRadiansArray(arrayRadians, ellipsoid),
                                        ellipsoid: ellipsoid
                                    }),
                                    material: Material.fromType('Color', {
                                        color: Color.BLUE
                                    })
                                };

                                var startPoint = Cartesian3.fromRadians(arrayRadians[0], arrayRadians[1], cartographic.height, ellipsoid);
                                var endPoint = Cartesian3.fromRadians(arrayRadians[2], arrayRadians[3], cartographicMovePosition.height, ellipsoid);
                                var distance = Cartesian3.distance(endPoint, startPoint);
                                var distanceTrunc = distance.toFixed(2);

                                var newLabelPolyline = {
                                    position: cartesianMovePosition,
                                    text: 'D = ' + distanceTrunc + ' m',
                                    scale: 0.3,
                                    font: '50px arial',
                                    fillColor: Color.WHITE,
                                    outlineColor: Color.BLACK,
                                    style: LabelStyle.FILL,
                                    horizontalOrigin: HorizontalOrigin.LEFT,
                                    verticalOrigin: VerticalOrigin.BOTTOM,
                                    translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                                };

                                polyLinesTmps.add(newPolyLine);

                                var dim = polyLinesTmps._polylines.length;

                                if (dim > 1) {
                                    var polyline = polyLinesTmps._polylines[dim - 2];
                                    polyLinesTmps.remove(polyline);
                                }

                                if (oldLabel) {
                                    var dimLabel = polyLinesLabelsTmps._labels.length;
                                    var primitiveLabel = polyLinesLabelsTmps._labels[dimLabel - 1];
                                    polyLinesLabelsTmps.remove(primitiveLabel);
                                }

                                polyLinesLabelsTmps.add(newLabelPolyline);

                                if (!that._undoIsactivated) {
                                    arrayRadians = [];
                                    arrayRadians.push(cartographic.longitude);
                                    arrayRadians.push(cartographic.latitude);
                                } else {
                                    arrayRadians = [];
                                    arrayRadians.push(that._coordFirstPosition.longitude);
                                    arrayRadians.push(that._coordFirstPosition.latitude);
                                }

                                oldLabel = newLabelPolyline;
                            }

                        }, ScreenSpaceEventType.MOUSE_MOVE);

                        polyLinesTmps.add(newPolyLine);
                        polyLinesLabelsTmps.add(oldLabel);
                    }
                }

            }, ScreenSpaceEventType.LEFT_CLICK);


            that._handlerRightClickCircle.setInputAction(function (click) {

                if (that._handlerMouseMoveCircle) {
                    that._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }
                that._handlerMouseMoveCircle = new ScreenSpaceEventHandler(viewer.scene.canvas);


                var dimPolyLines = polyLinesTmps._polylines.length;

                if (dimPolyLines > 0) {

                    try {
                        polyLinesTmps.removeAll();
                    } catch (e) {
                        console.log(e);
                    }
                    try {
                        polyLinesLabelsTmps.removeAll();
                    } catch (e) {
                        console.log(e);
                    }

                    arrayRadians = [];
                    polyLinesCoord = [];

                } else if (dimPolyLines === 0) {

                    var dim = circleCollection._primitives.length;
                    var dimLabel = circlesLabels._labels.length;

                    var continueWhile = true;

                    if (dim >= 1) {

                        while (continueWhile) {

                            try {
                                var primitiveObject1 = circleCollection._primitives[dim - 1];
                                var primitiveLabel1 = circlesLabels._labels[dimLabel - 1];

                                if (primitiveObject1.primitiveType === 'circle') {
                                    try {

                                        circleCollection.remove(primitiveObject1);
                                        circlesLabels.remove(primitiveLabel1);

                                    } catch (e) {
                                    }
                                    continueWhile = false;
                                } else if (dim === 0) {
                                    continueWhile = false;
                                } else {
                                    dim--;
                                }
                            } catch (e) {
                            }
                        }
                    }

                    arrayRadians = [];
                    polyLinesCoord = [];

                }
            }, ScreenSpaceEventType.RIGHT_CLICK);
        }

        //  that.isCircleFromThreePointsActive = false; // to prevent servral instance of the same Handlers

    }

    function drawPolygonsFunction(that, viewer, ellipsoid, polygonsCollection, polygonsLabelsCollection, polyLinesTmpPolygons, polyLinesLabelsTmPolygons) {

        document.onmousemove = getPosition;

        if (that.isPolygonsActive) {

            // initialisation des evenements 

            that._handlerLeftClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMiddleClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerRightClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerDblLeftClick = new ScreenSpaceEventHandler(viewer.scene.canvas);
            that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

            // 
            // We create a tmp collection of polyline (polyLinesTmp) to help users to build a polygone on the map. 
            // polyLinesTmp is destroyed at each time that a new polygone is built and it is destroy when we leave the widget

            var coordLinesForPolygonsRadians = []; // ==>  4 components array
            var polygonsCoord = []; // ==> array which contains the point to build a polygon
            var oldLabel;
            var oldPolygons;

            // we get the ellipsoid  

            ellipsoid = viewer.scene.globe.ellipsoid;


            //  EVENT : left click 

            that._handlerLeftClick.setInputAction(function (click) {

                //  Undo desable 
                that._undoIsactivated = false;

                // Declaration of a new line : Objet used to draw a line;

                var newPolyLine;

                // we get the cartesians coordinates of the clicked point

                var cartesian = viewer.scene.camera.pickEllipsoid(click.position, ellipsoid);

                // if the coordinates are not null and we are on the canvas then...

                if (cartesian && targetMouse === '[object HTMLCanvasElement]') {

                    //we transforme the coordinates (x, y, z) to cartographic (long, lat) in rad

                    var cartographic = ellipsoid.cartesianToCartographic(cartesian);


                    if (!that._undoIsactivated) {
                        coordLinesForPolygonsRadians.push(cartographic.longitude);
                        coordLinesForPolygonsRadians.push(cartographic.latitude);
                        polygonsCoord.push(cartographic.longitude);
                        polygonsCoord.push(cartographic.latitude);
                    }

                    // EVENT : mouse move

                    that._handlerMove.setInputAction(function (mouvement) {

                        // we get the coordinates of each point under the cursor

                        var cartesianMovePosition = viewer.scene.camera.pickEllipsoid(mouvement.endPosition, ellipsoid);
                        var cartographicMovePosition;
                        // if the coordinates are not null and we are on the canvas then...

                        if (cartesianMovePosition && targetMouse === '[object HTMLCanvasElement]') {

                            //we transforme the coordinates (x, y, z) to cartographic (long, lat) in rad

                            cartographicMovePosition = ellipsoid.cartesianToCartographic(cartesianMovePosition);

                            // if we already have the final point in the coordLinesForPolygonsRadians array then we change it in order
                            // to create animate the motion of the line. 

                            if (coordLinesForPolygonsRadians[2] && coordLinesForPolygonsRadians[3]) {
                                coordLinesForPolygonsRadians[2] = cartographicMovePosition.longitude;
                                coordLinesForPolygonsRadians[3] = cartographicMovePosition.latitude;
                            } else {
                                coordLinesForPolygonsRadians.push(cartographicMovePosition.longitude);
                                coordLinesForPolygonsRadians.push(cartographicMovePosition.latitude);
                            }
                        }


                        // if we have the start and final point, then...

                        if (coordLinesForPolygonsRadians.length === 4) {

                            // we create a new line

                            newPolyLine = {
                                positions: PolylinePipeline.generateCartesianArc({
                                    positions: Cartesian3.fromRadiansArray(coordLinesForPolygonsRadians, ellipsoid),
                                    ellipsoid: ellipsoid
                                }),
                                material: Material.fromType('Color', {
                                    color: Color.BLUE
                                })
                            };

                            // distance between the start and final point

                            var startPoint = Cartesian3.fromRadians(coordLinesForPolygonsRadians[0], coordLinesForPolygonsRadians[1], cartographic.height, ellipsoid);
                            var endPoint = Cartesian3.fromRadians(coordLinesForPolygonsRadians[2], coordLinesForPolygonsRadians[3], cartographicMovePosition.height, ellipsoid);
                            var distance = Cartesian3.distance(endPoint, startPoint);
                            var distanceTrunc = distance.toFixed(2);


                            // Ici, on construit le label qui renseigne sur la distance entre les points de 
                            // depart et d'arriv�

                            // label the indicate the distance between the start and final point

                            var newLabelPolyline = {
                                position: cartesianMovePosition,
                                text: 'D = ' + distanceTrunc + ' m',
                                scale: 0.3,
                                font: '50px arial',
                                fillColor: Color.WHITE,
                                outlineColor: Color.BLACK,
                                style: LabelStyle.FILL,
                                horizontalOrigin: HorizontalOrigin.LEFT,
                                verticalOrigin: VerticalOrigin.BOTTOM,
                                translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                            };

                            //  add the line

                            polyLinesTmpPolygons.add(newPolyLine);

                            // add the label

                            polyLinesLabelsTmPolygons.add(newLabelPolyline);

                            // Dans les lignes suivantes, on verifie si il y a d�ja un trac� de ligne.
                            // Si oui, alors on retir la ligne pr�cedente ansi que son label associ�.
                            // Cela donne un effet de dynamisme dans le rendu

                            // we remove the old line and the old label in order to keep only one line on the scene

                            var dim = polyLinesTmpPolygons._polylines.length;
                            var dimLabel = polyLinesLabelsTmPolygons._labels.length;

                            if (dim > 1) {
                                var polyline = polyLinesTmpPolygons._polylines[dim - 2];
                                polyLinesTmpPolygons.remove(polyline);

                                var primitiveLabel = polyLinesLabelsTmPolygons._labels[dimLabel - 2];
                                polyLinesLabelsTmPolygons.remove(primitiveLabel);
                            }

                            // If Undo is desabled then ew clean the vector wich contains the coordinate of the line in order to create another one
                            // In order to create an unbroken line, we keep the final point of the previous line and it become the start point of the new line

                            // if Undo is activated (with a righ click), then we recover the old coordinate to modify the la drawn ligne

                            if (!that._undoIsactivated) {
                                coordLinesForPolygonsRadians = [];
                                coordLinesForPolygonsRadians.push(cartographic.longitude);
                                coordLinesForPolygonsRadians.push(cartographic.latitude);
                            } else {
                                coordLinesForPolygonsRadians = [];
                                coordLinesForPolygonsRadians.push(that._coordFirstPosition.longitude);
                                coordLinesForPolygonsRadians.push(that._coordFirstPosition.latitude);
                            }

                            // we recover the last label

                            oldLabel = newLabelPolyline;
                        }

                    }, ScreenSpaceEventType.MOUSE_MOVE);

                    polyLinesTmpPolygons.add(newPolyLine);
                    polyLinesLabelsTmPolygons.add(oldLabel);

                    // Il faut au minimum 3 points afin de tracer un polygon (donc 6 coordonn�es). 
                    // Donc si il y a au moins 6 composantes dans le vecteur polygonsCoord, alors 
                    // on commence le trac� du polygon

                    // we need 3 point to draw a polygone (hence 6 coordinates). hence, if we have at least 
                    // 6 components in the polygonsCoord vector then, we begin to draw the polygone

                    if (polygonsCoord.length >= 6) {

                        var polygonsCoordDegree = Cartesian3.fromRadiansArray(polygonsCoord, ellipsoid);

                        var polygonInstance = new GeometryInstance({
                            geometry: PolygonGeometry.fromPositions({
                                positions: polygonsCoordDegree,
                                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
                                ellipsoid: ellipsoid}),
                            attributes: {
                                color: ColorGeometryInstanceAttribute.fromColor(new Color(0.0, 0.0, 1.0, 0.3))
                            }
                        });

                        var newPolygon = new Primitive({
                            geometryInstances: polygonInstance,
                            appearance: new PerInstanceColorAppearance({
                                closed: true,
                                translucent: true
                            })
                        });

                        polygonsCollection.add(newPolygon);

                        var dim = polygonsCollection._primitives.length;

                        if (oldPolygons) {
                            polygonsCollection.remove(oldPolygons);
                        }

                        oldPolygons = newPolygon;
                    }
                }

            }, ScreenSpaceEventType.LEFT_CLICK);

            that._handlerMiddleClick.setInputAction(function () {

                // we clean the position vector

                coordLinesForPolygonsRadians = [];
                polygonsCoord = [];
                oldPolygons = null;

                // On recupere le nombre de lignes ansi que le nombre labels

                // we get the number of lines and the number of polygon

                var dim = polyLinesTmpPolygons._polylines.length;
                var dimLabel = polyLinesLabelsTmPolygons._labels.length;

                // we get the last line and label to destroy them

                var polyline = polyLinesTmpPolygons._polylines[dim - 1];
                var polylineLabel = polyLinesLabelsTmPolygons._labels[dimLabel - 1];

                polyLinesTmpPolygons.remove(polyline);
                polyLinesLabelsTmPolygons.remove(polylineLabel);

                that._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

                var dimSegment = polyLinesTmpPolygons._polylines.length;

                var firstLine = polyLinesTmpPolygons._polylines[0];
                var lastLine = polyLinesTmpPolygons._polylines[dimSegment - 2];

                var firstLineStartPoint = firstLine._actualPositions[0];
                var lasttLineStartPoint = lastLine._actualPositions[lastLine._actualPositions.length - 1];

                var finalLine = [firstLineStartPoint, lasttLineStartPoint];

                var finalPolyLine = {
                    positions: PolylinePipeline.generateCartesianArc({
                        positions: finalLine,
                        ellipsoid: ellipsoid
                    }),
                    material: Material.fromType('Color', {
                        color: Color.BLUE
                    })
                };

                polyLinesTmpPolygons.add(finalPolyLine);

                // on reevalue la dimension de polyLinesTmp._polylines car une nouvelle
                // ligne a �t� introduite. Cela est important pour le calcul de la distance
                // totale

                // we re-evaluate the dimension of polyLinesTmp._polylines for the computation of the
                // total distance

                var dimSegmentFinal = polyLinesTmpPolygons._polylines.length;

                var smumDistance = 0;

                for (var j = 0; j < dimSegmentFinal; j++) {
                    if (polyLinesTmpPolygons._polylines[j]) {
                        var dimSeg = polyLinesTmpPolygons._polylines[j]._actualPositions.length;
                        var posStart = polyLinesTmpPolygons._polylines[j]._actualPositions[0];
                        var posEnd = polyLinesTmpPolygons._polylines[j]._actualPositions[dimSeg - 1];

                        smumDistance = smumDistance + Cartesian3.distance(posEnd, posStart);
                    }
                }

                var smumDistanceTrunc = smumDistance.toFixed(2);

                var finalLabelPolyline = {
                    position: firstLineStartPoint,
                    text: 'T = ' + smumDistanceTrunc + ' m',
                    scale: 0.3,
                    font: '50px arial',
                    fillColor: Color.RED,
                    outlineColor: Color.BLACK,
                    style: LabelStyle.FILL,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    verticalOrigin: VerticalOrigin.TOP,
                    translucencyByDistance: new NearFarScalar(8.0e6, 1.0, 8.0e7, 0.0)
                };

                polyLinesLabelsTmPolygons.add(finalLabelPolyline);

                polyLinesTmpPolygons = viewer.scene.primitives.add(new PolylineCollection());
                polyLinesLabelsTmPolygons = that._viewer.scene.primitives.add(new LabelCollection());

                polyLinesTmpPolygons.associatedObject = 'polylinesTmpPolygons';
                polyLinesLabelsTmPolygons.associatedObject = 'polyLinesLabelsTmpPolygons';

            }, ScreenSpaceEventType.MIDDLE_CLICK);

            that._handlerRightClick.setInputAction(function () {

                that._undoIsactivated = true;
                var dim = polyLinesTmpPolygons._polylines.length;
                var dimLabel = polyLinesLabelsTmPolygons._labels.length;
                var polyline;
                var polylineLabel;

                if (dim > 1) {

                    polyline = polyLinesTmpPolygons._polylines[dim - 1];
                    polylineLabel = polyLinesLabelsTmPolygons._labels[dimLabel - 1];

                    try {
                        var beforeLastPolyline = polyLinesTmpPolygons._polylines[dim - 2];
                        var cartesianPosition = beforeLastPolyline._actualPositions[0];
                        that._coordFirstPosition = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesianPosition);
                    } catch (e) {
                    }

                    coordLinesForPolygonsRadians = [];
                    coordLinesForPolygonsRadians.push(that._coordFirstPosition.longitude);
                    coordLinesForPolygonsRadians.push(that._coordFirstPosition.latitude);

                    polyLinesTmpPolygons.remove(polyline);
                    polyLinesLabelsTmPolygons.remove(polylineLabel);

                    var lastPlygons = polygonsCollection._primitives[polygonsCollection._primitives.length - 1];
                    polygonsCollection.remove(lastPlygons);

                    var dimpolygonsCoord = polygonsCoord.length;
                    var newPolygonsCoord = polygonsCoord.slice(0, dimpolygonsCoord - 2);
                    polygonsCoord = newPolygonsCoord;

                    var polygonsCoordDegree = Cartesian3.fromRadiansArray(polygonsCoord, ellipsoid);

                    var polygonInstance = new GeometryInstance({
                        geometry: PolygonGeometry.fromPositions({
                            positions: polygonsCoordDegree,
                            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
                            ellipsoid: ellipsoid}),
                        attributes: {
                            color: ColorGeometryInstanceAttribute.fromColor(new Color(0.0, 0.0, 1.0, 0.3))
                        }
                    });

                    var newPolygon = new Primitive({
                        geometryInstances: polygonInstance,
                        appearance: new PerInstanceColorAppearance({
                            closed: true,
                            translucent: true
                        })
                    });

                    polygonsCollection.add(newPolygon);

                    oldPolygons = newPolygon;

                } else if (dim === 1) {

                    polyline = polyLinesTmpPolygons._polylines[dim - 1];
                    polylineLabel = polyLinesLabelsTmPolygons._labels[dimLabel - 1];
                    polyLinesTmpPolygons.remove(polyline);
                    polyLinesLabelsTmPolygons.remove(polylineLabel);

                    that._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                    that._handlerMove = new ScreenSpaceEventHandler(viewer.scene.canvas);

                    coordLinesForPolygonsRadians = [];

                } else if (dim === 0) {

                    coordLinesForPolygonsRadians = [];

                }
            }, ScreenSpaceEventType.RIGHT_CLICK);

            //  that.isPolygonsActive = false; // to prevent servral instance of the same Handlers  
        }
    }

    /**
     * The view model for {@link subMenu}.
     * @alias SubMenuViewModel
     * @constructor
     */
    var SubMenuViewModel = function (viewer, container) {

        this._viewer = viewer;
        this._container = container;
        this._ellipsoid = viewer.scene.globe.ellipsoid;
        this.isPolyLineActive = false;
        this.isCircleActive = false;
        this.isCircleFromTwoPointsActive = false;
        this.isCircleFromThreePointsActive = false;
        this.isPolygonsActive = false;

        this._undoIsactivated = false;
        this._isSaveButtonActivate = false;

        var that = this;
        var collectionsObjects = collectionsInitialization(that);

        this._drawCommand = createCommand(function () {
            that.isPolyLineActive = true;
            that.isCircleActive = false;
            that.isPolygonsActive = false;
            that.isCircleFromTwoPointsActive = false;
            that.isCircleFromThreePointsActive = false;

            removeHandlers(that);
            drawLinesFunction(that, that._viewer, that._polyLinesCollection, that._polyLinesLabelsCollection);
        });

        this._circleCommand = createCommand(function () {
            that.isPolyLineActive = false;
            that.isCircleActive = true;
            that.isPolygonsActive = false;
            that.isCircleFromTwoPointsActive = false;
            that.isCircleFromThreePointsActive = false;

            removeHandlers(that);
            drawCircleFunction(that, that._viewer, that._ellipsoid, that._circleCollection, that._circlesLabelsCollection);
        });

        this._circleFromTwoPointsCommand = createCommand(function () {

            that.isPolyLineActive = false;
            that.isCircleActive = false;
            that.isPolygonsActive = false;
            that.isCircleFromTwoPointsActive = true;
            that.isCircleFromThreePointsActive = false;

            removeHandlers(that);
            drawCircleFromTwoPointsFunction(that, that._viewer, that._ellipsoid, that._circleCollection, that._circlesLabelsCollection, that._polyLinesCollectionTmps, that._polyLinesLabelsCollectionTmps);
        });

        this._circleFromThreePointsCommand = createCommand(function () {
            that.isPolyLineActive = false;
            that.isCircleActive = false;
            that.isPolygonsActive = false;
            that.isCircleFromTwoPointsActive = false;
            that.isCircleFromThreePointsActive = true;

            removeHandlers(that);
            drawCircleFromThreePointsFunction(that, that._viewer, that._ellipsoid, that._circleCollection, that._circlesLabelsCollection, that._polyLinesCollectionTmps, that._polyLinesLabelsCollectionTmps);
        });

        this._polygonCommand = createCommand(function () {
            that.isPolyLineActive = false;
            that.isCircleActive = false;
            that.isPolygonsActive = true;
            that.isCircleFromTwoPointsActive = false;
            that.isCircleFromThreePointsActive = false;

            removeHandlers(that);
            drawPolygonsFunction(that, that._viewer, that._ellipsoid, that._polygonsCollection, that._polygonsLabelsCollection, that._polyLinesTmpPolygons, that._polyLinesLabelsTmpPolygons);
        });

        this._closeSubMenu = createCommand(function () {
            try {

                removeHandlers(that);
                that._viewer.drawLines.viewModel.subMenu.destroyWrapperMenu();
            } catch (e) {
            }
        });

        knockout.track(this, ['isCircleActive', 'isCircleFromTwoPointsActive', 'isCircleFromThreePointsActive', 'isPolyLineActive', 'isPolygonsActive']);

    };
    defineProperties(SubMenuViewModel.prototype, {
        /**
         * Gets the Command that is executed when the button is clicked.
         * @memberof SubMenuViewModel.prototype
         *
         * @type {Command}
         */

        drawCommand: {
            get: function () {
                return this._drawCommand;
            }
        },
        circleCommand: {
            get: function () {
                return this._circleCommand;
            }
        },
        circleFromTwoPointsCommand: {
            get: function () {
                return this._circleFromTwoPointsCommand;
            }
        },
        circleFromThreePointsCommand: {
            get: function () {
                return this._circleFromThreePointsCommand;
            }
        },
        polygonCommand: {
            get: function () {
                return this._polygonCommand;
            }
        },
       closeSubMenu: {
            get: function () {
                return this._closeSubMenu;
            }
        },
        removeAllCommands: {
            get: function () {
                this.isPolyLineActive = false;
                this.isCircleActive = false;
                this.isSaveButtonActivate = false;
                this.isCircleFromTwoPointsActive = false;
                this.isCircleFromThreePointsActive = false;

                if (this._handlerLeftClick) {
                    this._handlerLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
                }
                if (this._handlerMiddleClick) {
                    this._handlerMiddleClick.removeInputAction(ScreenSpaceEventType.MIDDLE_CLICK);
                }
                if (this._handlerRightClick) {
                    this._handlerRightClick.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
                }
                if (this._handlerDblLeftClick) {
                    this._handlerDblLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
                }
                if (this._handlerMove) {
                    this._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }

                if (this._handlerLeftClickCircle) {
                    this._handlerLeftClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
                }
                if (this._handlerRightClickCircle) {
                    this._handlerRightClickCircle.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
                }
                if (this._handlerLeftDblClickCircle) {
                    this._handlerLeftDblClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
                }
                if (this._handlerMouseMoveCircle) {
                    this._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }


                //   collectionsInitialization(this);
            }
        },
        removeAllHandlers: {
            get: function () {

                if (this._handlerLeftClick){
                    this._handlerLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
                }
                if (this._handlerMiddleClick){
                    this._handlerMiddleClick.removeInputAction(ScreenSpaceEventType.MIDDLE_CLICK);
                }
                if (this._handlerRightClick){
                    this._handlerRightClick.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
                }
                if (this._handlerDblLeftClick){
                    this._handlerDblLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
                }
                if (this._handlerMove){
                    this._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }

                if (this._handlerLeftClickCircle){
                    this._handlerLeftClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
                }
                if (this._handlerRightClickCircle){
                    this._handlerRightClickCircle.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
                }
                if (this._handlerLeftDblClickCircle){
                    this._handlerLeftDblClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
                }
                if (this._handlerMouseMoveCircle){
                    this._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                }

                //   collectionsInitialization(this);
            }
        }
    });

// ================================================================================================================================
// ======================================================= LOCAL FUNCTIONS ========================================================
// ================================================================================================================================

    function collectionsInitialization(that) {

        var polyLines;
        var polyLinesTmps;
        var circles;
        var polygons;
        var circlesLabels;
        var polyLinesLabels;
        var polyLinesLabelsTmps;
        var polygonsLabels;
        var polyLinesTmpPolygons;
        var polyLinesLabelsTmpPolygons;

        var primitives = that._viewer.scene.primitives._primitives;


        if (primitives.length === 0) {

            // the following order must be respected : Object - label of the objet - object - label of the objet - etc...

            polyLines = that._viewer.scene.primitives.add(new PolylineCollection());
            polyLinesLabels = that._viewer.scene.primitives.add(new LabelCollection());

            circles = that._viewer.scene.primitives.add(new PrimitiveCollection());
            circlesLabels = that._viewer.scene.primitives.add(new LabelCollection());

            polygons = that._viewer.scene.primitives.add(new PrimitiveCollection());
            polygonsLabels = that._viewer.scene.primitives.add(new LabelCollection());

            polyLinesTmpPolygons = that._viewer.scene.primitives.add(new PolylineCollection());
            polyLinesLabelsTmpPolygons = that._viewer.scene.primitives.add(new LabelCollection());

            polyLinesTmps = that._viewer.scene.primitives.add(new PolylineCollection());
            polyLinesLabelsTmps = that._viewer.scene.primitives.add(new LabelCollection());

            circles.associatedObject = 'circleGeomtry';
            circlesLabels.associatedObject = 'circlesLabels';
            polyLines.associatedObject = 'polylines';
            polyLinesTmps.associatedObject = 'polylinesTmps';
            polyLinesLabels.associatedObject = 'polyLinesLabels';
            polyLinesLabelsTmps.associatedObject = 'polyLinesLabelsTmps';
            polygons.associatedObject = 'polygonsGeomtry';
            polygonsLabels.associatedObject = 'polygonsLabels';
            polyLinesTmpPolygons.associatedObject = 'polylinesTmpPolygons';
            polyLinesLabelsTmpPolygons.associatedObject = 'polyLinesLabelsTmpPolygons';

        } else if (primitives.length > 0) {

            var statusFindpolyLines = false;
            var statusFindpolyLinesTmps = false;
            var statusFindcircle = false;
            var statusFindCirclesLabels = false;
            var statusFindpolyLinesLabels = false;
            var statusFindpolyLinesLabelsTmps = false;
            var statusFindPolygons = false;
            var statusFindPolygonsLabels = false;
            var statusFindpolyLinesTmpPolygons = false;
            var statusFindpolyLinesLabelsTmpPolygons = false;

            for (var i = 0; i < primitives.length; i++) {

                if (primitives[i].associatedObject === 'polylines') {

                    polyLines = primitives[i];
                    statusFindpolyLines = true;
                    continue;
                }


                if (primitives[i].associatedObject === 'polylinesTmps') {

                    polyLinesTmps = primitives[i];
                    statusFindpolyLinesTmps = true;
                    continue;
                }

                if (primitives[i].associatedObject === 'circleGeomtry') {
                    circles = primitives[i];
                    statusFindcircle = true;
                    continue;
                }

                if (primitives[i].associatedObject === 'polygonsGeomtry') {
                    polygons = primitives[i];
                    statusFindPolygons = true;
                    continue;

                }

                if (primitives[i].associatedObject === 'polylinesTmpPolygons') {
                    polyLinesTmpPolygons = primitives[i];
                    statusFindpolyLinesTmpPolygons = true;
                    continue;
                }

                if (primitives[i]._labels) {

                    if (primitives[i].associatedObject === 'circlesLabels') {
                        circlesLabels = primitives[i];
                        statusFindCirclesLabels = true;
                        continue;
                    }

                    if (primitives[i].associatedObject === 'polyLinesLabels') {
                        polyLinesLabels = primitives[i];
                        statusFindpolyLinesLabels = true;
                        continue;
                    }

                    if (primitives[i].associatedObject === 'polyLinesLabelsTmps') {
                        polyLinesLabelsTmps = primitives[i];
                        statusFindpolyLinesLabelsTmps = true;
                        continue;
                    }

                    if (primitives[i].associatedObject === 'polygonsLabels') {
                        polygonsLabels = primitives[i];
                        statusFindPolygonsLabels = true;
                        continue;
                    }

                    if (primitives[i].associatedObject === 'polyLinesLabelsTmpPolygons') {
                        polyLinesLabelsTmpPolygons = primitives[i];
                        statusFindpolyLinesLabelsTmpPolygons = true;
                        continue;
                    }
                }

                if (statusFindpolyLines && statusFindCirclesLabels && statusFindpolyLinesLabels && statusFindcircle && statusFindPolygons && statusFindPolygonsLabels && statusFindpolyLinesTmps && statusFindpolyLinesLabelsTmps && statusFindpolyLinesTmpPolygons && statusFindpolyLinesLabelsTmpPolygons) {
                    break;
                }

                if (i === primitives.length - 1) {

                    if (!statusFindpolyLines) {
                        polyLines = that._viewer.scene.primitives.add(new PolylineCollection());
                        polyLines.associatedObject = 'polylines';
                        statusFindpolyLines = true;
                    }

                    if (!statusFindpolyLinesLabels) {
                        polyLinesLabels = that._viewer.scene.primitives.add(new LabelCollection());
                        polyLinesLabels.associatedObject = 'polyLinesLabels';
                        statusFindpolyLinesLabels = true;
                    }

                    if (!statusFindpolyLinesTmps) {
                        polyLinesTmps = that._viewer.scene.primitives.add(new PolylineCollection());
                        polyLinesTmps.associatedObject = 'polylinesTmps';
                        statusFindpolyLinesTmps = true;
                    }

                    if (!statusFindpolyLinesLabelsTmps) {
                        polyLinesLabelsTmps = that._viewer.scene.primitives.add(new LabelCollection());
                        polyLinesLabelsTmps.associatedObject = 'polyLinesLabelsTmps';
                        statusFindpolyLinesLabelsTmps = true;
                    }

                    if (!statusFindcircle) {
                        circles = that._viewer.scene.primitives.add(new PrimitiveCollection());
                        circles.associatedObject = 'circleGeomtry';
                        statusFindcircle = true;
                    }

                    if (!statusFindCirclesLabels) {
                        circlesLabels = that._viewer.scene.primitives.add(new LabelCollection());
                        circlesLabels.associatedObject = 'circlesLabels';
                        statusFindCirclesLabels = true;
                    }

                    if (!statusFindPolygons) {
                        polygons = that._viewer.scene.primitives.add(new PrimitiveCollection());
                        polygons.associatedObject = 'polygonsGeomtry';
                        statusFindPolygons = true;
                    }

                    if (!statusFindPolygonsLabels) {
                        polygonsLabels = that._viewer.scene.primitives.add(new LabelCollection());
                        polygonsLabels.associatedObject = 'polygonsLabels';
                        statusFindPolygonsLabels = true;
                    }

                    if (!statusFindpolyLinesTmpPolygons) {
                        polyLinesTmpPolygons = that._viewer.scene.primitives.add(new PolylineCollection());
                        polyLinesTmpPolygons.associatedObject = 'polylinesTmpPolygons';
                        statusFindpolyLinesTmpPolygons = true;
                    }

                    if (!statusFindpolyLinesLabelsTmpPolygons) {
                        polyLinesLabelsTmpPolygons = that._viewer.scene.primitives.add(new LabelCollection());
                        polyLinesLabelsTmpPolygons.associatedObject = 'polyLinesLabelsTmpPolygons';
                        statusFindpolyLinesLabelsTmpPolygons = true;
                    }
                }
            }
        }

        var collectionsObject = {
            polylines: polyLines,
            polylinesTmps: polyLinesTmps,
            polylinesLables: polyLinesLabels,
            polylinesLablesTmps: polyLinesLabelsTmps,
            circles: circles,
            circleLabels: circlesLabels,
            polygons: polygons,
            polygonsLabels: polygonsLabels,
            polyLinesTmpPolygons: polyLinesTmpPolygons,
            polyLinesLabelsTmpPolygons: polyLinesLabelsTmpPolygons
        };

        that._polyLinesCollection = collectionsObject.polylines;
        that._circlesLabelsCollection = collectionsObject.circleLabels;
        that._polyLinesLabelsCollection = collectionsObject.polylinesLables;
        that._polyLinesCollectionTmps = collectionsObject.polylinesTmps;
        that._polyLinesLabelsCollectionTmps = collectionsObject.polylinesLablesTmps;
        that._circleCollection = collectionsObject.circles;
        that._polygonsLabelsCollection = collectionsObject.polygonsLabels;
        that._polygonsCollection = collectionsObject.polygons;
        that._polyLinesTmpPolygons = collectionsObject.polyLinesTmpPolygons;
        that._polyLinesLabelsTmpPolygons = collectionsObject.polyLinesLabelsTmpPolygons;


        return collectionsObject;
    }

    function removeHandlers(that) {

        if (that._handlerLeftClick){
            that._handlerLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        }
        if (that._handlerMiddleClick){
            that._handlerMiddleClick.removeInputAction(ScreenSpaceEventType.MIDDLE_CLICK);
        }
        if (that._handlerRightClick){
            that._handlerRightClick.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
        }
        if (that._handlerDblLeftClick){
            that._handlerDblLeftClick.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        if (that._handlerMove){
            that._handlerMove.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
        }

        if (that._handlerLeftClickCircle){
            that._handlerLeftClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        }
        if (that._handlerRightClickCircle){
            that._handlerRightClickCircle.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
        }
        if (that._handlerLeftDblClickCircle){
            that._handlerLeftDblClickCircle.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
        if (that._handlerMouseMoveCircle){
            that._handlerMouseMoveCircle.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
        }



        try {
            that._viewer.editDrawing.viewModel.subMenu.viewModel.removeAllCommands();
        } catch (e) {
        }
    }

    function getPosition(e) {
        e = e || window.event;

        targetMouse = e.target.toString();

    }

    return SubMenuViewModel;
});
