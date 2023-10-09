var express = require('express');
var router = express.Router();
const fs = require('fs')
var path = require('path');



router.get('/*', function(req, res, next) {
  let fileName = req.params["0"].split("../").join("")
  let filePath = path.join(__dirname, '../shared/' + fileName);
  res.download(filePath);
});

module.exports = router;
