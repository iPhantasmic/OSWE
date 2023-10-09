const Guacamole = require('guacamole-common-js');
import $ from "jquery";


export function rdp() {
	var display = document.getElementById("display");
	const urlParams = new URLSearchParams(window.location.search);
	var token = urlParams.get('token');
  
	var tunnel = new Guacamole.WebSocketTunnel('/guaclite');

	var guac = new Guacamole.Client(tunnel);

	display.appendChild(guac.getDisplay().getElement());

	guac.onerror = function(error) {
		display.style.cursor = 'default';
		$('#display').empty();
		$('#display').append(
		'<center><h1>Oh no! Something went wrong!</h1><br><p>' 
			+error.message + '</p>');
	};

	guac.connect('token=' + token + '&width=' + $(document).width() + '&height=' + $(document).height());
	display.style.cursor = 'none';
	// Disconnect on close
	window.onunload = function() {
		guac.disconnect();
	};

	var mouse = new Guacamole.Mouse(guac.getDisplay().getElement());
		mouse.onmousedown = 
		mouse.onmouseup   =
		mouse.onmousemove = function(mouseState) {
		guac.sendMouseState(mouseState);
	};

	var keyboard = new Guacamole.Keyboard(document);
		keyboard.onkeydown = function (keysym) {
		guac.sendKeyEvent(1, keysym);
	};

	keyboard.onkeyup = function (keysym) {
		guac.sendKeyEvent(0, keysym);
	};

	var resizeId;
	$(window).resize(function() {
		clearTimeout(resizeId);
		resizeId = setTimeout(doneResizing, 500);
	});
	function doneResizing(){
		document.location.reload(true);
	}
  }