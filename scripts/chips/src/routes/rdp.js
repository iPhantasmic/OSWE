var express = require('express');
var router = express.Router();
const crypto = require('crypto');

router.get('/', function(req, res, next) {
  res.render('rdp', { title: 'Connection' });
});

module.exports = router;
