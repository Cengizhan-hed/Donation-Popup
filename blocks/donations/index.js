/**
 * @file Gutenberg bağış listesi bloğu (JSX yok).
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
        { label: __("Evet", "woo-donation-popup"), value: "yes" },
        { label: __("Hayır", "woo-donation-popup"), value: "no" },
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
            { title: __("Sorgu", "woo-donation-popup"), initialOpen: true },
            text(atts, set, "categories", __("Kategoriler (slug)", "woo-donation-popup")),
            text(atts, set, "exclude_categories", __("Hariç kategoriler", "woo-donation-popup")),
            text(atts, set, "ids", __("Yalnızca ID’ler", "woo-donation-popup")),
            text(atts, set, "exclude", __("Hariç ID’ler", "woo-donation-popup")),
            text(atts, set, "type", __("Tip (fixed,custom,shares,campaign)", "woo-donation-popup")),
            el(RangeControl, {
              label: __("Adet", "woo-donation-popup"),
              value: atts.limit || 48,
              min: 1,
              max: 100,
              onChange: function (v) {
                set({ limit: v });
              },
            }),
            el(SelectControl, {
              label: __("Sıralama", "woo-donation-popup"),
              value: atts.orderby || "menu_order",
              options: [
                { label: __("Menü sırası", "woo-donation-popup"), value: "menu_order" },
                { label: __("Tarih", "woo-donation-popup"), value: "date" },
                { label: __("Başlık", "woo-donation-popup"), value: "title" },
                { label: __("Popülerlik", "woo-donation-popup"), value: "popularity" },
                { label: __("Rastgele", "woo-donation-popup"), value: "random" },
              ],
              onChange: function (v) {
                set({ orderby: v });
              },
            }),
            el(SelectControl, {
              label: __("Yön", "woo-donation-popup"),
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
            { title: __("Görünüm", "woo-donation-popup"), initialOpen: false },
            el(RangeControl, {
              label: __("Sütunlar", "woo-donation-popup"),
              value: atts.columns || 3,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns: v });
              },
            }),
            el(RangeControl, {
              label: __("Tablet sütun", "woo-donation-popup"),
              value: atts.columns_tablet || 2,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns_tablet: v });
              },
            }),
            el(RangeControl, {
              label: __("Mobil sütun", "woo-donation-popup"),
              value: atts.columns_mobile || 1,
              min: 1,
              max: 6,
              onChange: function (v) {
                set({ columns_mobile: v });
              },
            }),
            el(RangeControl, {
              label: __("Boşluk (px)", "woo-donation-popup"),
              value: atts.gap || 24,
              min: 0,
              max: 64,
              onChange: function (v) {
                set({ gap: v });
              },
            }),
            el(SelectControl, {
              label: __("Görsel oranı", "woo-donation-popup"),
              value: atts.image_ratio || "4:3",
              options: [
                { label: "1:1", value: "1:1" },
                { label: "4:3", value: "4:3" },
                { label: "3:2", value: "3:2" },
                { label: "16:9", value: "16:9" },
                { label: __("Orijinal", "woo-donation-popup"), value: "original" },
              ],
              onChange: function (v) {
                set({ image_ratio: v });
              },
            }),
            el(SelectControl, {
              label: __("Hiza", "woo-donation-popup"),
              value: atts.align || "center",
              options: [
                { label: __("Orta", "woo-donation-popup"), value: "center" },
                { label: __("Sol", "woo-donation-popup"), value: "left" },
              ],
              onChange: function (v) {
                set({ align: v });
              },
            }),
            el(SelectControl, {
              label: __("Buton", "woo-donation-popup"),
              value: atts.button || "panel",
              options: [
                { label: __("Panel", "woo-donation-popup"), value: "panel" },
                { label: __("Popup", "woo-donation-popup"), value: "popup" },
                { label: __("Bağlantı", "woo-donation-popup"), value: "link" },
              ],
              onChange: function (v) {
                set({ button: v });
              },
            }),
            yesNo(atts.button_full, function (v) { set({ button_full: v }); }, __("Buton tam genişlik", "woo-donation-popup")),
            text(atts, set, "button_text", __("Buton metni", "woo-donation-popup")),
            yesNo(atts.tabs, function (v) { set({ tabs: v }); }, __("Sekmeler", "woo-donation-popup")),
            yesNo(atts.tab_all, function (v) { set({ tab_all: v }); }, __('“Tümü” sekmesi', "woo-donation-popup")),
            text(atts, set, "tab_all_label", __("Tümü etiketi", "woo-donation-popup")),
            yesNo(atts.show_image, function (v) { set({ show_image: v }); }, __("Görsel", "woo-donation-popup")),
            yesNo(atts.show_excerpt, function (v) { set({ show_excerpt: v }); }, __("Özet", "woo-donation-popup")),
            yesNo(atts.show_progress, function (v) { set({ show_progress: v }); }, __("İlerleme", "woo-donation-popup")),
            yesNo(atts.show_price, function (v) { set({ show_price: v }); }, __("Fiyat", "woo-donation-popup")),
            yesNo(atts.show_category, function (v) { set({ show_category: v }); }, __("Kategori", "woo-donation-popup")),
            el(RangeControl, {
              label: __("Özet kelime", "woo-donation-popup"),
              value: atts.excerpt_words || 18,
              min: 0,
              max: 60,
              onChange: function (v) {
                set({ excerpt_words: v });
              },
            }),
            el(SelectControl, {
              label: __("Başlık etiketi", "woo-donation-popup"),
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
            text(atts, set, "class", __("CSS sınıfı", "woo-donation-popup"))
          )
        ),
        el(ServerSideRender, { block: "wdp/donations", attributes: atts }) ||
          el(Placeholder, {
            label: __("Bağış listesi", "woo-donation-popup"),
            instructions: __("Önizleme için en az bir yayımlanmış bağış ürünü gerekir.", "woo-donation-popup"),
          })
      );
    },
    save: function () {
      return null;
    },
  });
})(window.wp);
