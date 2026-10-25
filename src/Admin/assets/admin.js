/**
 * Donation Panel yönetici ekranları (E7): sekmeler, kaydedilmemiş değişiklik uyarısı, canlı önizleme,
 * kopyala düğmesi, sihirbaz adımları. Bağımsız (jQuery yok); betiksiz de form çalışır.
 */
( function () {
	'use strict';

	var root = document.querySelector( '.dpa' );
	if ( ! root ) {
		return;
	}
	root.classList.add( 'dpa-js' );

	function qsa( sel, ctx ) {
		return Array.prototype.slice.call( ( ctx || root ).querySelectorAll( sel ) );
	}

	/* Sekmeler (ok tuşları + Home/End). */
	var tabs = qsa( '[data-dpa-tab]' );
	if ( tabs.length ) {
		var panels = qsa( '[data-dpa-panel]' );
		var select = function ( id, focus ) {
			tabs.forEach( function ( tab ) {
				var on = tab.getAttribute( 'data-dpa-tab' ) === id;
				tab.setAttribute( 'aria-selected', on ? 'true' : 'false' );
				tab.setAttribute( 'tabindex', on ? '0' : '-1' );
				if ( on && focus ) {
					tab.focus();
				}
			} );
			panels.forEach( function ( panel ) {
				panel.hidden = panel.getAttribute( 'data-dpa-panel' ) !== id;
			} );
			window.history.replaceState( null, '', '#' + id );
		};
		tabs.forEach( function ( tab, index ) {
			tab.addEventListener( 'click', function () {
				select( tab.getAttribute( 'data-dpa-tab' ), false );
			} );
			tab.addEventListener( 'keydown', function ( event ) {
				var next = -1;
				if ( 'ArrowRight' === event.key || 'ArrowDown' === event.key ) {
					next = ( index + 1 ) % tabs.length;
				} else if ( 'ArrowLeft' === event.key || 'ArrowUp' === event.key ) {
					next = ( index - 1 + tabs.length ) % tabs.length;
				} else if ( 'Home' === event.key ) {
					next = 0;
				} else if ( 'End' === event.key ) {
					next = tabs.length - 1;
				}
				if ( next >= 0 ) {
					event.preventDefault();
					select( tabs[ next ].getAttribute( 'data-dpa-tab' ), true );
				}
			} );
		} );
		var initial = ( window.location.hash || '' ).replace( '#', '' );
		select( tabs.some( function ( t ) { return t.getAttribute( 'data-dpa-tab' ) === initial; } ) ? initial : tabs[ 0 ].getAttribute( 'data-dpa-tab' ), false );
	}

	/* Canlı önizleme: modül anahtarları. */
	function syncPreview() {
		qsa( '[data-dpa-module]' ).forEach( function ( input ) {
			var slug = input.getAttribute( 'data-dpa-module' );
			qsa( '[data-dpa-preview="' + slug + '"]' ).forEach( function ( block ) {
				block.hidden = ! input.checked;
			} );
		} );
	}
	qsa( '[data-dpa-module]' ).forEach( function ( input ) {
		input.addEventListener( 'change', syncPreview );
	} );
	syncPreview();

	/* Kaydedilmemiş değişiklik. */
	var form = root.querySelector( '[data-dpa-form]' );
	if ( form ) {
		var msg = root.querySelector( '[data-dpa-msg]' );
		var dirty = false;
		var saving = false;
		var mark = function () {
			dirty = true;
			if ( msg ) {
				msg.textContent = msg.getAttribute( 'data-unsaved' ) || '';
			}
		};
		form.addEventListener( 'change', mark );
		form.addEventListener( 'input', mark );
		form.addEventListener( 'submit', function () {
			saving = true;
		} );
		window.addEventListener( 'beforeunload', function ( event ) {
			if ( dirty && ! saving ) {
				event.preventDefault();
				event.returnValue = '';
			}
		} );
	}

	/* Kopyala düğmeleri. */
	qsa( '[data-dpa-copy]' ).forEach( function ( button ) {
		button.addEventListener( 'click', function () {
			var text = button.getAttribute( 'data-dpa-copy' );
			var done = function () {
				var old = button.getAttribute( 'data-label' ) || button.textContent;
				button.setAttribute( 'data-label', old );
				button.textContent = '✓';
				window.setTimeout( function () {
					button.textContent = old;
				}, 1500 );
			};
			if ( navigator.clipboard && navigator.clipboard.writeText ) {
				navigator.clipboard.writeText( text ).then( done, function () {} );
			}
		} );
	} );

	/* Sihirbaz adımları. */
	var wizard = root.querySelector( '[data-dpa-wizard]' );
	if ( wizard ) {
		var steps = qsa( '[data-dpa-step]', wizard );
		var stepper = qsa( '[data-dpa-stepper]' );
		var back = wizard.querySelector( '[data-dpa-back]' );
		var next = wizard.querySelector( '[data-dpa-next]' );
		var finish = wizard.querySelector( '[data-dpa-finish]' );
		var at = 0;
		var draw = function ( focusHeading ) {
			steps.forEach( function ( step, index ) {
				step.hidden = index !== at;
			} );
			stepper.forEach( function ( item, index ) {
				item.classList.toggle( 'cur', index === at );
				item.classList.toggle( 'done', index < at );
				if ( index === at ) {
					item.setAttribute( 'aria-current', 'step' );
				} else {
					item.removeAttribute( 'aria-current' );
				}
			} );
			back.hidden = 0 === at;
			next.hidden = at === steps.length - 1;
			finish.hidden = at !== steps.length - 1;
			var heading = steps[ at ].querySelector( 'h2' );
			if ( heading && focusHeading ) {
				heading.setAttribute( 'tabindex', '-1' );
				heading.focus();
			}
		};
		next.addEventListener( 'click', function () {
			at = Math.min( at + 1, steps.length - 1 );
			draw( true );
		} );
		back.addEventListener( 'click', function () {
			at = Math.max( at - 1, 0 );
			draw( true );
		} );
		/* Betik yoksa tüm adımlar görünür; betik varsa tek tek. */
		draw( false );
	}
}() );
