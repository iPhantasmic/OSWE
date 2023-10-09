var express = require('express');
var router = express.Router();
var Docker = require('dockerode');
const { names } = require('debug');
var docker = new Docker({socketPath: '/var/run/docker.sock'});

const defaultSettings = require("../settings/connectionOptions.json")

/* GET home page. */
router.get('/', function(req, res, next) {
  docker.listContainers(function (err, containers) {
    containers.forEach(function (containerInfo) {
      if(containerInfo.Names.includes("/rdesktop")){
        containerInfo.Name = containerInfo.Names[0].replace("/", "");
        res.render('index', { title: 'Chips - Home', container: containerInfo, s: defaultSettings });
      }
    })
  });
});

module.exports = router;
