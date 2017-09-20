/*global define*/
define([
        '../../Core/defineProperties',
        '../../ThirdParty/knockout',
        './PointCircleSwitchViewModel'
    ], function(
        defineProperties,
        knockout,
        PointCircleSwitchViewModel) {
    'use strict';

    /**
     * A widget to switch between points and circles.
     *
     * @alias PointCircleSwitch
     * @constructor
     *
     */
    var PointCircleSwitch = function (IconsContainer, wrapperPanel, viewerContainer, viewer) {

        var viewModel = new PointCircleSwitchViewModel(IconsContainer, wrapperPanel, viewerContainer,  viewer);

        var icone = '<g><path style="fill:#fff;" d="M153.905,130.755c2.562-5.39,5.695-12.222,8.169-18.4c2.241-5.57-0.315-13.201-5.314-16.529\
		C124.589,74.369,15.465,12.559,3.118,151.467c-0.533,5.983-1.594,6.054-2.187,0.076C-1.157,130.63-2.13,84.415,25.457,59.531\
		c4.46-4.019,12.319-9.801,17.345-13.086c17.884-11.71,62.767-31.857,127.318,2.594c5.303,2.828,10.476,0.598,11.727-5.276\
		l4.493-21.142c1.246-5.874,4.775-6.467,7.887-1.327l52.917,87.563c3.106,5.14,0.865,10.334-5.009,11.607l-82.375,17.764\
		C153.878,139.496,151.327,136.178,153.905,130.755z M236.247,239.357c-17.884,11.694-62.761,31.802-127.318-2.622\
		c-5.303-2.828-11.047-0.756-12.994,4.928l-5.466,15.958c-1.947,5.684-5.793,5.978-8.588,0.658l-42.256-80.444\
		c-2.796-5.319-0.402-11.052,5.347-12.804l69.832-21.332c5.744-1.751,9.1,1.517,7.5,7.316c-1.795,6.489-4.117,14.947-6.081,22.175\
		c-1.572,5.798,1.137,13.353,6.206,16.589c32.553,20.766,142.743,80.319,154.741-56.653c0.522-5.983,1.496-6.032,2.007-0.049\
		c1.806,21.153,2.197,68.157-25.58,93.198C249.133,230.29,241.279,236.072,236.247,239.357z"/></g>';
        viewModel._icone = icone;
        this._viewModel = viewModel;

        // For the icon inside the main menu panel

        var switchButton = document.createElement('div');
        switchButton.className = 'cesium-button cesium-toolbar-button cesium-modificationsToolbar-button';
        switchButton.innerHTML = '<svg width="28" height="28" viewBox="0 0  279.881  279.881">' + icone + ' </svg>';
        switchButton.setAttribute('data-bind', 'attr  : { title: "Switch between points and circles" },\
                                                          css   : { "cesium-drawEdit-button-hidden"  : !isPanelToolVisibleSwitch,\
                                                                    "cesium-drawEdit-button-visible" : isPanelToolVisibleSwitch,\
                                                                    "cesium-subMenu-focus": isSwitchActive },\
                                                          event : {click : switchCommand}');
        wrapperPanel.appendChild(switchButton);

        knockout.applyBindings(viewModel, switchButton);


    };

    defineProperties(PointCircleSwitch.prototype, {
        /**
         * Gets the parent container.
         * @memberof Tools.prototype
         *
         * @type {Element}
         */
        container: {
            get: function () {
                return this._container;
            }
        },
        /**
         * Gets the view model.
         * @memberof Tools.prototype
         *
         * @type {ToolsViewModel}
         */
        viewModel: {
            get: function () {
                return this._viewModel;
            }
        },
    });

    return PointCircleSwitch;
});
