var express = require('express');
var router = express.Router();
const crypto = require('crypto');

const clientOptions = require("../settings/clientOptions.json")

const encrypt = (value) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(clientOptions.crypt.cypher, clientOptions.crypt.key, iv);

  let crypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
  crypted += cipher.final('base64');


  const data = {
      iv: iv.toString('base64'),
      value: crypted
  };

  return new Buffer.from(JSON.stringify(data)).toString('base64');
};

router.post('/', function(req, res, next) {
  console.log(clientOptions);
  token = encrypt(req.body);
  res.json({"token": token});
});

module.exports = router;
