/*global define*/
define([
    '../../Core/BingMapsApi',
    '../../Core/BingMapsGeocoderService',
    '../../Core/Cartesian3',
    '../../Core/defaultValue',
    '../../Core/defined',
    '../../Core/defineProperties',
    '../../Core/deprecationWarning',
    '../../Core/DeveloperError',
    '../../Core/Event',
    '../../Core/CartographicGeocoderService',
    '../../Core/Matrix4',
    '../../Core/Rectangle',
    '../../ThirdParty/knockout',
    '../../ThirdParty/when',
    '../createCommand',
    '../getElement'
    ], function(
        BingMapsApi,
        BingMapsGeocoderService,
        Cartesian3,
        defaultValue,
        defined,
        defineProperties,
        deprecationWarning,
        DeveloperError,
        Event,
        CartographicGeocoderService,
        Matrix4,
        Rectangle,
        knockout,
        when,
        createCommand,
        getElement) {
    'use strict';

    /**
     * The view model for the {@link Geocoder} widget.
     * @alias GeocoderViewModel
     * @constructor
     *
     * @param {Object} options Object with the following properties:
     * @param {Scene} options.scene The Scene instance to use.
     * @param {GeocoderService[]} [options.geocoderServices] Geocoder services to use for geocoding queries.
     *        If more than one are supplied, suggestions will be gathered for the geocoders that support it,
     *        and if no suggestion is selected the result from the first geocoder service wil be used.
     * @param {String} [options.url='https://dev.virtualearth.net'] The base URL of the Bing Maps API.
     * @param {String} [options.key] The Bing Maps key for your application, which can be
     *        created at {@link https://www.bingmapsportal.com}.
     *        If this parameter is not provided, {@link BingMapsApi.defaultKey} is used.
     *        If {@link BingMapsApi.defaultKey} is undefined as well, a message is
     *        written to the console reminding you that you must create and supply a Bing Maps
     *        key as soon as possible.  Please do not deploy an application that uses
     *        this widget without creating a separate key for your application.
     * @param {Number} [options.flightDuration] The duration of the camera flight to an entered location, in seconds.
     */
    function GeocoderViewModel(options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(options) || !defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        //>>includeEnd('debug');

        if (defined(options.geocoderServices)) {
            this._geocoderServices = options.geocoderServices;
        } else {
            this._geocoderServices = [
                new CartographicGeocoderService(),
                new BingMapsGeocoderService()
            ];
        }

        var errorCredit;
        this._url = defaultValue(options.url, 'https://dev.virtualearth.net/');
        if (this._url.length > 0 && this._url[this._url.length - 1] !== '/') {
            this._url += '/';
        }

        this._key = BingMapsApi.getKey(options.key);
        this._defaultGeocoderOptions = {
            url: this._url,
            key: this._key
        };

        if (defined(options.key)) {
            errorCredit = BingMapsApi.getErrorCredit(options.key);
        }
        if (defined(errorCredit)) {
            options.scene._frameState.creditDisplay.addDefaultCredit(errorCredit);
        }

        this._viewContainer = options.container;
        this._scene = options.scene;
        this._flightDuration = options.flightDuration;
        this._searchText = '';
        this._isSearchInProgress = false;
        this._geocodePromise = undefined;
        this._complete = new Event();
        this._suggestions = [];
        this._selectedSuggestion = undefined;
        this._showSuggestions = true;
        this._updateCamera = updateCamera;
        this._adjustSuggestionsScroll = adjustSuggestionsScroll;
        this._updateSearchSuggestions = updateSearchSuggestions;
        this._handleArrowDown = handleArrowDown;
        this._handleArrowUp = handleArrowUp;

        var that = this;

        this._suggestionsVisible = knockout.pureComputed(function () {
            var suggestions = knockout.getObservable(that, '_suggestions');
            var suggestionsNotEmpty = suggestions().length > 0;
            var showSuggestions = knockout.getObservable(that, '_showSuggestions')();
            return suggestionsNotEmpty && showSuggestions;
        });

        this._searchCommand = createCommand(function() {
            that.hideSuggestions();
            that._focusTextbox = false;
            if (defined(that._selectedSuggestion)) {
                that.activateSuggestion(that._selectedSuggestion);
                return false;
            }
            if (that.isSearchInProgress) {
                cancelGeocode(that);
            } else {
                geocode(that, that._geocoderServices);
            }
        });

        this.deselectSuggestion = function () {
            that._selectedSuggestion = undefined;
        };

        this.handleKeyDown = function(data, event) {
            var downKey = event.key === 'ArrowDown' || event.key === 'Down' || event.keyCode === 40;
            var upKey = event.key === 'ArrowUp' || event.key === 'Up' || event.keyCode === 38;
            if (downKey || upKey) {
                event.preventDefault();
            }

            return true;
        };

        this.handleKeyUp = function (data, event) {
            var downKey = event.key === 'ArrowDown' || event.key === 'Down' || event.keyCode === 40;
            var upKey = event.key === 'ArrowUp' || event.key === 'Up' || event.keyCode === 38;
            var enterKey = event.key === 'Enter' || event.keyCode === 13;
            if (upKey) {
                handleArrowUp(that);
            } else if (downKey) {
                handleArrowDown(that);
            } else if (enterKey) {
                that._searchCommand();
            }
            return true;
        };

        this.activateSuggestion = function (data) {
            that.hideSuggestions();
            that._searchText = data.displayName;
            var destination = data.destination;
            clearSuggestions(that);
            updateCamera(that, destination);
        };

        this.hideSuggestions = function () {
            that._showSuggestions = false;
            that._selectedSuggestion = undefined;
        };

        this.showSuggestions = function () {
            that._showSuggestions = true;
        };

        this.handleMouseover = function (data, event) {
            if (data !== that._selectedSuggestion) {
                that._selectedSuggestion = data;
            }
        };

        /**
         * Gets or sets a value indicating if this instance should always show its text input field.
         *
         * @type {Boolean}
         * @default false
         */
        this.keepExpanded = false;

        /**
         * True if the geocoder should query as the user types to autocomplete
         * @type {Booelan}
         * @default true
         */
        this.autoComplete = defaultValue(options.autocomplete, true);

        this._focusTextbox = false;

        knockout.track(this, ['_searchText', '_isSearchInProgress', 'keepExpanded', '_suggestions', '_selectedSuggestion', '_showSuggestions', '_focusTextbox']);

        var searchTextObservable = knockout.getObservable(this, '_searchText');
        searchTextObservable.extend({ rateLimit: { timeout: 500 } });
        this._suggestionSubscription = searchTextObservable.subscribe(function() {
            updateSearchSuggestions(that);
        });
        /**
         * Gets a value indicating whether a search is currently in progress.  This property is observable.
         *
         * @type {Boolean}
         */
        this.isSearchInProgress = undefined;
        knockout.defineProperty(this, 'isSearchInProgress', {
            get : function() {
                return this._isSearchInProgress;
            }
        });

        /**
         * Gets or sets the text to search for.  The text can be an address, or longitude, latitude,
         * and optional height, where longitude and latitude are in degrees and height is in meters.
         *
         * @type {String}
         */
        this.searchText = undefined;
        knockout.defineProperty(this, 'searchText', {
            get : function() {
                if (this.isSearchInProgress) {
                    return 'Searching...';
                }

                return this._searchText;
            },
            set : function(value) {
                //>>includeStart('debug', pragmas.debug);
                if (typeof value !== 'string') {
                    throw new DeveloperError('value must be a valid string.');
                }
                //>>includeEnd('debug');
                this._searchText = value;
            }
        });

        /**
         * Gets or sets the the duration of the camera flight in seconds.
         * A value of zero causes the camera to instantly switch to the geocoding location.
         * The duration will be computed based on the distance when undefined.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.flightDuration = undefined;
        knockout.defineProperty(this, 'flightDuration', {
            get : function() {
                return this._flightDuration;
            },
            set : function(value) {
                //>>includeStart('debug', pragmas.debug);
                if (defined(value) && value < 0) {
                    throw new DeveloperError('value must be positive.');
                }
                //>>includeEnd('debug');

                this._flightDuration = value;
            }
        });
    }

    defineProperties(GeocoderViewModel.prototype, {
        /**
         * Gets the Bing maps url.
         * @deprecated
         * @memberof GeocoderViewModel.prototype
         *
         * @type {String}
         */
        url : {
            get : function() {
                deprecationWarning('url is deprecated', 'The url property was deprecated in Cesium 1.30 and will be removed in version 1.31.');
                return this._url;
            }
        },

        /**
         * Gets the Bing maps key.
         * @deprecated
         * @memberof GeocoderViewModel.prototype
         *
         * @type {String}
         */
        key : {
            get : function() {
                deprecationWarning('key is deprecated', 'The key property was deprecated in Cesium 1.30 and will be removed in version 1.31.');
                return this._key;
            }
        },

        /**
         * Gets the event triggered on flight completion.
         * @memberof GeocoderViewModel.prototype
         *
         * @type {Event}
         */
        complete : {
            get : function() {
                return this._complete;
            }
        },

        /**
         * Gets the scene to control.
         * @memberof GeocoderViewModel.prototype
         *
         * @type {Scene}
         */
        scene : {
            get : function() {
                return this._scene;
            }
        },

        /**
         * Gets the Command that is executed when the button is clicked.
         * @memberof GeocoderViewModel.prototype
         *
         * @type {Command}
         */
        search : {
            get : function() {
                return this._searchCommand;
            }
        },

        /**
         * Gets the currently selected geocoder search suggestion
         * @memberof GeocoderViewModel.prototype
         *
         * @type {Object}
         */
        selectedSuggestion : {
            get : function() {
                return this._selectedSuggestion;
            }
        },

        /**
         * Gets the list of geocoder search suggestions
         * @memberof GeocoderViewModel.prototype
         *
         * @type {Object[]}
         */
        suggestions : {
            get : function() {
                return this._suggestions;
            }
        }
    });

    /**
     * Destroys the widget.  Should be called if permanently
     * removing the widget from layout.
     */
    GeocoderViewModel.prototype.destroy = function() {
        this._suggestionSubscription.dispose();
    };

    function handleArrowUp(viewModel) {
        if (viewModel._suggestions.length === 0) {
            return;
        }
        var next;
        var currentIndex = viewModel._suggestions.indexOf(viewModel._selectedSuggestion);
        if (currentIndex === -1 || currentIndex === 0) {
            viewModel._selectedSuggestion = undefined;
            return;
        }
        next = currentIndex - 1;
        viewModel._selectedSuggestion = viewModel._suggestions[next];
        adjustSuggestionsScroll(viewModel, next);
    }

    function handleArrowDown(viewModel) {
        if (viewModel._suggestions.length === 0) {
            return;
        }
        var numberOfSuggestions = viewModel._suggestions.length;
        var currentIndex = viewModel._suggestions.indexOf(viewModel._selectedSuggestion);
        var next = (currentIndex + 1) % numberOfSuggestions;
        viewModel._selectedSuggestion = viewModel._suggestions[next];

        adjustSuggestionsScroll(viewModel, next);
    }

    function updateCamera(viewModel, destination) {
        viewModel._scene.camera.flyTo({
            destination : destination,
            complete: function() {
                viewModel._complete.raiseEvent();
            },
            duration : viewModel._flightDuration,
            endTransform : Matrix4.IDENTITY
        });
    }

    function chainPromise(promise, geocoderService, query) {
        return promise
            .then(function(result) {
                if (defined(result) && result.state === 'fulfilled' && result.value.length > 0){
                    return result;
                }
                var nextPromise = geocoderService.geocode(query)
                    .then(function (result) {
                        return {state: 'fulfilled', value: result};
                    })
                    .otherwise(function (err) {
                        return {state: 'rejected', reason: err};
                    });

                return nextPromise;
            });
    }

    function geocode(viewModel, geocoderServices) {
        var query = viewModel._searchText;

        if (hasOnlyWhitespace(query)) {
            viewModel.showSuggestions();
            return;
        }

        viewModel._isSearchInProgress = true;

        var promise = when.resolve();
        for (var i = 0; i < geocoderServices.length; i++) {
            promise = chainPromise(promise, geocoderServices[i], query);
        }

        viewModel._geocodePromise = promise;
        promise
            .then(function (result) {
                if (promise.cancel) {
                    return;
                }
                viewModel._isSearchInProgress = false;

                var geocoderResults = result.value;
                if (result.state === 'fulfilled' && defined(geocoderResults) && geocoderResults.length > 0) {
                    viewModel._searchText = geocoderResults[0].displayName;
                    updateCamera(viewModel, geocoderResults[0].destination);
                    return;
                }
                viewModel._searchText = query + ' (not found)';
            });
    }

    function adjustSuggestionsScroll(viewModel, focusedItemIndex) {
        var container = getElement(viewModel._viewContainer);
        var searchResults = container.getElementsByClassName('search-results')[0];
        var listItems = container.getElementsByTagName('li');
        var element = listItems[focusedItemIndex];

        if (focusedItemIndex === 0) {
            searchResults.scrollTop = 0;
            return;
        }

        var offsetTop = element.offsetTop;
        if (offsetTop + element.clientHeight > searchResults.clientHeight) {
            searchResults.scrollTop = offsetTop + element.clientHeight;
        } else if (offsetTop < searchResults.scrollTop) {
            searchResults.scrollTop = offsetTop;
        }
    }

    function cancelGeocode(viewModel) {
        viewModel._isSearchInProgress = false;
        if (defined(viewModel._geocodePromise)) {
            viewModel._geocodePromise.cancel = true;
            viewModel._geocodePromise = undefined;
        }
    }

    function hasOnlyWhitespace(string) {
        return /^\s*$/.test(string);
    }

    function clearSuggestions(viewModel) {
        knockout.getObservable(viewModel, '_suggestions').removeAll();
    }

    function updateSearchSuggestions(viewModel) {
        if (!viewModel.autoComplete) {
            return;
        }

        var query = viewModel._searchText;

        clearSuggestions(viewModel);
        if (hasOnlyWhitespace(query)) {
            return;
        }

        var promise = when.resolve([]);
        viewModel._geocoderServices.forEach(function (service) {
            promise = promise.then(function(results) {
                if (results.length >= 5) {
                    return results;
                }
                return service.geocode(query)
                    .then(function(newResults) {
                        results = results.concat(newResults);
                        return results;
                    });
            });
        });
        promise
            .then(function (results) {
                var suggestions = viewModel._suggestions;
                for (var i = 0; i < results.length; i++) {
                    suggestions.push(results[i]);
                }
            });
    }

    return GeocoderViewModel;
});
