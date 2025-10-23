const helmet = require('helmet');

// Content Security Policy: No unsafe-inline or unsafe-eval
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
};

function securityMiddleware() {
  return [
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: cspDirectives,
      },
      crossOriginEmbedderPolicy: false,
    }),
  ];
}

module.exports = securityMiddleware;
