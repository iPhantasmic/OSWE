const axios = require('axios').default;

const defaultSettings = {
	"connection": {
		"type": "rdp",
		"settings": {}
	}
  }

export function root() {
	const form = document.querySelector('form');
	form.addEventListener('submit', handleSubmit);
}

function handleSubmit(event) {
	event.preventDefault();
  
	const data = new FormData(event.target);
  
	const value = Object.fromEntries(data.entries());
  
	let settings = defaultSettings
	settings.connection.settings = value

	axios.post('/token', settings,  {
		maxRedirects: 0,
	}).then(function (res){
		window.location.replace("/rdp?token=" + res.data.token)
	});
	console.log(defaultSettings);
  }
