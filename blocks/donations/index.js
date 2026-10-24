/**
 * @file Gutenberg donations list block (no JSX).
 */
(function (wp) {
  "use strict";
  if (!wp || !wp.blocks || !wp.element) return;

  var el = wp.element.createElement;
  var Fragment = wp.element.Fragment;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var TextControl = wp.components.TextControl;
  var RangeControl = wp.components.RangeControl;
  var ToggleControl = wp.components.ToggleControl;
  var Placeholder = wp.components.Placeholder;
  var ServerSideRender = wp.serverSideRender;
  var __ = wp.i18n.__;

  function yesNo(value, onChange, label) {
    return el(SelectControl, {
      label: label,
      value: value === "no" ? "no" : "yes",
      options: [
        { label: __("Yes", "woo-donation-popup"), value: "yes" },
        { label: __("No", "woo-donation-popup"), value: "no" },
      ],
      onChange: onChange,
    });
  }

  function text(atts, set, key, label) {
    return el(TextControl, {
      label: label,
      value: atts[key] || "",
      onChange: function (v) {
        var next = {};
        next[key] = v;
        set(next);
      },
    });
  }

  wp.blocks.registerBlockType("wdp/donations", {
    edit: function (props) {
      var atts = props.attributes;
      var set = props.setAttributes;
      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Query", "woo-donation-popup"), initialOpen: true },
            text(atts, set, "categories", __("Categories (slugs)", "woo-donation-popup")),
            text(atts, set, "exclude_categories", __("Exclude categories", "woo-donation-popup")),
            text(atts, set, "ids", __("IDs only", "woo-donation-popup")),
            text(atts, set, "exclude", __("Exclude IDs", "woo-donation-popup")),
            text(atts, set, "type", __("Type (fixed,custom,shares,campaign)", "woo-donation-popup")),
            el(RangeControl, {
              label: __("Count", "woo-donation-popup"),
              value: atts.limit || 48,
              min: 1,
              max: 100,
              onChange: function (v) {
                set({ limit: v });
              },
            }),
            el(SelectControl, {
              label: __("Order by", "woo-donation-popup"),
              value: atts.orderby || "menu_order",
              options: [
                { label: __("Menu order", "woo-donation-popup"), value: "menu_order" },
                { label: __("Date", "woo-donation-popup"), value: "date" },
                { label: __("Title", "woo-donation-popup"), value: "title" },
                { label: __("Popularity", "woo-donation-popup"), value: "popularity" },
                { label: __("Random", "woo-donation-popup"), value: "random" },
              ],
              onChange: function (v) {
                set({ orderby: v });
              },
            }),
            el(SelectControl, {
              label: __("Direction", "woo-donation-popup"),
              value: atts.order || "ASC",
              options: [
                { label: "ASC", value: "ASC" },
                { label: "DESC", value: "DESC" },
              ],
              onChange: function (v) {
                set({ order: v });
              },
            })
          ),
          el(
            PanelBody,
            { title: __("Display", "woo-donation-popup"), initialOpen: false },
            el(RangeControl, {
              label: __("Columns", "woo-donation-popup"),
              value: atts.columns || 3,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns: v });
              },
            }),
            el(RangeControl, {
              label: __("Tablet columns", "woo-donation-popup"),
              value: atts.columns_tablet || 2,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns_tablet: v });
              },
            }),
            el(RangeControl, {
              label: __("Mobile columns", "woo-donation-popup"),
              value: atts.columns_mobile || 1,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns_mobile: v });
              },
            }),
            el(RangeControl, {
              label: __("Gap (px)", "woo-donation-popup"),
              value: atts.gap || 24,
              min: 0,
              max: 64,
              onChange: function (v) {
                set({ gap: v });
              },
            }),
            el(SelectControl, {
              label: __("Image ratio", "woo-donation-popup"),
              value: atts.image_ratio || "4:3",
              options: [
                { label: "1:1", value: "1:1" },
                { label: "4:3", value: "4:3" },
                { label: "3:2", value: "3:2" },
                { label: "16:9", value: "16:9" },
                { label: __("Original", "woo-donation-popup"), value: "original" },
              ],
              onChange: function (v) {
                set({ image_ratio: v });
              },
            }),
            el(SelectControl, {
              label: __("Alignment", "woo-donation-popup"),
              value: atts.align || "center",
              options: [
                { label: __("Center", "woo-donation-popup"), value: "center" },
                { label: __("Left", "woo-donation-popup"), value: "left" },
              ],
              onChange: function (v) {
                set({ align: v });
              },
            }),
            el(SelectControl, {
              label: __("Button", "woo-donation-popup"),
              value: atts.button || "panel",
              options: [
                { label: __("Panel", "woo-donation-popup"), value: "panel" },
                { label: __("Popup", "woo-donation-popup"), value: "popup" },
                { label: __("Link", "woo-donation-popup"), value: "link" },
              ],
              onChange: function (v) {
                set({ button: v });
              },
            }),
            yesNo(atts.button_full, function (v) { set({ button_full: v }); }, __("Full-width button", "woo-donation-popup")),
            text(atts, set, "button_text", __("Button text", "woo-donation-popup")),
            yesNo(atts.tabs, function (v) { set({ tabs: v }); }, __("Tabs", "woo-donation-popup")),
            yesNo(atts.tab_all, function (v) { set({ tab_all: v }); }, __('“All” tab', "woo-donation-popup")),
            text(atts, set, "tab_all_label", __("All tab label", "woo-donation-popup")),
            yesNo(atts.show_image, function (v) { set({ show_image: v }); }, __("Image", "woo-donation-popup")),
            yesNo(atts.show_excerpt, function (v) { set({ show_excerpt: v }); }, __("Excerpt", "woo-donation-popup")),
            yesNo(atts.show_progress, function (v) { set({ show_progress: v }); }, __("Progress", "woo-donation-popup")),
            yesNo(atts.show_price, function (v) { set({ show_price: v }); }, __("Price", "woo-donation-popup")),
            yesNo(atts.show_category, function (v) { set({ show_category: v }); }, __("Category", "woo-donation-popup")),
            el(RangeControl, {
              label: __("Excerpt words", "woo-donation-popup"),
              value: atts.excerpt_words || 18,
              min: 0,
              max: 60,
              onChange: function (v) {
                set({ excerpt_words: v });
              },
            }),
            el(SelectControl, {
              label: __("Heading tag", "woo-donation-popup"),
              value: atts.heading_tag || "h3",
              options: [
                { label: "H2", value: "h2" },
                { label: "H3", value: "h3" },
                { label: "H4", value: "h4" },
              ],
              onChange: function (v) {
                set({ heading_tag: v });
              },
            }),
            text(atts, set, "class", __("CSS class", "woo-donation-popup"))
          )
        ),
        el(ServerSideRender, { block: "wdp/donations", attributes: atts }) ||
          el(Placeholder, {
            label: __("Donations list", "woo-donation-popup"),
            instructions: __("At least one published donation product is required for the preview.", "woo-donation-popup"),
          })
      );
    },
    save: function () {
      return null;
    },
  });
})(window.wp);
