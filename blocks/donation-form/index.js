/**
 * @file Gutenberg donation form block (no JSX).
 */
(function (wp) {
  "use strict";
  if (!wp || !wp.blocks || !wp.element) return;

  var el = wp.element.createElement;
  var Fragment = wp.element.Fragment;
  var useState = wp.element.useState;
  var useEffect = wp.element.useEffect;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var TextControl = wp.components.TextControl;
  var ToggleControl = wp.components.ToggleControl;
  var ComboboxControl = wp.components.ComboboxControl;
  var Placeholder = wp.components.Placeholder;
  var ServerSideRender = wp.serverSideRender;
  var __ = wp.i18n.__;
  var _x = wp.i18n._x;
  var apiFetch = wp.apiFetch;

  function ProductPicker(props) {
    var value = props.value || 0;
    var onChange = props.onChange;
    var state = useState([]);
    var options = state[0];
    var setOptions = state[1];
    var searchState = useState("");
    var search = searchState[0];
    var setSearch = searchState[1];

    useEffect(
      function () {
        var path = "/wc/store/v1/products?per_page=20";
        if (search) path += "&search=" + encodeURIComponent(search);
        apiFetch({ path: path }).then(
          function (list) {
            var next = [{ value: "0", label: __("Current product (automatic)", "woo-donation-popup") }];
            (list || []).forEach(function (item) {
              next.push({
                value: String(item.id),
                label: (item.name || "#" + item.id) + " (#" + item.id + ")",
              });
            });
            setOptions(next);
          },
          function () {
            setOptions([{ value: "0", label: __("Current product (automatic)", "woo-donation-popup") }]);
          }
        );
      },
      [search]
    );

    if (ComboboxControl) {
      return el(ComboboxControl, {
        label: __("Product", "woo-donation-popup"),
        value: String(value || 0),
        options: options,
        onFilterValueChange: setSearch,
        onChange: function (v) {
          onChange(parseInt(v, 10) || 0);
        },
      });
    }
    return el(SelectControl, {
      label: __("Product", "woo-donation-popup"),
      value: String(value || 0),
      options: options,
      onChange: function (v) {
        onChange(parseInt(v, 10) || 0);
      },
    });
  }

  wp.blocks.registerBlockType("wdp/donation-form", {
    edit: function (props) {
      var atts = props.attributes;
      var set = props.setAttributes;
      var preview = el(ServerSideRender, {
        block: "wdp/donation-form",
        attributes: atts,
      });
      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Donation form", "woo-donation-popup"), initialOpen: true },
            el(ProductPicker, {
              value: atts.productId,
              onChange: function (id) {
                set({ productId: id });
              },
            }),
            el(SelectControl, {
              label: __("Display", "woo-donation-popup"),
              value: atts.display || "inline",
              options: [
                { label: __("Inline form", "woo-donation-popup"), value: "inline" },
                { label: _x("Popup", "display mode", "woo-donation-popup"), value: "popup" },
                { label: __("Side panel", "woo-donation-popup"), value: "panel" },
              ],
              onChange: function (v) {
                set({ display: v });
              },
            }),
            el(ToggleControl, {
              label: __("Show heading", "woo-donation-popup"),
              checked: !!atts.showTitle,
              onChange: function (v) {
                set({ showTitle: v });
              },
            }),
            atts.display !== "inline"
              ? el(TextControl, {
                  label: __("Button text", "woo-donation-popup"),
                  value: atts.buttonText || "",
                  onChange: function (v) {
                    set({ buttonText: v });
                  },
                })
              : null
          )
        ),
        preview ||
          el(Placeholder, {
            label: __("Donation form", "woo-donation-popup"),
            instructions: __("If no product is selected, the current product is used automatically. The form appears on the product page or when an ID is provided.", "woo-donation-popup"),
          })
      );
    },
    save: function () {
      return null;
    },
  });
})(window.wp);
