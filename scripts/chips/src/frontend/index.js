import 'bootstrap';
import "./style/_custom.scss";
import { rdp } from './rdp.js';
import { root } from './root.js';

switch (window.location.pathname) {
	case "/":
		root();
		break;

	case "/rdp":
		rdp();
		break;

	default:
		break;
}