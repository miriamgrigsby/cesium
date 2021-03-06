/**
 * @author Omar Delaa
 */

define([
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/Math',
        '../../Core/sampleTerrainMostDetailed',
        '../../Core/ScreenSpaceEventHandler',
        '../../Core/ScreenSpaceEventType',
        '../../Core/TileAvailability',
        '../../ThirdParty/knockout',
        '../../ThirdParty/when',
        '../createCommand'
    ], function(
        defined,
        defineProperties,
        CesiumMath,
        sampleTerrainMostDetailed,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType,
        TileAvailability,
        knockout,
        when,
        createCommand) {
            'use strict';

            function sampleTerrainSuccess(terrainSamplePositions) {
                                var heightString = (terrainSamplePositions.height + 1000).toFixed(4);
                                coordViewModel.height = heightString;
//console.log('height ' + coordViewModel.height);
            }
 
            function lngLatView(that, mainContainer, scene) {

                if (!that._coodDiv) {

                    var coordViewModel = {
                        longitude: null,
                        latitude: null,
                        height: null
                    };

                    knockout.track(coordViewModel);

                    var ellipsoid = scene.globe.ellipsoid;

                    that._handler = new ScreenSpaceEventHandler(scene.canvas);
                    that._handler.setInputAction(function (movement) {

                        var cartesian = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
                            var longitudeNumber = cartographic.longitude;
                            var longitudeNumber180 = cartographic.longitude;
                            var terrainProvider = scene.terrainProvider;
                            var tilingScheme = scene.globe._surface._tileProvider.tilingScheme;
                            terrainProvider._tilingScheme = tilingScheme;
                            terrainProvider._availability = new TileAvailability(tilingScheme,20);
                            //console.log(terrainProvider._availability);
                            var promise = sampleTerrainMostDetailed(terrainProvider, [cartographic]);
                            when(promise, sampleTerrainSuccess);

                            if (longitudeNumber < 0) {
                                longitudeNumber = longitudeNumber + 2.0 * Math.PI;
                            }

                            var longitudeString = CesiumMath.toDegrees(longitudeNumber).toFixed(4);
                            var latitudeString = CesiumMath.toDegrees(cartographic.latitude).toFixed(4);
                            coordViewModel.longitude = longitudeString;
                            coordViewModel.latitude = latitudeString;
                        } else {
                            coordViewModel.longitude = null;
                            coordViewModel.latitude = null;
                            coordViewModel.height = null;
                        }
                    }, ScreenSpaceEventType.MOUSE_MOVE);

                    that._coodDiv = document.createElement('div');
                    that._coodDiv.setAttribute('id', 'coordinates');
                    that._coodDiv.className = 'coordinates';
                    that._coodDiv.style.cssText = 'background: rgba(42, 42, 42, 0.8);\
                                             padding: 4px; \
                                             border-radius: 4px; \
                                             color: white;\
                                             font-family: sans-serif;\
                                             position : absolute; \
                                             top : 40px;\
                                             right : 45%; \
                                             opacity: 1; \
                                             transition: opacity 1.0s linear; \
                                             -webkit-transition: opacity 1.0s linear; \
                                             -moz-transition: opacity 1.0s linear;';

                    if (coordViewModel.height) {
                        that._coodDiv.innerHTML = '<table><tr><th>Longitude</th><th>Latitude</th><th>Height</th></tr>' + 
                            '<tr><td id="longitude"><span data-bind="text: longitude"></span></td><td id="latitude">' +
                            '<span data-bind="text: latitude"></span></td><td id="height">' +
                            '<span data-bind="text: height"></span></td></tr>';
                    } else {
                        that._coodDiv.innerHTML = '<table><tr><th>Longitude</th><th>Latitude</th></tr>' +
                            '<tr><td id="longitude"><span data-bind="text: longitude"></span></td><td id="latitude">' +
                            '<span data-bind="text: latitude"></span></td></tr>';
                    }

                    mainContainer.appendChild(that._coodDiv);

                    var coordinates = document.getElementById('coordinates');
                    knockout.applyBindings(coordViewModel, coordinates);

                    that.isLngLatActive = true;

                } else if (that._coodDiv) {

                    knockout.cleanNode(that._coodDiv);
                    mainContainer.removeChild(that._coodDiv);
                    that._coodDiv = null;

                    that.isLngLatActive = false;
                }
            }

            var LngLatPanelViewModel = function (container, mainContainer, scene) {

                this._container = container;
                this._mainContainer = mainContainer;
                this._scene = scene;
                this._coord = null;

                this.isLngLatActive = false;
                this._isPanelToolVisibleLngLat = false;

                var that = this;
                this._command = createCommand(function () {
                    lngLatView(that, that._mainContainer, that._scene);
                }, true);

                /**
                 * Gets or sets the tooltip.  This property is observable.
                 *
                 * @type {String}
                 */

                this.tooltip = 'Coordinates';
                knockout.track(this, ['tooltip', 'isPanelToolVisibleLngLat', 'isLngLatActive']);
            };

            defineProperties(LngLatPanelViewModel.prototype, {
                /**
                 * Gets the Command that is executed when the button is clicked.
                 * @memberof LngLatPanelViewModel.prototype
                 *
                 * @type {Command}
                 */
                command: {
                    get: function () {
                        return this._command;
                    }
                },
                isPanelToolVisibleLngLat: {
                    set: function (value) {
                        this._isPanelToolVisibleLngLat = value;
                    }
                },
                removeCommand: {
                    get: function () {
                        if (this._handler) {
                            this._handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
                        }
                        if (this._coodDiv) {
                            knockout.cleanNode(this._coodDiv);
                            this._mainContainer.removeChild(this._coodDiv);
                            this._coodDiv = null;
                        }
                    }
                }
            });

            return LngLatPanelViewModel;
        });
