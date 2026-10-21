/**
 * @file Gutenberg bağış formu bloğu (JSX yok).
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
            var next = [{ value: "0", label: __("Mevcut ürün (otomatik)", "woo-donation-popup") }];
            (list || []).forEach(function (item) {
              next.push({
                value: String(item.id),
                label: (item.name || "#" + item.id) + " (#" + item.id + ")",
              });
            });
            setOptions(next);
          },
          function () {
            setOptions([{ value: "0", label: __("Mevcut ürün (otomatik)", "woo-donation-popup") }]);
          }
        );
      },
      [search]
    );

    if (ComboboxControl) {
      return el(ComboboxControl, {
        label: __("Ürün", "woo-donation-popup"),
        value: String(value || 0),
        options: options,
        onFilterValueChange: setSearch,
        onChange: function (v) {
          onChange(parseInt(v, 10) || 0);
        },
      });
    }
    return el(SelectControl, {
      label: __("Ürün", "woo-donation-popup"),
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
            { title: __("Bağış formu", "woo-donation-popup"), initialOpen: true },
            el(ProductPicker, {
              value: atts.productId,
              onChange: function (id) {
                set({ productId: id });
              },
            }),
            el(SelectControl, {
              label: __("Görünüm", "woo-donation-popup"),
              value: atts.display || "inline",
              options: [
                { label: __("Sayfa içi form", "woo-donation-popup"), value: "inline" },
                { label: __("Ortada pencere", "woo-donation-popup"), value: "popup" },
                { label: __("Sağ panel", "woo-donation-popup"), value: "panel" },
              ],
              onChange: function (v) {
                set({ display: v });
              },
            }),
            el(ToggleControl, {
              label: __("Başlığı göster", "woo-donation-popup"),
              checked: !!atts.showTitle,
              onChange: function (v) {
                set({ showTitle: v });
              },
            }),
            atts.display !== "inline"
              ? el(TextControl, {
                  label: __("Buton metni", "woo-donation-popup"),
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
            label: __("Bağış formu", "woo-donation-popup"),
            instructions: __("Ürün seçilmediyse mevcut ürün (otomatik) kullanılır. Ürün sayfasında veya kimlik verildiğinde form görünür.", "woo-donation-popup"),
          })
      );
    },
    save: function () {
      return null;
    },
  });
})(window.wp);
