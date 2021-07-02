const winston = require('winston');

const loggerLevel = process.env.LOGGER_LEVEL || 'info';

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.simple()
  )
});

const config = {
  level: loggerLevel,
  transports: [
    consoleTransport,
    new winston.transports.File({ filename: 'application.log' })
  ]
};

// Logger instance:
const logger = winston.createLogger(config);

module.exports = logger;
