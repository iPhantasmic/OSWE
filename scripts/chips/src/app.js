var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config()

var indexRouter = require('./routes/index');
var tokenRouter = require('./routes/token');
var rdpRouter = require('./routes/rdp');
var filesRouter = require('./routes/files');

var app = express();

// view engine setup
t_engine = process.env.TEMPLATING_ENGINE;
if (t_engine !== "hbs" && t_engine !== "ejs" && t_engine !== "pug" )
{
    t_engine = "hbs";
}

app.set('views', path.join(__dirname, 'views/' + t_engine));
app.set('view engine', t_engine);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/token', tokenRouter);
app.use('/rdp', rdpRouter);
app.use('/files', filesRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
