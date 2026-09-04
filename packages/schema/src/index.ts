/**
 * Kanonický datový model aplikace „Moje Kladno".
 *
 * Obrazovky aplikace nikdy nevědí, ze kterého zdroje data pocházejí — pipeline
 * všechny zdroje převádí na tyto typy. Schémata jsou zároveň validací: pipeline
 * jimi prožene data před zápisem a při chybě celý běh padá, ať se do `data/v1/`
 * nedostane nic rozbitého.
 */
export * from './common.js';
export * from './board.js';
export * from './content.js';
export * from './places.js';
export * from './manifest.js';
