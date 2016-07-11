
define(function (require, exports, module) {
    
    var ScreenControlsView = require("plugins/pimPrototyper/forms/ScreenControlsView");
    
    return function() {
        describe("the screen controls view", function() {
            
            function createCollection(modelData) {
                modelData = modelData || [];
                return new (Backbone.Collection.extend({}))(modelData);
            }
            
            function createView (collection) {
                collection = collection || createCollection();
                return new ScreenControlsView({ collection: collection });
            }

            function hasElement (selector) {
                var viewEl = createView().render().$el;
                var el = viewEl.find(selector);
                expect(el.length).toBeGreaterThan(0);
            }

            it("renders a dropdown list", function() {
                hasElement(".btn-screen-dropdown");
            });
            
            it("renders a settings button", function() {
                hasElement(".btn-screen-options");
            });
            
            it("renders a delete button", function() {
                hasElement(".btn-screen-delete");
            });
            
            it("renders a change image button", function() {
                hasElement(".btn-screen-image");
            });
            
            it("renders an add button", function() {
                hasElement(".btn-screen-add");
            });
            
            it("lists all the screens in the model", function() {
                var collection = createCollection(["a", "b", "c"]);
                var view = createView(collection);
                var count = view.render().$el.find(".screen-dropdown li").length;
                expect(count).toEqual(collection.length);
            });
            
            it("updates the screen list when the collection is removed from", function() {
                var collection = createCollection(["a", "b", "c"]);
                var view = createView(collection);
                collection.remove(collection.last());
                var count = view.$el.find(".screen-dropdown li").length;
                expect(count).toEqual(collection.length);
            });
        });
    };
});