/**
 * Registry Instance
 *
 * Initializes and exports the parser registry instance
 */

const ParserRegistry = require('./parserRegistry');

// Create registry instance
const registry = new ParserRegistry();

module.exports = registry;
