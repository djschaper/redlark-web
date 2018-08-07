# FBC Redlark

This is a web app for planning and organizing worship sets and songs.
The NodeJS server is hosted as an AWS ElasticBeanstalk app.

## Quick Start
1. Install NodeJS 8.11.3 and NPM (https://nodejs.org/en/)
1. Install node modules: `npm install`
1. Install and start MySQL Server (https://dev.mysql.com/downloads/installer/)
	- Create a local database and set the corresponding `DB_` variables in `.env` file:
1. Run database migrations: `npm run db:migrate`
1. Run database seeds: `npm run db:seed`
1. Start server on localhost (url printed in console): `npm run start:dev`

## Database
The database is interfaced from NodeJS via Sequelize (https://github.com/sequelize/sequelize)

### Create New Migration
1. Create empty migration file: `npm run migration:create {migration-name}`
   - Example: `npm run migration:create add-users-table`
1. Remove the `use strict;` at the top of the file and proceed to edit